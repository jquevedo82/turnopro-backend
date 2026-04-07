/**
 * professionals.module.ts
 *
 * Cambios respecto a la versión anterior:
 *   - Importa StorageModule (para subir avatar a Cloudinary o disco local)
 *   - Importa MulterModule (para parsear multipart/form-data en el endpoint /avatar)
 *   - MulterModule usa storage: memoryStorage() → el archivo llega como Buffer en req
 *     (no toca el disco del servidor, necesario en Render donde no hay filesystem persistente)
 */
import { Module }         from '@nestjs/common';
import { TypeOrmModule }  from '@nestjs/typeorm';
import { MulterModule }   from '@nestjs/platform-express';
import { memoryStorage }  from 'multer';

import { ProfessionalsController } from './professionals.controller';
import { ProfessionalsService }    from './professionals.service';
import { Professional }            from './professional.entity';
import { NotificationsModule }     from '../notifications/notifications.module';
import { StorageModule }           from '../storage/storage.module';
import { SecretariesModule }       from '../secretaries/secretaries.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Professional]),
    NotificationsModule,
    StorageModule,
    SecretariesModule,
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [ProfessionalsController],
  providers:   [ProfessionalsService],
  exports:     [ProfessionalsService],
})
export class ProfessionalsModule {}