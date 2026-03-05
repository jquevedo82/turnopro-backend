import { Module }          from '@nestjs/common';
import { TypeOrmModule }   from '@nestjs/typeorm';
import { Professional }    from './professional.entity';
import { ProfessionalsService }    from './professionals.service';
import { ProfessionalsController } from './professionals.controller';

@Module({
  imports:     [TypeOrmModule.forFeature([Professional])],
  controllers: [ProfessionalsController],
  providers:   [ProfessionalsService],
  exports:     [ProfessionalsService],
})
export class ProfessionalsModule {}
