import { Module }              from '@nestjs/common';
import { PublicController }    from './public.controller';
import { ProfessionalsModule } from '../professionals/professionals.module';
import { ServicesModule }      from '../services/services.module';
import { AppointmentsModule }  from '../appointments/appointments.module';

@Module({
  imports:     [ProfessionalsModule, ServicesModule, AppointmentsModule],
  controllers: [PublicController],
})
export class PublicModule {}
