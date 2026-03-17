# TurnoPro — Estado actual del desarrollo

**Última actualización:** Marzo 2026 — Sesión 11

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
- [ ] Vista semanal en la agenda
- [ ] Búsqueda en clientes
- [ ] Historial del paciente en la cita
- [ ] Notas internas en la cita
- [ ] Foto de perfil del profesional

### ⚙️ Técnico
- [ ] **Agregar link al panel en email de bienvenida** — link fijo a /login para que el profesional acceda al sistema desde el email
- [ ] **PhoneInput en formulario de alta de profesional (superadmin)** — ProfessionalsPage no tiene selector +54/+58. Aplicar componente PhoneInput igual que en los otros formularios.
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
