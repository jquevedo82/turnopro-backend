# TurnoPro — Estado actual del desarrollo

**Última actualización:** Marzo 2026 — Sesión 17

---

## ✅ Implementado y funcionando en producción

### Backend (NestJS)
- Autenticación JWT con roles: `professional`, `superadmin`, `secretary`
- CRUD de servicios, horarios y excepciones de agenda
- Cálculo de slots disponibles (bloquea PENDING, CONFIRMED, RECONFIRMED, COMPLETED)
- Citas: crear, confirmar, completar, cancelar, reconfirmar por token
- Reenvío de email al paciente: POST /appointments/:id/resend-email
- 9 notificaciones automáticas por email + email bienvenida secretaria
- Cron 20:00hs — recordatorio automático a pacientes con cita mañana
- Módulo de clientes con historial
- Panel superadmin: profesionales, planes y organizaciones
- whatsappPhone en perfil del profesional
- Endpoint compartir página: POST /professionals/share-link
- Notificación al médico cuando el paciente cancela
- SSL configurable: DB_SSL=true para Aiven, vacío para local
- Cambio de contraseña del profesional — POST /api/professionals/change-password
- Recuperación de contraseña — POST /api/auth/forgot-password + POST /api/auth/reset-password
- Email bienvenida al crear profesional — link para configurar contraseña (sin enviar clave en texto plano)
- Email via Brevo API HTTP — resuelve bloqueo de puertos SMTP en Render
- Foto de perfil del profesional — StorageService dual (Cloudinary en prod / disco local en VPS)
- **Módulo Organizations** — CRUD de organizaciones/clínicas, asignación de profesionales
- **Módulo Secretaries** — CRUD de secretarias, login propio, assertAccess, reset de contraseña
- **Login unificado extendido** — orden: superadmin → secretary → professional
- **JwtPayload extendido** — incluye `secretaryId` y `organizationId` para tokens de secretaria
- **appointments.controller** — endpoints today/tomorrow/confirm/cancel/complete aceptan `Role.SECRETARY` con `resolveProffesionalId()` que valida acceso via `assertAccess()`

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
- PhoneInput — selector de código de país (+54 AR / +58 VE) en todos los formularios
- vercel.json en raíz del frontend para SPA routing en Vercel
- Foto de perfil en ProfilePage — componente AvatarUpload con preview instantánea
- Página pública muestra avatar del profesional — círculo con foto o inicial como fallback
- **Panel secretaria** — `/secretaria/*` con layout propio, selector "Trabajando como...", agenda real
- **SecretaryLayout** — sidebar simplificado, selector de profesional activo, banner contextual
- **SecretaryDashboardPage** — agenda completa del profesional activo con confirmar/cancelar/completar
- **Panel superadmin — Organizaciones** — `/admin/organizaciones` con CRUD completo
- **OrganizationsPage** — crear orgs, asignar/desvincular profesionales, crear/gestionar secretarias
- **auth.store** — `activeProfessionalId` persiste en sessionStorage para contexto de secretaria
- **ProtectedRoute** — soporta rol `secretary` con mapa `ROLE_HOME`
- **LoginPage** — redirect post-login diferenciado por rol (secretary → /secretaria)
- **PhoneInput en OrganizationsPage** — formulario de org y alta de secretaria usan `PhoneInput`

---

## 🏛 Arquitectura de roles

```
superadmin
  └── Gestiona todo desde /admin
  └── Crea organizations, asigna profesionales, crea secretarias

professional
  └── Login independiente
  └── organizationId: null → modo individual (sin cambios)
  └── organizationId: N   → pertenece a una org (gestionado por superadmin)
  └── Su panel /panel/* no cambia en ningún caso

secretary
  └── Pertenece a una organization
  └── JWT: { role: 'secretary', secretaryId, organizationId }
  └── Panel /secretaria/* con selector de profesional activo
  └── Puede operar agenda de cualquier profesional de su org
  └── Sin acceso a: perfil, servicios, horarios, historial clínico
```

### Ciclo de vida del profesional respecto a organizaciones
```
Creado por superadmin → organizationId: null (independiente, siempre)
     │
     ├─ Nunca asignado → sigue independiente para siempre
     │
     └─ Superadmin asigna a org → organizationId: N
           │
           └─ Superadmin desvincula → organizationId: null (vuelve a independiente)

Slug, login y página pública NUNCA cambian en ningún caso.
```

