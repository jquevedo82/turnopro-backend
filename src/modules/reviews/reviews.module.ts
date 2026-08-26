import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from './review.entity';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';

@Module({
  imports:     [TypeOrmModule.forFeature([Review])],
  controllers: [ReviewsController],
  providers:   [ReviewsService],
  exports:     [ReviewsService], // AppointmentsModule (crear invitación) y PublicModule (listado público) lo necesitan
})
export class ReviewsModule {}
