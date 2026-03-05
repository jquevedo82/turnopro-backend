import { Module }           from '@nestjs/common';
import { TypeOrmModule }    from '@nestjs/typeorm';
import { Appointment }      from './appointment.entity';
import { AppointmentsService }    from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { ClientsModule }         from '../clients/clients.module';
import { ProfessionalsModule }   from '../professionals/professionals.module';
import { ServicesModule }        from '../services/services.module';
import { AvailabilityModule }    from '../availability/availability.module';
import { NotificationsModule }   from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment]),
    ClientsModule, ProfessionalsModule, ServicesModule, AvailabilityModule, NotificationsModule,
  ],
  controllers: [AppointmentsController],
  providers:   [AppointmentsService],
  exports:     [AppointmentsService],
})
export class AppointmentsModule {}
