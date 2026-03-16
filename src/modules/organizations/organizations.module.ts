/**
 * organizations.module.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Módulo: Organizations
 *
 * Para agregar a app.module.ts:
 *   import { OrganizationsModule } from './organizations/organizations.module';
 *   // en imports: [..., OrganizationsModule]
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Module }       from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization }          from './organization.entity';
import { Professional }          from '../professionals/professional.entity';
import { OrganizationsService }  from './organizations.service';
import { OrganizationsController } from './organizations.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Organization, Professional]),
  ],
  controllers: [OrganizationsController],
  providers:   [OrganizationsService],
  exports:     [OrganizationsService], // exportado para uso en SecretariesModule y AuthModule
})
export class OrganizationsModule {}
