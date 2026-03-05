import { Controller, Get, Put, Post, Delete, Body, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ScheduleService }  from './schedule.service';
import { CreateScheduleDto, CreateExceptionDto } from './dto/create-schedule.dto';
import { JwtAuthGuard }     from '../../common/guards/jwt-auth.guard';
import { RolesGuard }       from '../../common/guards/roles.guard';
import { Roles }            from '../../common/decorators/roles.decorator';
import { Role }             from '../../common/roles.enum';
import { CurrentUser }      from '../../common/decorators/current-user.decorator';
import { JwtPayload, getProfessionalId } from '../auth/jwt.strategy';

@Controller('schedule')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PROFESSIONAL)
export class ScheduleController {
  constructor(private readonly svc: ScheduleService) {}

  @Get('my')
  getMySchedule(@CurrentUser() user: JwtPayload) {
    return this.svc.getWeeklySchedule(getProfessionalId(user));
  }

  @Put('day')
  upsertDay(@Body() dto: CreateScheduleDto, @CurrentUser() user: JwtPayload) {
    return this.svc.upsertDay(getProfessionalId(user), dto);
  }

  @Get('exceptions')
  getExceptions(@CurrentUser() user: JwtPayload) {
    return this.svc.getExceptions(getProfessionalId(user));
  }

  @Post('exceptions')
  createException(@Body() dto: CreateExceptionDto, @CurrentUser() user: JwtPayload) {
    return this.svc.createException(getProfessionalId(user), dto);
  }

  @Delete('exceptions/:id')
  deleteException(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.svc.deleteException(id, getProfessionalId(user));
  }
}
