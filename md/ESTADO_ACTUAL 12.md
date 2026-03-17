# TurnoPro — Estado actual del desarrollo

**Última actualización:** Marzo 2026 — Sesión 12

---

## ✅ Implementado y funcionando en producción

### Backend (NestJS)
- Autenticación JWT con roles: professional, superadmin
- CRUD de servicios, horarios y excepciones de agenda
- Cálculo de slots disponibles (bloquea PENDING, CONFIRMED, RECONFIRMED, COMPLETED)
- Citas: crear, confirmar, completar, cancelar, reconfirmar por token
- Reenvío de email al paciente: POST /appointments/:id/resend-email
- 9 notificaciones automáticas por email
- Cron 20:00hs — recordatorio automático a pacientes con cita mañana
- Módulo de clientes con historial
- Panel superadmin: profesionales y planes
- whatsappPhone en perfil del profesional
- Endpoint compartir página: POST /professionals/share-link
- Notificación al médico cuando el paciente cancela
- SSL configurable: DB_SSL=true para Aiven, vacío para local
- Cambio de contraseña del profesional — POST /api/professionals/change-password
- Recuperación de contraseña — POST /api/auth/forgot-password + POST /api/auth/reset-password
- Email bienvenida al crear profesional — link para configurar contraseña (sin enviar clave en texto plano)
- Email via Brevo API HTTP — resuelve bloqueo de puertos SMTP en Render

### Frontend (React + Vite)
- Página pública con reserva completa: calendario + slots + formulario
- BookingSuccess con botón WhatsApp al médico
- ClientAppointmentPage: ver, confirmar, cancelar via token único
- Ruta /cita/:token/cancelar — cancelación directa desde link del email
- Panel profesional completo: Dashboard, Mañana, Nueva cita, Servicios, Horarios, Clientes, Perfil
- Botones con loading/disabled en todas las acciones (evita doble clic)
- Cambio de contraseña en ProfilePage — sección desplegable
- ForgotPasswordPage — /forgot-password
- ResetPasswordPage — /reset-password?token=xxx
- PhoneInput — selector de código de país (+54 AR / +58 VE) en ProfilePage, NewAppointmentPage y BookingForm
- vercel.json en raíz del frontend para SPA routing en Vercel

---

## 📧 Circuito de notificaciones

| Evento | Paciente | Médico |
|--------|----------|--------|
| Paciente reserva | ✅ Email detalles + link + WA btn | ✅ Email datos paciente |
| Médico acepta PENDING | ✅ Email confirmación | — |
| Médico cancela | ✅ Email + WA btn + rebooking | — |
| Paciente cancela | ✅ Email confirmación | ✅ Email aviso + WA btn |
| Paciente reconfirma | — | ✅ Email aviso |
| Médico completa | ✅ Email gracias + rebooking | — |
| Cron 20:00hs | ✅ Recordatorio automático | — |
| Médico reenvía | ✅ Recordatorio manual | — |
| Profesional creado | — | ✅ Email bienvenida + link configurar contraseña |

---

## 🔄 Estados de una cita

```
PENDING → [médico acepta] → CONFIRMED → [paciente confirma] → RECONFIRMED → [médico completa] → COMPLETED
PENDING → [médico rechaza / paciente cancela] → CANCELLED
CONFIRMED → [médico o paciente cancela] → CANCELLED
PENDING → [cron sin respuesta] → EXPIRED
```

---

## 🏗 Deploy — Producción (Aiven + Render + Vercel + Brevo)

### Variables de entorno del backend en Render
```
DB_HOST=...aivencloud.com
DB_PORT=19410
DB_NAME=defaultdb
DB_USER=avnadmin
DB_PASS=...
DB_SSL=true
JWT_SECRET=...
JWT_EXPIRY=7d
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=tuturnopro@gmail.com
MAIL_PASS=...app-password...
MAIL_FROM=TurnoPro <tuturnopro@gmail.com>
BREVO_API_KEY=xkeysib-...
APP_URL=https://turnopro-frontend.vercel.app
PORT=3000
NODE_ENV=production
PENDING_EXPIRY_HOURS=2
SUPERADMIN_EMAIL=admin@turnopro.com
SUPERADMIN_PASS=...
SUPERADMIN_HASH=...bcrypt...
```

### Variables del frontend en Vercel
```
VITE_API_URL=https://turnopro-backend.onrender.com/api
VITE_APP_URL=https://turnopro-frontend.vercel.app
```

