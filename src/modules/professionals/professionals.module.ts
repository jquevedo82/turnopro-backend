import { Module }          from '@nestjs/common';
import { TypeOrmModule }   from '@nestjs/typeorm';
import { Professional }    from './professional.entity';
import { ProfessionalsService }    from './professionals.service';
import { ProfessionalsController } from './professionals.controller';
import { NotificationsModule }     from '../notifications/notifications.module';

@Module({
  imports:     [TypeOrmModule.forFeature([Professional]), NotificationsModule],
  controllers: [ProfessionalsController],
  providers:   [ProfessionalsService],
  exports:     [ProfessionalsService],
})
export class ProfessionalsModule {}
