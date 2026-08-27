/**
 * appointments.complete.spec.ts
 * Verifica que complete() dispara la invitación de reseña automáticamente (no hay botón
 * manual de "pedir opinión" — el evento de "la cita terminó" ya es el momento correcto)
 * y que el token de esa invitación llega al email de agradecimiento.
 */
import { AppointmentsService } from './appointments.service';
import { AppointmentStatus } from './appointment-status.enum';
import { BadRequestException } from '@nestjs/common';

const client = { id: 1, name: 'Juan Pérez', email: 'juan@test.com' };
const professional = { id: 10, name: 'Dra. García', slug: 'dra-garcia' };

function makeService(overrides: { status?: AppointmentStatus } = {}) {
  const appt = { id: 5, professionalId: 10, status: overrides.status ?? AppointmentStatus.CONFIRMED, client };
  const repo = {
    findOne: jest.fn().mockResolvedValue(appt),
    update:  jest.fn().mockResolvedValue(undefined),
  };
  const professionalsService = {
    bumpQueueUpdatedAt: jest.fn().mockResolvedValue(undefined),
    findOne:            jest.fn().mockResolvedValue(professional),
  };
  const notificationsService = { notifyClientAppointmentCompleted: jest.fn().mockResolvedValue(undefined) };
  const reviewsService = {
    createInviteForAppointment: jest.fn().mockResolvedValue({ id: 1, token: 'abc123token' }),
  };
  const svc = new (AppointmentsService as any)(
    repo, {}, professionalsService, {}, {}, notificationsService, reviewsService,
  );
  return { svc, repo, professionalsService, notificationsService, reviewsService };
}

describe('AppointmentsService.complete()', () => {
  it('crea la invitación de reseña y pasa el token al email de agradecimiento', async () => {
    const { svc, notificationsService, reviewsService } = makeService();

    await svc.complete(5, 10);

    expect(reviewsService.createInviteForAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ id: 5 }),
      client,
    );
    expect(notificationsService.notifyClientAppointmentCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ id: 5 }),
      client,
      professional,
      'abc123token',
    );
  });

  it('rechaza completar una cita que no está en estado completable', async () => {
    const { svc } = makeService({ status: AppointmentStatus.PENDING });
    await expect(svc.complete(5, 10)).rejects.toThrow(BadRequestException);
  });

  it.each([
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.RECONFIRMED,
    AppointmentStatus.ARRIVED,
    AppointmentStatus.IN_PROGRESS,
  ])('acepta completar desde %s', async (status) => {
    const { svc, reviewsService } = makeService({ status });
    await svc.complete(5, 10);
    expect(reviewsService.createInviteForAppointment).toHaveBeenCalled();
  });
});
