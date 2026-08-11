const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const DB = path.join(__dirname, "data.json");
const PUBLIC = path.join(__dirname, "public");

function load() {
  if (!fs.existsSync(DB)) {
    const adminHash = hashPassword("Cambiar123!");
    const db = {
      users: [{id:1,name:"Administrador",email:"admin@sorteahn.local",phone:"",password:adminHash,role:"admin"}],
      raffles: [{
        id:1, code:"SH001", prize:"L 100,000 en efectivo", price:20, quantity:10000,
        drawDate:"", status:"Activo", description:"Sorteo de demostración. Configurá las reglas y autorización antes de operar con dinero real."
      }],
      tickets: [], orders: [], audit: []
    };
    save(db); return db;
  }
  return JSON.parse(fs.readFileSync(DB,"utf8"));
}
function save(db){ fs.writeFileSync(DB, JSON.stringify(db,null,2)); }
let db = load();

function hashPassword(pw){
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pw,salt,64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(pw, stored){
  const [salt,hash] = stored.split(":");
  const test = crypto.scryptSync(pw,salt,64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash,"hex"),Buffer.from(test,"hex"));
}
const sessions = new Map();
function token(){ return crypto.randomBytes(32).toString("hex"); }
function cookies(req){
  return Object.fromEntries((req.headers.cookie||"").split(";").filter(Boolean).map(x=>{
    const i=x.indexOf("="); return [x.slice(0,i).trim(),decodeURIComponent(x.slice(i+1))];
  }));
}
function currentUser(req){ const t=cookies(req).sid; const id=sessions.get(t); return db.users.find(u=>u.id===id)||null; }
function send(res,status,data,type="application/json"){
  res.writeHead(status,{"Content-Type":type,"Cache-Control":"no-store"});
  res.end(type==="application/json"?JSON.stringify(data):data);
}
function body(req){
  return new Promise((resolve,reject)=>{
    let s=""; req.on("data",c=>s+=c);
    req.on("end",()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(e)}});
  });
}
function requireUser(req,res,admin=false){
  const u=currentUser(req);
  if(!u) { send(res,401,{error:"Iniciá sesión."}); return null; }
  if(admin && u.role!=="admin"){ send(res,403,{error:"Acceso administrativo denegado."}); return null; }
  return u;
}
function audit(user,action,meta={}){
  db.audit.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),userId:user?.id||null,action,meta});
  db.audit=db.audit.slice(0,500); save(db);
}
function publicRaffle(){
  const r=db.raffles.find(x=>x.status==="Activo")||db.raffles[0];
  const sold=db.tickets.filter(t=>t.raffleId===r.id && t.status==="paid").length;
  return {...r,sold,available:r.quantity-sold};
}
function jsonUser(u){return {id:u.id,name:u.name,email:u.email,phone:u.phone,role:u.role};}

