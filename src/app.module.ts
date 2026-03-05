/**
 * app.module.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Módulo raíz de la aplicación. Importa y registra todos los módulos del sistema.
 *
 * Para AGREGAR un nuevo módulo:
 *   1. Crear el módulo en src/modules/nuevo-modulo/
 *   2. Importar NuevoModulo aquí
 *   3. Agregarlo al array imports[]
 *
 * Para QUITAR un módulo: eliminar su import y sacarlo del array imports[]
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

// ── Módulos de negocio ────────────────────────────────────────────────────────
import { AuthModule }          from './modules/auth/auth.module';
import { PlansModule }         from './modules/plans/plans.module';
import { ProfessionalsModule } from './modules/professionals/professionals.module';
import { ServicesModule }      from './modules/services/services.module';
import { ScheduleConfigModule } from './modules/schedule/schedule.module';
import { AvailabilityModule }  from './modules/availability/availability.module';
import { AppointmentsModule }  from './modules/appointments/appointments.module';
import { ClientsModule }       from './modules/clients/clients.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PublicModule }        from './modules/public/public.module';
import { SuperadminModule }    from './modules/superadmin/superadmin.module';

// ── Entidades de la BD (TypeORM necesita conocerlas todas) ────────────────────
import { Plan }                from './modules/plans/plan.entity';
import { Professional }        from './modules/professionals/professional.entity';
import { Service }             from './modules/services/service.entity';
import { ProfessionalSchedule } from './modules/schedule/professional-schedule.entity';
import { ScheduleException }   from './modules/schedule/schedule-exception.entity';
import { Client }              from './modules/clients/client.entity';
import { Appointment }         from './modules/appointments/appointment.entity';
import { NotificationLog }     from './modules/notifications/notification-log.entity';

@Module({
  imports: [
    // ── Variables de entorno ─────────────────────────────────────────────────
    // ConfigModule carga el archivo .env y lo hace disponible en toda la app
    // Para agregar validación de variables: usar Joi en validationSchema
    ConfigModule.forRoot({
      isGlobal: true,  // Disponible en todos los módulos sin importarlo de nuevo
      envFilePath: '.env',
    }),

    // ── Conexión a MySQL con TypeORM ─────────────────────────────────────────
    // Para cambiar la BD: modificar las variables en el .env
    // synchronize: true → SOLO EN DESARROLLO. Sincroniza entidades con la BD automáticamente
    // Para PRODUCCIÓN: cambiar synchronize a false y usar migraciones
    TypeOrmModule.forRoot({
      type: 'mysql',
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '3306'),
      username: process.env.DB_USER     || 'root',
      password: process.env.DB_PASS     || '',
      database: process.env.DB_NAME     || 'turnopro_db',
      entities: [
        Plan,
        Professional,
        Service,
        ProfessionalSchedule,
        ScheduleException,
        Client,
        Appointment,
        NotificationLog,
      ],
      // ⚠️ IMPORTANTE: synchronize:true solo para desarrollo
      // En producción: cambiar a false y ejecutar: npm run migration:run
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
      charset: 'utf8mb4', // Soporta emojis y caracteres especiales
    }),

    // ── Scheduler para tareas cron ───────────────────────────────────────────
    // Habilita los decoradores @Cron() en toda la aplicación
    // Se usa en NotificationsModule para recordatorios y expiración de citas
    ScheduleModule.forRoot(),

    // ── Módulos de negocio ───────────────────────────────────────────────────
    // Para agregar un módulo nuevo: importarlo arriba y agregarlo aquí
    AuthModule,
    PlansModule,
    ProfessionalsModule,
    ServicesModule,
    ScheduleConfigModule,
    AvailabilityModule,
    AppointmentsModule,
    ClientsModule,
    NotificationsModule,
    PublicModule,
    SuperadminModule,
  ],
})
export class AppModule {}