### Lógica de envío de email (notifications.service.ts)
```
Si BREVO_API_KEY está presente → usa Brevo API HTTP (producción — puerto 443)
Si no → usa Nodemailer SMTP con Gmail (local)
```
Render bloquea puertos SMTP (25, 465, 587) en plan gratuito. Brevo por HTTP bypasea esa restricción.

### Errores reales encontrados y sus fixes
| Error | Fix |
|-------|-----|
| nest: not found | Build Command: npm install --include=dev && npm run build |
| Cannot find module @nestjs/mapped-types | Agregar en dependencies del package.json |
| Cannot POST /auth/login | VITE_API_URL debe terminar en /api |
| 404 NOT_FOUND en rutas directas | Crear vercel.json con rewrite a index.html |
| Table does not exist | NODE_ENV=development temporalmente para que TypeORM sincronice |
| Connection timeout SMTP | Render bloquea puertos SMTP — usar BREVO_API_KEY |
| Unknown column reset_token | NODE_ENV=development para sincronizar nuevos campos, luego volver a production |

### Notas importantes
- Aiven plan gratuito puede apagarse — encenderlo manualmente desde el dashboard
- Al agregar campos nuevos a entidades: NODE_ENV=development en Render, redesplegar, volver a production
- NODE_ENV=development activa logging de queries en rojo en Render — es normal
- Rama develop para trabajo diario, merge a main para deploy

---

## 🔧 Stack técnico

**Backend:** NestJS + TypeORM + MySQL + JWT + Nodemailer + bcrypt + @nestjs/schedule
**Frontend:** React 18 + TypeScript + Vite 5 + TailwindCSS + React Query v5 + Zustand + Axios + React Hook Form + date-fns
**Repos GitHub:** jquevedo82/turnopro-frontend | jquevedo82/turnopro-backend
**Deploy:** Aiven (MySQL) + Render (backend) + Vercel (frontend) + Brevo (email HTTP)

---

## 📋 BACKLOG

### ✅ Completado
- [x] Recuperación de contraseña — link por email con token temporal
- [x] Email bienvenida al profesional — link para configurar contraseña
- [x] Botones con loading/desactivado — evitar doble clic
- [x] Código de país WhatsApp — selector +54 / +58
- [x] Rama develop — mergear a main solo cuando esté probado
- [x] **Slots dinámicos por servicio (Opción A)** — endpoint recibe serviceId, algoritmo de cursor que salta al fin de la cita que choca, fallback al perfil si el servicio no tiene buffer. Archivos modificados: availability.service.ts, availability.module.ts, availability.controller.ts, update-service.dto.ts (creado), PublicPage.tsx, useAvailability.ts, availability.api.ts
- [x] **Mostrar servicio en tarjeta de cita** — DashboardPage y TomorrowPage muestran `🩺 Servicio · X min` en cada fila de cita
- [x] **Invalidar cache tras crear cita** — useCreateAppointment ahora invalida `["appointments"]` y `["slots"]` en onSuccess. NewAppointmentPage migrado de llamada directa a API al hook para que el invalidate se dispare correctamente
- [x] **Fix clientes duplicados por email** — clients.service.ts busca por `(professionalId + email + nombre normalizado)`. Si el cliente existe actualiza nombre y teléfono si cambiaron. Elimina restricción de email como identificador único
- [x] **Validación nombre y apellido en reserva** — BookingForm y NewAppointmentPage exigen mínimo nombre + apellido. Label, helper text y regex de validación. autoCapitalize en móvil.
- [x] **PhoneInput en formulario de alta de profesional (superadmin)** — ProfessionalsPage usa componente PhoneInput (+54/+58) consistente con el resto del sistema

### 🟡 Media prioridad

- [ ] **Separación Client / Patient — Arquitectura médica** ← DISEÑADO, PENDIENTE IMPLEMENTAR

  **Problema:** el modelo actual mezcla "quien reserva" con "quien se atiende". Una persona puede reservar para un familiar. El email no es identificador único de persona.

  **Modelo propuesto:**
  ```
  Client  → quien reserva (nombre + email + teléfono). Identificado por (professionalId + email + nombre normalizado)
  Patient → quien se atiende (nombre + tipo doc + nro doc + fecha nacimiento). Identificado por documento.
  
  Appointment
    └── clientId   — quien reservó (ya existe)
    └── patientId  — nullable por ahora, se completa cuando el médico abre historia clínica
  
  MedicalRecord
    └── professionalId  — historia ES del profesional (no compartida entre profesionales)
    └── patientId       — historia ES del paciente
    └── appointments[]  — citas relacionadas a esta historia
  ```

  **Tipos de documento:**
  - V — Venezolano
  - E — Extranjero residente
  - P — Pasaporte
  - C — Colombiano u otro país
  - SIN_DOC — menores sin cédula (referencia por nombre + fecha nacimiento)

  **Regla clave:** el historial del paciente con el Dr. García es independiente del historial con cualquier otro profesional. Cada profesional ve solo sus propios historiales.

