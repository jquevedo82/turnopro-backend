/**
 * professionals.controller.ts
 *
 * Endpoints superadmin:
 *   GET    /api/professionals          → Lista todos
 *   GET    /api/professionals/:id      → Detalle
 *   POST   /api/professionals          → Crear
 *   PATCH  /api/professionals/:id      → Editar
 *   POST   /api/professionals/:id/activate   → Activar suscripción
 *   POST   /api/professionals/:id/deactivate → Desactivar
 *
 * Endpoints del profesional autenticado:
 *   GET    /api/professionals/me       → Ver mi propio perfil
 *   PATCH  /api/professionals/me       → Actualizar mi propio perfil
 */
import {
  Controller, Get, Post, Patch, Body, Param,
  UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { ProfessionalsService }   from './professionals.service';
import { CreateProfessionalDto }  from './dto/create-professional.dto';
import { UpdateProfileDto }       from './dto/update-profile.dto';
import { JwtAuthGuard }           from '../../common/guards/jwt-auth.guard';
import { RolesGuard }             from '../../common/guards/roles.guard';
import { Roles }                  from '../../common/decorators/roles.decorator';
import { Role }                   from '../../common/roles.enum';
import { CurrentUser }            from '../../common/decorators/current-user.decorator';
import { JwtPayload, getProfessionalId } from '../auth/jwt.strategy';

// ── Endpoints superadmin ──────────────────────────────────────────────────────
@Controller('professionals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProfessionalsController {
  constructor(private readonly svc: ProfessionalsService) {}

  // ── Ruta /me ANTES de /:id para que Express no la interprete como id="me" ──

  /** Profesional autenticado ve su propio perfil */
  @Get('me')
  @Roles(Role.PROFESSIONAL)
  getMe(@CurrentUser() user: JwtPayload) {
    return this.svc.findOne(getProfessionalId(user));
  }

  /**
   * Profesional autenticado actualiza su propio perfil.
   * Usa UpdateProfileDto que excluye campos sensibles (email, password, isActive, etc.)
   */
  @Patch('me')
  @Roles(Role.PROFESSIONAL)
  updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.svc.update(getProfessionalId(user), dto);
  }

  // ── Superadmin ────────────────────────────────────────────────────────────

  @Get()
  @Roles(Role.SUPERADMIN)
  findAll() { return this.svc.findAll(); }

  @Get(':id')
  @Roles(Role.SUPERADMIN)
  findOne(@Param('id', ParseIntPipe) id: number) { return this.svc.findOne(id); }

  @Post()
  @Roles(Role.SUPERADMIN)
  create(@Body() dto: CreateProfessionalDto) { return this.svc.create(dto); }

  @Patch(':id')
  @Roles(Role.SUPERADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CreateProfessionalDto>) {
    return this.svc.update(id, dto);
  }

  @Post(':id/activate')
  @Roles(Role.SUPERADMIN)
  activate(
    @Param('id', ParseIntPipe) id: number,
    @Body('subscriptionEnd') subscriptionEnd: Date,
  ) { return this.svc.activate(id, subscriptionEnd); }

  @Post(':id/deactivate')
  @Roles(Role.SUPERADMIN)
  deactivate(@Param('id', ParseIntPipe) id: number) { return this.svc.deactivate(id); }
}
