import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
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
export class ServicesController {
  constructor(private readonly svc: ServicesService) {}

  /**
   * GET /services?professionalId=X
   * Secretaria pasa professionalId del profesional activo.
   * Profesional no pasa nada — se usa su propio id del JWT.
   */
  @Get()
  @Roles(Role.PROFESSIONAL, Role.SECRETARY)
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('professionalId') professionalId?: string,
  ) {
    if (user.role === Role.SECRETARY && professionalId) {
      return this.svc.findByProfessional(Number(professionalId));
    }
    return this.svc.findByProfessional(getProfessionalId(user));
  }

  @Get('my')
  @Roles(Role.PROFESSIONAL)
  findMy(@CurrentUser() user: JwtPayload) {
    return this.svc.findByProfessional(getProfessionalId(user));
  }

  @Get('myTodos')
  @Roles(Role.PROFESSIONAL)
  findMyT(@CurrentUser() user: JwtPayload) {
    return this.svc.findAllByProfessional(getProfessionalId(user));
  }

  @Post()
  @Roles(Role.PROFESSIONAL)
  create(@Body() dto: CreateServiceDto, @CurrentUser() user: JwtPayload) {
    return this.svc.create({ ...dto, professionalId: getProfessionalId(user) });
  }

  @Patch(':id')
  @Roles(Role.PROFESSIONAL)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CreateServiceDto>, @CurrentUser() user: JwtPayload) {
    return this.svc.update(id, getProfessionalId(user), dto);
  }

  @Delete(':id')
  @Roles(Role.PROFESSIONAL)
  deactivate(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.svc.deactivate(id, getProfessionalId(user));
  }
}