---

## 📧 Circuito de notificaciones

| Evento | Paciente | Médico/Secretaria |
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
| Secretaria creada | — | ✅ Email bienvenida + link configurar contraseña (48hs) |

---

## 🔄 Estados de una cita

```
PENDING → [médico/secretaria acepta] → CONFIRMED → [paciente confirma] → RECONFIRMED → [médico/secretaria completa] → COMPLETED
PENDING → [médico/secretaria rechaza / paciente cancela] → CANCELLED
CONFIRMED → [médico/secretaria o paciente cancela] → CANCELLED
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
STORAGE=cloudinary
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
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
| Nest can't resolve NotificationsService | Importar NotificationsModule en SecretariesModule |
| Ruta /admin/xxx redirige a login | La ruta debe estar dentro del bloque `<Route path="/admin">` en App.tsx |

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
- [x] **Slots dinámicos por servicio (Opción A)** — endpoint recibe serviceId, algoritmo de cursor que salta al fin de la cita que choca, fallback al perfil si el servicio no tiene buffer
- [x] **Mostrar servicio en tarjeta de cita** — DashboardPage y TomorrowPage muestran `🩺 Servicio · X min`
- [x] **Invalidar cache tras crear cita** — useCreateAppointment invalida `["appointments"]` y `["slots"]` en onSuccess
- [x] **Fix clientes duplicados por email** — busca por `(professionalId + email + nombre normalizado)`
- [x] **Validación nombre y apellido en reserva** — BookingForm y NewAppointmentPage
- [x] **PhoneInput en todos los formularios** — ProfessionalsPage, OrganizationsPage, SecretariesTab
- [x] **Foto de perfil del profesional** — StorageService dual Cloudinary/Local
- [x] **Rol secretaria (Variante B — clínica)** — arquitectura completa implementada:
  - Backend: Organization, Secretary, OrganizationsModule, SecretariesModule, login unificado, JwtPayload extendido, appointments con soporte secretary
  - Frontend: SecretaryLayout, SecretaryDashboardPage, OrganizationsPage, auth.store con activeProfessionalId, ProtectedRoute multi-rol, LoginPage con redirect por rol

### 🟡 En progreso / Próximo
- [ ] **Panel secretaria — completar páginas pendientes**
  - [ ] `SecretaryNewAppointment` — conectar con formulario real de nueva cita
  - [ ] `SecretaryClientsPage` — mostrar clientes del profesional activo

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

- [ ] **Historia clínica — entidad MedicalRecord** — implementar una vez definida la entidad Patient
- [ ] **Sobre turnos** — checkbox al crear cita manual, flag isOverbook=true, etiqueta visual amarilla
- [ ] **Cambiar email o slug desde superadmin** — solo mientras isActive=false
- [ ] **Reenvío de credenciales desde superadmin** — para profesionales (secretarias ya lo tienen)
- [ ] **Pagos online** — MercadoPago o Stripe
- [ ] **Cita con seña** — pago parcial para confirmar
- [ ] **Panel superadmin mejorado** — estadísticas generales
- [ ] **Bloqueo por rango de fechas** — vacaciones/licencia
- [ ] **Lista de espera**

### 🟢 UX
- [ ] Vista semanal en la agenda
- [ ] Búsqueda en clientes
- [ ] Historial del paciente en la cita
- [ ] Notas internas en la cita

### ⚙️ Técnico
- [ ] **Agregar link al panel en email de bienvenida** — link fijo a /login
- [ ] **Formato de nombres** — capitalizar primera letra de cada palabra al guardar
- [ ] **Validación de email en formularios** — todos los inputs de email del frontend
- [ ] **Timeout en envío de email** — 8s Brevo HTTP, 5s Nodemailer SMTP
- [ ] **Reset de BD de producción** — endpoint superadmin para limpiar tablas
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

### Rol secretary — diseño de contexto activo

**Problema:** la secretaria opera en nombre de varios profesionales. El backend necesita saber para cuál profesional está actuando en cada request.

**Solución:** `activeProfessionalId` en el store de Zustand, persistido en `sessionStorage` (se limpia al cerrar la pestaña). Cada request de la secretaria pasa `?professionalId=X` como query param. El backend valida con `assertAccess(secretaryId, professionalId)` que la secretaria pertenezca a la misma organización que el profesional antes de ejecutar cualquier acción.

```
Secretary JWT: { role: 'secretary', secretaryId, organizationId }
Request:       GET /appointments/today?professionalId=5
Backend:       assertAccess(secretaryId, 5) → verifica org coincide → ejecuta
```

**Por qué sessionStorage y no localStorage:** si la secretaria trabaja con el Dr. García en una pestaña y abre otra, empieza sin contexto activo — lo cual es el comportamiento correcto. localStorage mantendría el contexto entre sesiones lo cual podría causar confusión.

### Profesionales independientes vs organizados

**Regla de oro:** `organizationId: null` = comportamiento 100% idéntico al sistema original. Ningún código existente lee `organizationId` salvo los módulos nuevos. La migración es completamente no destructiva.

### Storage de archivos — Foto de perfil y uploads

**Problema:** Render en plan gratuito usa sistema de archivos efímero.

**Solución actual (Render):** Cloudinary — plan gratuito hasta 25GB.

**Solución futura (VPS):** archivos locales en `uploads/avatars/`.

```
StorageService (interfaz común)
  ├── CloudinaryStrategy  ← activo cuando STORAGE=cloudinary (Render)
  └── LocalStrategy       ← activo cuando STORAGE=local (servidor propio)
