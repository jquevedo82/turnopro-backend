/**
 * plans.controller.ts
 * GET  /api/plans         → Lista todos los planes (superadmin)
 * POST /api/plans         → Crear plan (superadmin)
 * PUT  /api/plans/:id     → Editar plan (superadmin)
 */
import { Controller, Get, Post, Put, Param, Body, UseGuards, ParseIntPipe } from '@nestjs/common';
import { PlansService }  from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { JwtAuthGuard }  from '../../common/guards/jwt-auth.guard';
import { RolesGuard }    from '../../common/guards/roles.guard';
import { Roles }         from '../../common/decorators/roles.decorator';
import { Role }          from '../../common/roles.enum';

@Controller('plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN)
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  findAll() { return this.plansService.findAll(); }

  @Post()
  create(@Body() dto: CreatePlanDto) { return this.plansService.create(dto); }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CreatePlanDto>) {
    return this.plansService.update(id, dto);
  }
}