- [ ] **Historia clínica — entidad MedicalRecord** — implementar una vez definida la entidad Patient. Campos: id, professionalId, patientId, recordNumber, notes, appointments[]. Cita tiene patientId nullable.
- [ ] **Sobre turnos** — checkbox al crear cita manual, flag isOverbook=true, etiqueta visual amarilla
- [ ] **Cambiar email o slug desde superadmin** — solo mientras isActive=false. Validar email único, advertir sobre links del slug.
- [ ] **Reenvío de credenciales desde superadmin** — genera contraseña temporal y envía email
- [ ] **Rol secretaria — Variante A (secretaria de un profesional)** — login propio vinculado a un único profesional. Panel simplificado: ver agenda, crear cita manual, gestionar estados. Sin acceso a configuración de perfil, servicios ni horarios. El profesional puede activar/desactivar su secretaria desde su perfil.
- [ ] **Rol secretaria — Variante B (secretaria de clínica)** — login propio con acceso a múltiples médicos de una misma organización. Panel con selector "Trabajando como: Dr. García" que cambia el contexto completo. Nueva entidad Organization que agrupa médicos y secretarias. Cada endpoint valida que la secretaria tenga acceso al médico que opera. Las páginas públicas de cada médico siguen siendo individuales.
- [ ] **Pagos online** — MercadoPago o Stripe
- [ ] **Cita con seña** — pago parcial para confirmar
- [ ] **Panel superadmin mejorado** — estadísticas generales
- [ ] **Bloqueo por rango de fechas** — vacaciones/licencia
- [ ] **Lista de espera**

### 🟢 UX
- [ ] **Foto de perfil del profesional** — campo `avatar` ya existe en la entidad. Ver sección Decisiones de Arquitectura para detalle de implementación de storage.
- [ ] Vista semanal en la agenda
- [ ] Búsqueda en clientes
- [ ] Historial del paciente en la cita
- [ ] Notas internas en la cita

### ⚙️ Técnico
- [ ] **Agregar link al panel en email de bienvenida** — link fijo a /login para que el profesional acceda al sistema desde el email
- [ ] **Formato de nombres** — capitalizar primera letra de cada palabra al guardar
- [ ] **Validación de email en formularios** — todos los inputs de email del frontend
- [ ] **Timeout en envío de email** — 8s Brevo HTTP, 5s Nodemailer SMTP. Loguear error y continuar sin bloquear respuesta.
- [ ] **Reset de BD de producción** — endpoint superadmin para limpiar tablas dejando solo el superadmin
- [ ] Migraciones TypeORM — reemplazar synchronize
- [ ] Rate limiting en endpoints públicos
- [ ] Tests unitarios (Jest + Vitest)
- [ ] Docker Compose

### 🔵 Futuro
- [ ] WhatsApp automático (Twilio o Meta Business — 360dialog descartado)
- [ ] Google Calendar sync
- [ ] App móvil (React Native)
- [ ] Multi-sede

---

## 🏛 Decisiones de Arquitectura

### Storage de archivos — Foto de perfil y uploads

**Problema:** Render en plan gratuito usa sistema de archivos efímero. Los archivos subidos al servidor se pierden en cada redeploy.

**Solución actual (Render):** Cloudinary — servicio de hosting de imágenes externo.
- Plan gratuito hasta 25GB
- Se sube desde el backend, devuelve URL pública
- El campo `avatar` en `professional.entity.ts` guarda la URL

**Solución futura (servidor propio — VPS, Donweb, DigitalOcean, etc.):** archivos locales servidos como estáticos.
```
backend/
  uploads/
    avatars/   ← fotos de perfil
    logos/     ← logos opcionales
```
```typescript
// main.ts — habilita carpeta pública
app.useStaticAssets(join(__dirname, '..', 'uploads'), {
  prefix: '/uploads',
});
// URL resultante: https://tudominio.com/uploads/avatars/avatar-1.jpg
```

**Arquitectura preparada para el cambio:**
```
StorageService (interfaz común)
  ├── CloudinaryStrategy  ← activo cuando STORAGE=cloudinary (Render)
  └── LocalStrategy       ← activo cuando STORAGE=local (servidor propio)
```
Variable de entorno que controla el modo:
```
STORAGE=cloudinary   ← Render / hosting sin filesystem persistente
STORAGE=local        ← VPS / servidor propio con disco persistente
```
Al migrar de Render a servidor propio: cambiar `STORAGE=local` y listo. El resto del sistema no cambia.

