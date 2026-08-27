import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { JwtAuthGuard }   from '../../common/guards/jwt-auth.guard';
import { RolesGuard }     from '../../common/guards/roles.guard';
import { Roles }          from '../../common/decorators/roles.decorator';
import { Role }           from '../../common/roles.enum';
import { CurrentUser }    from '../../common/decorators/current-user.decorator';
import { JwtPayload, getProfessionalId } from '../auth/jwt.strategy';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientsController {
  constructor(private readonly svc: ClientsService) {}

  /**
   * GET /clients?professionalId=X&page=1&limit=50
   * Secretaria pasa professionalId del profesional activo.
   * Profesional no pasa nada — se usa su propio id del JWT.
   */
  @Get()
  @Roles(Role.PROFESSIONAL, Role.SECRETARY)
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('professionalId') professionalId?: string,
    @Query('page')  page?: string,
    @Query('limit') limit?: string,
  ) {
    const id = user.role === Role.SECRETARY && professionalId
      ? Number(professionalId)
      : getProfessionalId(user);
    return this.svc.findClientsPage(id, Number(page) || 1, Number(limit) || 50);
  }

  @Get('my')
  @Roles(Role.PROFESSIONAL)
  findMy(
    @CurrentUser() user: JwtPayload,
    @Query('page')  page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.findClientsPage(getProfessionalId(user), Number(page) || 1, Number(limit) || 50);
  }
}
