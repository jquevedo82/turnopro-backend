import { Module }          from '@nestjs/common';
import { TypeOrmModule }   from '@nestjs/typeorm';
import { Appointment }     from '../appointments/appointment.entity';
import { AvailabilityService }    from './availability.service';
import { AvailabilityController } from './availability.controller';
import { ScheduleConfigModule }   from '../schedule/schedule.module';
import { ProfessionalsModule }    from '../professionals/professionals.module';
import { ServicesModule }         from '../services/services.module';

@Module({
  imports:     [
    TypeOrmModule.forFeature([Appointment]),
    ScheduleConfigModule,
    ProfessionalsModule,
    ServicesModule,       // ← agregado para inyectar ServicesService
  ],
  controllers: [AvailabilityController],
  providers:   [AvailabilityService],
  exports:     [AvailabilityService],
})
export class AvailabilityModule {}