import { Controller, Get, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { JwtAuthGuard }   from '../../common/guards/jwt-auth.guard';
import { RolesGuard }     from '../../common/guards/roles.guard';
import { Roles }          from '../../common/decorators/roles.decorator';
import { Role }           from '../../common/roles.enum';
import { CurrentUser }    from '../../common/decorators/current-user.decorator';
import { JwtPayload, getProfessionalId, getSecretaryId } from '../auth/jwt.strategy';
import { SecretariesService } from '../secretaries/secretaries.service';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientsController {
  constructor(
    private readonly svc:            ClientsService,
    private readonly secretariesSvc: SecretariesService,
  ) {}

  /**
   * GET /clients?professionalId=X&page=1&limit=50
   * Secretaria pasa professionalId del profesional activo — se valida que
   * pertenezca a su organización antes de devolver ningún dato de clientes,
   * mismo patrón que resolveProffesionalId() en appointments.controller.ts.
   * Profesional no pasa nada — se usa su propio id del JWT.
   */
  @Get()
  @Roles(Role.PROFESSIONAL, Role.SECRETARY)
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('professionalId') professionalId?: string,
    @Query('page')  page?: string,
    @Query('limit') limit?: string,
  ) {
    let id: number;
    if (user.role === Role.SECRETARY) {
      if (!professionalId) throw new ForbiddenException('La secretaria debe indicar professionalId');
      id = Number(professionalId);
      await this.secretariesSvc.assertAccess(getSecretaryId(user), id);
    } else {
      id = getProfessionalId(user);
    }
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
