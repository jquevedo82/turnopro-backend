import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ServicesService }  from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { JwtAuthGuard }     from '../../common/guards/jwt-auth.guard';
import { RolesGuard }       from '../../common/guards/roles.guard';
import { Roles }            from '../../common/decorators/roles.decorator';
import { Role }             from '../../common/roles.enum';
import { CurrentUser }      from '../../common/decorators/current-user.decorator';
import { JwtPayload, getProfessionalId } from '../auth/jwt.strategy';

@Controller('services')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PROFESSIONAL)
export class ServicesController {
  constructor(private readonly svc: ServicesService) {}

  @Get('my')
  findMy(@CurrentUser() user: JwtPayload) {
    return this.svc.findByProfessional(getProfessionalId(user));
  }

  @Post()
  create(@Body() dto: CreateServiceDto, @CurrentUser() user: JwtPayload) {
    return this.svc.create({ ...dto, professionalId: getProfessionalId(user) });
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CreateServiceDto>, @CurrentUser() user: JwtPayload) {
    return this.svc.update(id, getProfessionalId(user), dto);
  }

  @Delete(':id')
  deactivate(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.svc.deactivate(id, getProfessionalId(user));
  }
}
