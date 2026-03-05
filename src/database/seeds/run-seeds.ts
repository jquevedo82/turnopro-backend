import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt    from 'bcrypt';
import * as dotenv    from 'dotenv';
dotenv.config();

// ── Importar entidades con rutas relativas correctas desde src/database/seeds/
import { Plan }                 from '../../modules/plans/plan.entity';
import { Professional }         from '../../modules/professionals/professional.entity';
import { Service }              from '../../modules/services/service.entity';
import { ProfessionalSchedule } from '../../modules/schedule/professional-schedule.entity';
import { ScheduleException }    from '../../modules/schedule/schedule-exception.entity';
import { Client }               from '../../modules/clients/client.entity';
import { Appointment }          from '../../modules/appointments/appointment.entity';
import { NotificationLog }      from '../../modules/notifications/notification-log.entity';

async function main() {
  console.log('🔌 Conectando a la base de datos...');

  const dataSource = new DataSource({
    type:        'mysql',
    host:        process.env.DB_HOST     || 'localhost',
    port:        parseInt(process.env.DB_PORT || '3306'),
    username:    process.env.DB_USER     || 'root',
    password:    process.env.DB_PASS     || '',
    database:    process.env.DB_NAME     || 'turnopro_db',
    synchronize: true, // Crea las tablas automáticamente si no existen
    charset:     'utf8mb4',
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
  });

  await dataSource.initialize();
  console.log('✅ Conectado. Tablas sincronizadas.');

  // ── Crear planes ──────────────────────────────────────────────────────
  const planRepo = dataSource.getRepository(Plan);

  const planes = [
    { name: 'Básico',  price: 5000,  durationDays: 30,  isActive: true },
    { name: 'Pro',     price: 9000,  durationDays: 30,  isActive: true },
    { name: 'Anual',   price: 80000, durationDays: 365, isActive: true },
  ];

  for (const plan of planes) {
    const existe = await planRepo.findOne({ where: { name: plan.name } });
    if (!existe) {
      await planRepo.save(planRepo.create(plan));
      console.log(`✅ Plan creado: ${plan.name}`);
    } else {
      console.log(`⏭️  Plan ya existe: ${plan.name}`);
    }
  }

  // ── Generar hash del superadmin ───────────────────────────────────────
  const superadminPass = process.env.SUPERADMIN_PASS || 'Admin123!';
  const hash = await bcrypt.hash(superadminPass, 10);

  console.log('\n══════════════════════════════════════════════');
  console.log('🔑 Copiá esta línea en tu .env:');
  console.log('──────────────────────────────────────────────');
  console.log(`SUPERADMIN_HASH=${hash}`);
  console.log('══════════════════════════════════════════════\n');

  await dataSource.destroy();
  console.log('✅ Seed completado.');
  console.log('👉 Pegá el SUPERADMIN_HASH en el .env y corré: npm run start:dev');
}

main().catch((err) => {
  console.error('❌ Error en el seed:', err.message);
  process.exit(1);
});
