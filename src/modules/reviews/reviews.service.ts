/**
 * reviews.service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Módulo: Reviews
 * Reseñas de pacientes/clientes sobre el profesional, atadas a una cita completada.
 *
 * Flujo: AppointmentsService.complete() crea la invitación automáticamente (no hay
 * botón manual de "pedir opinión" — el evento de "la cita terminó" ya es el momento
 * correcto). El cliente la completa una única vez vía token público. El profesional
 * modera (aprobar/rechazar) antes de que se vea en su página pública.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Review } from './review.entity';
import { Appointment } from '../appointments/appointment.entity';
import { Client } from '../clients/client.entity';
import { SubmitReviewDto } from './dto/submit-review.dto';
import { getVerticalConfig } from '../../config/verticals';

/** "María González" → "M. G." — cubre nombres compuestos ("De La Cruz" → "D. L. C.") */
export function toInitials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .map((word) => `${word.charAt(0).toUpperCase()}.`)
    .join(' ');
}

export interface PublicReview {
  id:          number;
  reviewerName: string;
  rating:      number;
  comment:     string;
  submittedAt: Date;
}

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
  ) {}

  /** Llamado desde AppointmentsService.complete() — nunca expuesto por endpoint propio */
  async createInviteForAppointment(appointment: Appointment, client: Client): Promise<Review> {
    const invite = this.reviewRepo.create({
      professionalId: appointment.professionalId,
      appointmentId:  appointment.id,
      token:          randomBytes(24).toString('hex'),
      reviewerName:   client.name,
      status:         'invitado',
    });
    return this.reviewRepo.save(invite);
  }

  // Abrir el link nunca lo consume (solo un envío exitoso lo pasa a "pendiente")
  async getInviteForPublic(token: string): Promise<Review> {
    const invite = await this.reviewRepo.findOne({
      where: { token },
      relations: ['professional'],
    });
    if (!invite) throw new NotFoundException('Link no válido');
    if (invite.status !== 'invitado') throw new ForbiddenException('Ya enviaste tu opinión con este link');
    return invite;
  }

  async submit(token: string, dto: SubmitReviewDto): Promise<Review> {
    const invite = await this.getInviteForPublic(token);
    await this.reviewRepo.update(invite.id, {
      rating:      dto.rating,
      comment:     dto.comment.trim(),
      status:      'pendiente',
      submittedAt: new Date(),
    });
    return this.reviewRepo.findOneOrFail({ where: { id: invite.id } });
  }

  /** Lista para moderar — todo lo que ya fue contestado, sin importar el estado */
  async findAllForProfessional(professionalId: number): Promise<Review[]> {
    return this.reviewRepo
      .createQueryBuilder('r')
      .where('r.professionalId = :professionalId', { professionalId })
      .andWhere('r.status != :invitado', { invitado: 'invitado' })
      .orderBy('r.submittedAt', 'DESC')
      .getMany();
  }

  async approve(professionalId: number, id: number): Promise<Review> {
    return this.transition(professionalId, id, 'publicada');
  }

  async reject(professionalId: number, id: number): Promise<Review> {
    return this.transition(professionalId, id, 'rechazada');
  }

  // Sin máquina de estados estricta a propósito: el profesional puede ir y volver
  // entre publicada/rechazada si se equivocó al moderar, sin borrar y repetir el pedido.
  private async transition(professionalId: number, id: number, next: 'publicada' | 'rechazada'): Promise<Review> {
    const review = await this.reviewRepo.findOne({ where: { id, professionalId } });
    if (!review) throw new NotFoundException('Reseña no encontrada');
    if (review.status === 'invitado') {
      throw new BadRequestException('Esta invitación todavía no fue contestada');
    }
    await this.reviewRepo.update(id, { status: next });
    return this.reviewRepo.findOneOrFail({ where: { id } });
  }

  /** Público: solo lo aprobado, con el nombre redactado a iniciales según el vertical */
  async getPublicPublished(professionalId: number, professionalType?: string): Promise<PublicReview[]> {
    const reviews = await this.reviewRepo.find({
      where: { professionalId, status: 'publicada' },
      order: { submittedAt: 'DESC' },
    });
    const vc = getVerticalConfig(professionalType);
    return reviews.map((r) => ({
      id:           r.id,
      reviewerName: vc.reviewerNameDisplay === 'initials' ? toInitials(r.reviewerName) : r.reviewerName,
      rating:       r.rating as number,
      comment:      r.comment as string,
      submittedAt:  r.submittedAt as Date,
    }));
  }
}