async function api(req,res,url){
  const p=url.pathname, method=req.method;
  if(method==="GET" && p==="/api/me"){ const u=currentUser(req); return send(res,200,{user:u?jsonUser(u):null});}
  if(method==="POST" && p==="/api/register"){
    const b=await body(req); if(!b.name||!b.email||!b.phone||!b.password||b.password.length<8)return send(res,400,{error:"Completá todos los campos. La contraseña debe tener al menos 8 caracteres."});
    const email=b.email.toLowerCase().trim(); if(db.users.some(u=>u.email===email))return send(res,409,{error:"Ese correo ya está registrado."});
    const u={id:Math.max(0,...db.users.map(x=>x.id))+1,name:b.name.trim(),email,phone:b.phone.trim(),password:hashPassword(b.password),role:"user"};
    db.users.push(u); save(db); const sid=token(); sessions.set(sid,u.id); res.setHeader("Set-Cookie",`sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`); audit(u,"register"); return send(res,201,{user:jsonUser(u)});
  }
  if(method==="POST" && p==="/api/login"){
    const b=await body(req),u=db.users.find(x=>x.email===String(b.email||"").toLowerCase().trim());
    if(!u||!verifyPassword(b.password||"",u.password))return send(res,401,{error:"Correo o contraseña incorrectos."});
    const sid=token();sessions.set(sid,u.id);res.setHeader("Set-Cookie",`sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`);audit(u,"login");return send(res,200,{user:jsonUser(u)});
  }
  if(method==="POST" && p==="/api/logout"){
    const c=cookies(req); if(c.sid)sessions.delete(c.sid);res.setHeader("Set-Cookie","sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");return send(res,200,{ok:true});
  }
  if(method==="GET" && p==="/api/raffle"){
    return send(res,200,{raffle:publicRaffle()});
  }
  if(method==="GET" && p==="/api/numbers"){
    const r=publicRaffle(), nums={};
    db.tickets.filter(t=>t.raffleId===r.id && ["reserved","paid"].includes(t.status)).forEach(t=>nums[t.number]=t.status);
    return send(res,200,{quantity:r.quantity,numbers:nums});
  }
  if(method==="POST" && p==="/api/orders"){
    const u=requireUser(req,res); if(!u)return;
    const b=await body(req),r=publicRaffle(), numbers=[...new Set((b.numbers||[]).map(Number))];
    if(!numbers.length||numbers.some(n=>!Number.isInteger(n)||n<1||n>r.quantity))return send(res,400,{error:"Números inválidos."});
    const existing=new Set(db.tickets.filter(t=>t.raffleId===r.id&&["reserved","paid"].includes(t.status)).map(t=>t.number));
    if(numbers.some(n=>existing.has(n)))return send(res,409,{error:"Uno o más números ya fueron tomados. Actualizá la disponibilidad."});
    const order={id:"SH-"+Date.now().toString().slice(-9),userId:u.id,raffleId:r.id,numbers,total:numbers.length*r.price,status:"pending_payment",createdAt:new Date().toISOString()};
    numbers.forEach(n=>db.tickets.push({raffleId:r.id,number:n,orderId:order.id,userId:u.id,status:"reserved"}));
    db.orders.unshift(order); save(db); audit(u,"create_order",{orderId:order.id,numbers}); 
    return send(res,201,{order, paymentMessage:"Orden creada. El pago real no está conectado en esta versión."});
  }
  if(method==="GET" && p==="/api/my-orders"){
    const u=requireUser(req,res);if(!u)return;
    return send(res,200,{orders:db.orders.filter(o=>o.userId===u.id).map(o=>({...o,raffle:db.raffles.find(r=>r.id===o.raffleId)?.prize}))});
  }

  if(p.startsWith("/api/admin/")){
    const u=requireUser(req,res,true);if(!u)return;
    if(method==="GET"&&p==="/api/admin/overview"){
      const r=publicRaffle();return send(res,200,{raffles:db.raffles,users:db.users.map(jsonUser),orders:db.orders,tickets:db.tickets,audit:db.audit,active:r});
    }
    if(method==="POST"&&p==="/api/admin/raffle"){
      const b=await body(req);
      const r={id:Math.max(0,...db.raffles.map(x=>x.id))+1,code:"SH"+String(Date.now()).slice(-4),prize:String(b.prize||"Premio"),price:Number(b.price)||20,quantity:Number(b.quantity)||10000,drawDate:String(b.drawDate||""),status:String(b.status||"En preparación"),description:String(b.description||"")};
      db.raffles.unshift(r);save(db);audit(u,"create_raffle",{raffleId:r.id});return send(res,201,{raffle:r});
    }
    if(method==="PATCH"&&p.startsWith("/api/admin/orders/")){
      const id=p.split("/").pop(),o=db.orders.find(x=>x.id===id);if(!o)return send(res,404,{error:"Orden no encontrada."});
      const b=await body(req),newStatus=b.status;
      if(!["pending_payment","paid","cancelled"].includes(newStatus))return send(res,400,{error:"Estado inválido."});
      o.status=newStatus;db.tickets.filter(t=>t.orderId===o.id).forEach(t=>t.status=newStatus==="paid"?"paid":newStatus==="cancelled"?"cancelled":"reserved");save(db);audit(u,"update_order",{orderId:id,status:newStatus});return send(res,200,{order:o});
    }
    if(method==="POST"&&p==="/api/admin/draw"){
      const r=publicRaffle(),eligible=db.tickets.filter(t=>t.raffleId===r.id&&t.status==="paid");
      if(!eligible.length)return send(res,400,{error:"No hay participaciones pagadas elegibles."});
      const winner=eligible[crypto.randomInt(eligible.length)];
      audit(u,"demo_draw",{number:winner.number,raffleId:r.id});
      return send(res,200,{number:winner.number,notice:"Selección DEMO. No usar como mecanismo de sorteo real."});
    }
  }
  return send(res,404,{error:"Ruta no encontrada."});
}

const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".svg":"image/svg+xml"};
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://${req.headers.host||"localhost"}`);
    if(url.pathname.startsWith("/api/")) return await api(req,res,url);
    let f=url.pathname==="/" ? "/index.html" : url.pathname;
    f=path.normalize(f).replace(/^(\.\.[\/\\])+/, "");
    const full=path.join(PUBLIC,f);
    if(!full.startsWith(PUBLIC))return send(res,403,{error:"Forbidden"});
    if(fs.existsSync(full)&&fs.statSync(full).isFile()) return send(res,200,fs.readFileSync(full),mime[path.extname(full)]||"application/octet-stream");
    return send(res,404,"Not found","text/plain; charset=utf-8");
  }catch(e){console.error(e);send(res,500,{error:"Error interno."});}
});
server.listen(PORT,()=>console.log(`SorteaHN listo en http://localhost:${PORT}`));
