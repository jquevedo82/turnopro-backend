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
   * GET /clients?professionalId=X
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
}
