import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfessionalSchedule } from './professional-schedule.entity';
import { ScheduleException }    from './schedule-exception.entity';
import { ScheduleService }      from './schedule.service';
import { ScheduleController }   from './schedule.controller';

@Module({
  imports:     [TypeOrmModule.forFeature([ProfessionalSchedule, ScheduleException])],
  controllers: [ScheduleController],
  providers:   [ScheduleService],
  exports:     [ScheduleService],
})
export class ScheduleConfigModule {}
