let user=null, raffle=null, selected=new Set(), busy={};
const $=s=>document.querySelector(s);
async function api(url,opt={}){const r=await fetch(url,{headers:{"Content-Type":"application/json"},...opt});const d=await r.json();if(!r.ok)throw Error(d.error||"Error");return d}
function modal(html){$("#modalContent").innerHTML=html;$("#modal").classList.remove("hidden")}
window.closeModal=()=>$("#modal").classList.add("hidden");
async function load(){
 const m=await api("/api/me");user=m.user;$("#authBtn").textContent=user?"Cerrar sesión":"Iniciar sesión";$("#adminBtn").hidden=!(user&&user.role==="admin");
 const r=await api("/api/raffle");raffle=r.raffle;$("#code").textContent=raffle.code;$("#prize").textContent=raffle.prize;$("#price").textContent="L "+raffle.price;$("#available").textContent=raffle.available.toLocaleString("es-HN");
 const n=await api("/api/numbers");busy=n.numbers;renderNumbers();await loadOrders();
}
function renderNumbers(){let h="";const max=Math.min(raffle.quantity,200);for(let i=1;i<=max;i++){const b=busy[i];h+=`<button class="num ${b?"busy":selected.has(i)?"sel":""}" ${b?"disabled":""} onclick="toggle(${i})">${String(i).padStart(4,"0")}</button>`}$("#numbers").innerHTML=h;$("#count").textContent=selected.size;$("#total").textContent="L "+(selected.size*raffle.price).toLocaleString("es-HN")}
window.toggle=i=>{selected.has(i)?selected.delete(i):selected.add(i);renderNumbers()}
$("#buy").onclick=async()=>{if(!user)return authForm();if(!selected.size)return alert("Seleccioná al menos un número.");try{const d=await api("/api/orders",{method:"POST",body:JSON.stringify({numbers:[...selected]})});selected.clear();renderNumbers();await loadOrders();alert(`Orden ${d.order.id} creada. Estado: pendiente de pago. El pago real aún no está conectado.`)}catch(e){alert(e.message);load()}};
async function loadOrders(){if(!user){$("#orders").textContent="Iniciá sesión para ver tus órdenes.";return}const d=await api("/api/my-orders");$("#orders").innerHTML=d.orders.length?d.orders.map(o=>`<div class="order"><b>${o.id}</b><br>${o.numbers.map(n=>String(n).padStart(4,"0")).join(", ")} · L ${o.total}<br><span class="muted">${o.status==="paid"?"Pagado":"Pendiente de pago"}</span></div>`).join(""):"No tenés órdenes todavía."}
function authForm(){modal(`<h2>Crear cuenta / iniciar sesión</h2><div class="form"><input id="an" placeholder="Nombre"><input id="ae" type="email" placeholder="Correo"><input id="ap" placeholder="Teléfono"><input id="aw" type="password" placeholder="Contraseña (8+ caracteres)"><button class="cta" onclick="register()">Crear cuenta</button><hr><button onclick="login()">Iniciar sesión con correo y contraseña</button></div>`)}
window.register=async()=>{try{const d=await api("/api/register",{method:"POST",body:JSON.stringify({name:$("#an").value,email:$("#ae").value,phone:$("#ap").value,password:$("#aw").value})});user=d.user;closeModal();load()}catch(e){alert(e.message)}};
window.login=async()=>{try{const d=await api("/api/login",{method:"POST",body:JSON.stringify({email:$("#ae").value,password:$("#aw").value})});user=d.user;closeModal();load()}catch(e){alert(e.message)}};
$("#authBtn").onclick=async()=>{if(user){await api("/api/logout",{method:"POST"});user=null;load()}else authForm()};
$("#adminBtn").onclick=()=>location="/admin.html";
load().catch(e=>alert(e.message));