---

## 🚀 Guía de migración — De Render a servidor propio

Cuando se decida migrar de Render/Vercel/Aiven a un servidor propio (VPS Donweb, DigitalOcean, Hetzner, etc.):

### Stack recomendado en servidor propio
```
Servidor:   Ubuntu 22.04 LTS
Backend:    Node.js + PM2 (process manager)
Frontend:   Nginx (sirve el build de Vite como estático)
BD:         MySQL 8 instalado localmente o contenedor Docker
SSL:        Certbot + Let's Encrypt (gratuito)
Deploy:     GitHub Actions → SSH → pull + restart PM2
```

### Variables de entorno a cambiar
```
DB_HOST=localhost          ← antes era Aiven
DB_SSL=                    ← vacío, sin SSL local
APP_URL=https://tudominio.com
VITE_API_URL=https://tudominio.com/api
VITE_APP_URL=https://tudominio.com
STORAGE=local              ← antes era cloudinary
```

### Pasos de migración
1. Provisionar VPS con Ubuntu 22.04
2. Instalar Node.js, MySQL, Nginx, PM2, Certbot
3. Clonar repos (`main`) en el servidor
4. Configurar variables de entorno
5. Crear BD MySQL y usuario
6. `NODE_ENV=development` → arrancar backend una vez para que TypeORM sincronice tablas → volver a `production`
7. Build del frontend: `npm run build` → Nginx sirve `/dist`
8. Configurar Nginx como reverse proxy para el backend en puerto 3000
9. Certbot para SSL en el dominio
10. Configurar PM2 para arranque automático
11. Migrar datos de Aiven → MySQL local con `mysqldump`

### Nginx config básica
```nginx
server {
  listen 443 ssl;
  server_name tudominio.com;

  # Frontend — sirve el build de Vite
  location / {
    root /var/www/turnopro/frontend/dist;
    try_files $uri /index.html;
  }

  # Backend API
  location /api {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
  }

  # Archivos subidos (avatars, etc.)
  location /uploads {
    alias /var/www/turnopro/backend/uploads;
  }
}
```

---

## 📝 Convención de Commits

Al finalizar cada feature y confirmar que quedó ok, Claude provee el mensaje de commit listo para copiar.

### Formato
```
tipo(módulo): descripción corta en imperativo

- detalle 1
- detalle 2
```

### Tipos
| Tipo | Cuándo usarlo |
|---|---|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de bug |
| `refactor` | Cambio interno sin impacto funcional |
| `chore` | Configuración, dependencias, variables de entorno |
| `docs` | Documentación |

### Commits por feature — historial de esta sesión

**Backend**
```
feat(clients): identificar cliente por email + nombre normalizado

- Elimina unique constraint de email en client.entity.ts
- Agrega índice compuesto (professionalId, email, name)
- findOrCreate busca por email + nombre normalizado
- Mismo email + nombre distinto = cliente nuevo (caso familiar)
- Actualiza teléfono si el cliente reserva con uno diferente
```

```
feat(availability): slots dinámicos por serviceId

- Inyecta ServicesService en AvailabilityModule
- Algoritmo de cursor que salta al fin de la cita que choca
- Fallback a duración/buffer del perfil si el servicio no los tiene
- getAvailableDaysInMonth recibe serviceId y lo propaga
- Agrega update-service.dto.ts
```

**Frontend**
```
feat(booking): validación nombre y apellido en formularios

- BookingForm: label "Nombre del paciente", helper text, validación mínimo nombre + apellido
- NewAppointmentPage: ídem para carga manual desde el panel
- autoCapitalize="words" en móvil
```

```
feat(appointments): invalidar cache al crear cita

- useCreateAppointment invalida ["appointments"] y ["slots"] en onSuccess
- NewAppointmentPage usa el hook en lugar de llamada directa a la API
```

```
feat(dashboard): mostrar servicio y duración en tarjetas de cita

- DashboardPage: agrega 🩺 Servicio · X min bajo el nombre del paciente
- TomorrowPage: ídem con fallback al teléfono si no hay servicio
```

```
feat(superadmin): PhoneInput con código de país en alta de profesional

- Reemplaza input de texto por componente PhoneInput (+54 AR / +58 VE)
- Consistente con NewAppointmentPage, BookingForm y ProfilePage
```
