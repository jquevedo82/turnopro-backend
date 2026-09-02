import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client }        from './client.entity';
import { ClientsService }    from './clients.service';
import { ClientsController } from './clients.controller';
import { SecretariesModule } from '../secretaries/secretaries.module';

@Module({
  imports:     [TypeOrmModule.forFeature([Client]), SecretariesModule],
  controllers: [ClientsController],
  providers:   [ClientsService],
  exports:     [ClientsService],
})
export class ClientsModule {}