```

---

## 🚀 Guía de migración — De Render a servidor propio

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
DB_HOST=localhost
DB_SSL=
APP_URL=https://tudominio.com
VITE_API_URL=https://tudominio.com/api
VITE_APP_URL=https://tudominio.com
STORAGE=local
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

  location / {
    root /var/www/turnopro/frontend/dist;
    try_files $uri /index.html;
  }

  location /api {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
  }

  location /uploads {
    alias /var/www/turnopro/backend/uploads;
  }
}
```

---

## 📝 Convención de Commits

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

---

### Commits sesiones 14–17

**Backend**
```
feat(organizations): módulo completo de organizaciones y secretarias

- organization.entity.ts: nueva entidad con slug, contacto, isActive
- secretary.entity.ts: credenciales propias, vinculada a org, reset token
- professional.entity.ts: agrega organizationId nullable
- organizations.service.ts: CRUD, asignar/desvincular profesionales, findUnassigned
- organizations.controller.ts: endpoints superadmin /api/organizations
- organizations.module.ts: importa Professional y NotificationsModule
- secretaries.service.ts: CRUD, validateSecretary, assertAccess, getProfessionalsForSecretary
- secretaries.controller.ts: SecretaryMeController + SecretariesController anidado
- secretaries.module.ts: registra controllers, importa NotificationsModule
- auth.service.ts: login unificado — superadmin → secretary → professional
- jwt.strategy.ts: JwtPayload con secretaryId, organizationId, getSecretaryId()
- appointments.controller.ts: Role.SECRETARY en today/tomorrow/confirm/cancel/complete/resend
- notifications.service.ts: sendWelcomeSecretary con link 48hs
```

**Frontend**
```
feat(secretary): panel secretaria + organizaciones en superadmin

- types/index.ts: AuthUser con rol secretary, SecretaryProfessional
- auth.store.ts: activeProfessionalId en sessionStorage, useActiveProfessional selector
- ProtectedRoute.tsx: soporta secretary con ROLE_HOME map
- LoginPage.tsx: redirect por rol — secretary → /secretaria
- App.tsx: rutas /secretaria/* y /admin/organizaciones
- SecretaryLayout.tsx: selector "Trabajando como...", sidebar simplificado, banner contextual
- SecretaryDashboardPage.tsx: agenda real con hooks ForProfessional y mutaciones contextuales
- SecretaryNewAppointment.tsx: placeholder
- SecretaryClientsPage.tsx: placeholder
- organizations.api.ts: cliente HTTP orgs + secretarias
- OrganizationsPage.tsx: CRUD orgs, asignar profes, gestionar secretarias con PhoneInput
- AdminSidebar.tsx: entrada Organizaciones
- appointments.api.ts: variantes ForProfessional con professionalId query param
- useAppointments.ts: useTodayForProfessional, useConfirmForProfessional, etc.
```
