import { Controller, Get, UseGuards }  from '@nestjs/common';
import { ClientsService } from './clients.service';
import { JwtAuthGuard }   from '../../common/guards/jwt-auth.guard';
import { RolesGuard }     from '../../common/guards/roles.guard';
import { Roles }          from '../../common/decorators/roles.decorator';
import { Role }           from '../../common/roles.enum';
import { CurrentUser }    from '../../common/decorators/current-user.decorator';
import { JwtPayload, getProfessionalId } from '../auth/jwt.strategy';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PROFESSIONAL)
export class ClientsController {
  constructor(private readonly svc: ClientsService) {}

  @Get('my')
  findMy(@CurrentUser() user: JwtPayload) {
    return this.svc.findByProfessional(getProfessionalId(user));
  }
}
