# TurnoPro — Backend

API REST construida con **NestJS + TypeORM + MySQL**.

---

## Requisitos previos

- Node.js v18 o superior
- MySQL 8.0 o superior
- npm v9 o superior

---

## Instalación y configuración local

### 1. Clonar e instalar dependencias

```bash
git clone <repo>
cd turnopro-backend
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env` con tus datos:
- `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME` → tu MySQL local
- `JWT_SECRET` → generar una clave aleatoria segura
- `MAIL_USER`, `MAIL_PASS` → credenciales SMTP
- `APP_URL` → URL del frontend (en dev: http://localhost:5173)

### 3. Crear la base de datos en MySQL

```sql
CREATE DATABASE turnopro_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 4. Ejecutar el seed inicial (solo la primera vez)

```bash
npm run seed
```

Copia el hash generado y agrégalo al `.env` como `SUPERADMIN_HASH=<hash>`

### 5. Levantar el servidor en modo desarrollo

```bash
npm run start:dev
```

La API estará disponible en: `http://localhost:3000/api`

---

## Comandos útiles

| Comando | Descripción |
|---------|-------------|
| `npm run start:dev` | Servidor en modo desarrollo con hot reload |
| `npm run build` | Compilar para producción |
| `npm run start` | Servidor en modo producción |
| `npm run seed` | Ejecutar seeds iniciales |
| `npm run migration:generate --name=nombre` | Generar migración |
| `npm run migration:run` | Ejecutar migraciones pendientes |
| `npm run migration:revert` | Revertir última migración |
| `npm run test` | Ejecutar tests |

---

## Estructura de carpetas

```
src/
├── main.ts                    # Bootstrap. CORS, pipes globales, puerto
├── app.module.ts              # Módulo raíz. Registra todos los módulos
├── common/
│   ├── roles.enum.ts          # Roles del sistema (SUPERADMIN, PROFESSIONAL)
│   ├── guards/                # JwtAuthGuard, RolesGuard
│   ├── decorators/            # @Roles(), @CurrentUser(), @Public()
│   └── filters/               # HttpExceptionFilter (formato estándar de errores)
├── modules/
│   ├── auth/                  # Login y JWT
│   ├── plans/                 # Planes de suscripción
│   ├── professionals/         # CRUD de profesionales (superadmin)
│   ├── services/              # Servicios de cada profesional
│   ├── schedule/              # Plantilla semanal y excepciones
│   ├── availability/          # Cálculo de slots disponibles ← función clave
│   ├── appointments/          # Ciclo de vida de las citas
│   ├── clients/               # Clientes por profesional
│   ├── notifications/         # Emails y links WhatsApp
│   ├── public/                # Endpoints públicos (página de reservas)
│   └── superadmin/            # Panel superadmin
└── database/
    ├── data-source.ts         # Configuración TypeORM para CLI
    ├── migrations/            # Migraciones de la BD
    └── seeds/                 # Datos iniciales
```

---

## Endpoints principales

### Públicos (sin JWT)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Login (superadmin o profesional) |
| GET | `/api/public/:slug` | Perfil público del profesional |
| GET | `/api/public/:slug/services` | Servicios disponibles |
| GET | `/api/availability/:id/:date` | Slots disponibles |
| POST | `/api/appointments` | Crear cita |
| GET | `/api/appointments/token/:token` | Ver cita por token |
| POST | `/api/appointments/token/:token/reconfirm` | Reconfirmar cita |
| GET | `/api/public/quick-confirm/:token` | Confirmación rápida (link del prof) |

### Profesional (JWT requerido)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/appointments/today` | Agenda de hoy |
| GET | `/api/appointments/tomorrow` | Agenda de mañana |
| POST | `/api/appointments/:id/confirm` | Confirmar cita |
| POST | `/api/appointments/:id/reminder` | Marcar recordatorio enviado |
| GET | `/api/services/my` | Mis servicios |
| GET | `/api/schedule/my` | Mi plantilla semanal |
| PUT | `/api/schedule/day` | Actualizar horario de un día |

### Superadmin (JWT + rol SUPERADMIN)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/professionals` | Lista todos los profesionales |
| POST | `/api/professionals` | Crear profesional |
| POST | `/api/professionals/:id/activate` | Activar suscripción |
| GET | `/api/plans` | Lista planes |
| POST | `/api/plans` | Crear plan |

---

## Variables de entorno requeridas

Ver `.env.example` para la lista completa con descripciones.

---

## Notas de producción

- Cambiar `synchronize: true` a `false` en `app.module.ts` y usar migraciones
- Asegurarse de que `JWT_SECRET` sea una clave fuerte y única
- No commitear el archivo `.env` al repositorio


## Relacionado

- [turnopro-frontend](https://github.com/jquevedo82/turnopro-frontend) — React - TypeScript - Vite - TailwindCSS
