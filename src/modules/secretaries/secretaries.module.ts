/**
 * secretaries.module.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Módulo: Secretaries
 *
 * Para agregar a app.module.ts:
 *   import { SecretariesModule } from './secretaries/secretaries.module';
 *   // en imports: [..., SecretariesModule]
 *
 * SecretariesService se exporta para uso en AuthModule.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Secretary }     from './secretary.entity';
import { Professional }  from '../professionals/professional.entity';
import { SecretariesService }                           from './secretaries.service';
import { SecretaryMeController, SecretariesController } from './secretaries.controller';
import { NotificationsModule }                          from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Secretary, Professional]),
    NotificationsModule, // necesario para inyectar NotificationsService en SecretariesController
  ],
  controllers: [SecretaryMeController, SecretariesController],
  providers:   [SecretariesService],
  exports:     [SecretariesService], // AuthModule lo necesita para validar login
})
export class SecretariesModule {}