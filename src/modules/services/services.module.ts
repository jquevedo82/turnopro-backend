import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Service }       from './service.entity';
import { ServicesService }    from './services.service';
import { ServicesController } from './services.controller';
import { SecretariesModule }  from '../secretaries/secretaries.module';

@Module({
  imports:     [TypeOrmModule.forFeature([Service]), SecretariesModule],
  controllers: [ServicesController],
  providers:   [ServicesService],
  exports:     [ServicesService],
})
export class ServicesModule {}
