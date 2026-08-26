/**
 * public.controller.spec.ts
 * Verifica el fix del 2026-08-26: GET /public/:slug no incluía `professionalType` en la
 * respuesta — la página pública nunca podía adaptar "Paciente/Cliente" ni "Cita/Turno/
 * Sesión" por vertical porque el dato ni siquiera llegaba al frontend, sin importar lo
 * que hiciera BookingForm/BookingSuccess del lado del cliente.
 */
import { PublicController } from './public.controller';

function makeController(professionalOverrides: Partial<any> = {}, reviewsServiceOverrides: Partial<any> = {}) {
  const professionalsService = {
    findBySlug: jest.fn().mockResolvedValue({
      id: 1, name: 'Dra. García', profession: 'Médica', slug: 'dra-garcia',
      slogan: null, bio: null, address: null, phone: null, publicEmail: null,
      country: null, avatar: null, logo: null, instagram: null, facebook: null, gallery: [],
      professionalType: 'beauty',
      ...professionalOverrides,
    }),
  };
  const servicesService = {};
  const appointmentsService = {};
  const reviewsService = { getPublicPublished: jest.fn().mockResolvedValue([]), ...reviewsServiceOverrides };
  return new (PublicController as any)(professionalsService, servicesService, appointmentsService, reviewsService);
}

describe('PublicController.getProfile()', () => {
  it('incluye professionalType en la respuesta pública', async () => {
    const controller = makeController({ professionalType: 'beauty' });
    const result = await controller.getProfile('dra-garcia');
    expect(result.professionalType).toBe('beauty');
  });

  it('nunca expone campos sensibles (password, subscriptionEnd)', async () => {
    const controller = makeController({ password: 'hash', subscriptionEnd: '2026-01-01' });
    const result = await controller.getProfile('dra-garcia');
    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('subscriptionEnd');
  });
});

describe('PublicController.getPublicReviews()', () => {
  it('pide las reseñas publicadas pasando el id y el vertical del profesional', async () => {
    const getPublicPublished = jest.fn().mockResolvedValue([{ id: 1, reviewerName: 'M. G.', rating: 5, comment: 'Excelente', submittedAt: new Date() }]);
    const controller = makeController({ id: 42, professionalType: 'health' }, { getPublicPublished });

    const result = await controller.getPublicReviews('dra-garcia');

    expect(getPublicPublished).toHaveBeenCalledWith(42, 'health');
    expect(result).toHaveLength(1);
  });
});
