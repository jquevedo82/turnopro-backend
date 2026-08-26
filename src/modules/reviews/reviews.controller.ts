import { Controller, Get, Post, Patch, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { SubmitReviewDto } from './dto/submit-review.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/roles.enum';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload, getProfessionalId } from '../auth/jwt.strategy';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly svc: ReviewsService) {}

  // ── Endpoints públicos (link de la invitación) ────────────────────────────

  @Public()
  @Get('token/:token')
  getByToken(@Param('token') token: string) {
    return this.svc.getInviteForPublic(token);
  }

  @Public()
  @Post('token/:token/submit')
  submit(@Param('token') token: string, @Body() dto: SubmitReviewDto) {
    return this.svc.submit(token, dto);
  }

  // ── Endpoints del profesional (moderación) ────────────────────────────────
  // Sin soporte de secretaria en esta primera versión — moderar reseñas públicas
  // es una decisión que el profesional mantiene para sí mismo.

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL)
  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.svc.findAllForProfessional(getProfessionalId(user));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL)
  @Patch(':id/approve')
  approve(@CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) id: number) {
    return this.svc.approve(getProfessionalId(user), id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL)
  @Patch(':id/reject')
  reject(@CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) id: number) {
    return this.svc.reject(getProfessionalId(user), id);
  }
}
