/**
 * organizations.controller.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Módulo: Organizations | Solo accesible por superadmin
 *
 * GET    /api/organizations                          → Lista todas las orgs
 * GET    /api/organizations/unassigned-professionals → Profesionales sin org
 * GET    /api/organizations/:id                      → Detalle org + miembros
 * POST   /api/organizations                          → Crear organización
 * PATCH  /api/organizations/:id                      → Editar organización
 * POST   /api/organizations/:id/assign/:profId       → Asignar profesional
 * DELETE /api/organizations/:id/remove/:profId       → Desvincular profesional
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, ParseIntPipe, UseGuards,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard }         from '../../common/guards/jwt-auth.guard';
import { RolesGuard }           from '../../common/guards/roles.guard';
import { Roles }                from '../../common/decorators/roles.decorator';
import { Role }                 from '../../common/roles.enum';

@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN)
export class OrganizationsController {
  constructor(private readonly svc: OrganizationsService) {}

  /**
   * GET /api/organizations
   * Lista todas las organizaciones con conteo de profesionales y secretarias.
   */
  @Get()
  findAll() {
    return this.svc.findAll();
  }

  /**
   * GET /api/organizations/unassigned-professionals
   * Profesionales que aún no pertenecen a ninguna organización.
   * Usar en el selector al asignar profesionales a una org.
   * ⚠️ Esta ruta debe ir ANTES de /:id para que Express no la confunda
   */
  @Get('unassigned-professionals')
  findUnassigned() {
    return this.svc.findUnassigned();
  }

  /**
   * GET /api/organizations/:id
   * Detalle de una organización con su lista de profesionales y secretarias.
   */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.svc.findOne(id);
  }

  /**
   * POST /api/organizations
   * Crea una nueva organización.
   * Body: { name, slug?, address?, phone?, email? }
   */
  @Post()
  create(@Body() dto: {
    name:     string;
    slug?:    string;
    address?: string;
    phone?:   string;
    email?:   string;
  }) {
    return this.svc.create(dto);
  }

  /**
   * PATCH /api/organizations/:id
   * Edita una organización existente.
   * Body: cualquier subconjunto de { name, slug, address, phone, email, isActive }
   */
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<{
      name:     string;
      slug:     string;
      address:  string;
      phone:    string;
      email:    string;
      isActive: boolean;
    }>,
  ) {
    return this.svc.update(id, dto);
  }

  /**
   * POST /api/organizations/:id/assign/:profId
   * Asigna un profesional existente a esta organización.
   * El profesional deja de ser independiente.
   */
  @Post(':id/assign/:profId')
  assignProfessional(
    @Param('id',     ParseIntPipe) orgId:          number,
    @Param('profId', ParseIntPipe) professionalId: number,
  ) {
    return this.svc.assignProfessional(orgId, professionalId);
  }

  /**
   * DELETE /api/organizations/:id/remove/:profId
   * Desvincula un profesional de la organización.
   * El profesional vuelve al modo independiente (organizationId: null).
   */
  @Delete(':id/remove/:profId')
  removeProfessional(
    @Param('id',     ParseIntPipe) orgId:          number,
    @Param('profId', ParseIntPipe) professionalId: number,
  ) {
    return this.svc.removeProfessional(orgId, professionalId);
  }
}
