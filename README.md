# SorteaHN v1 — Aplicación funcional local

## Qué trae
- Frontend público responsive.
- Registro, login y logout.
- Sesiones mediante cookie HttpOnly.
- Contraseñas con scrypt + salt.
- Base de datos local JSON para ejecutar sin instalar dependencias.
- Sorteo activo y disponibilidad de números.
- Creación de órdenes.
- Protección del servidor contra comprar números ya reservados/pagados.
- Historial de órdenes del usuario.
- Panel administrativo protegido por rol.
- Crear sorteos.
- Confirmar/cancelar órdenes en modo demo.
- Auditoría básica.
- Selección de ganador únicamente DEMO.

## Ejecutar
Requiere Node.js 18+.

```bash
npm start
```

Abrí:
http://localhost:3000

Administrador inicial:
- correo: admin@sorteahn.local
- contraseña: Cambiar123!

**Cambiala inmediatamente si lo desplegás.**

## Importante antes de producción
Esta versión NO procesa dinero real y NO debe anunciarse como plataforma de sorteos autorizada. Para producción se necesita:
- PostgreSQL u otra base de datos transaccional.
- HTTPS y dominio.
- Gestión de secretos/variables de entorno.
- MFA y roles administrativos más granulares.
- Rate limiting, CSRF/XSS y validación exhaustiva.
- Confirmación de pagos mediante webhooks firmados del proveedor elegido.
- Reserva con vencimiento y transacciones/locks para evitar carreras.
- Sistema de comprobantes.
- Notificaciones.
- Backups y monitoreo.
- Revisión legal y autorizaciones aplicables en Honduras antes de cobrar participaciones.
- Mecanismo de sorteo definido por el reglamento/autorización; el selector DEMO del panel NO sirve para un sorteo real.

No se incluyen credenciales de pagos ni se simulan pagos como confirmados automáticamente.
