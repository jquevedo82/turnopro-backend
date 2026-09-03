/**
 * professionals.controller.spec.ts
 * shareLink() — mismo bug de ParseIntPipe + ValidationPipe global que
 * appointments.controller.ts (ver ese archivo para el detalle completo):
 * un profesional (no secretaria) nunca manda professionalId, y el pipe viejo
 * convertía ese ausente en NaN antes de llegar a chequear "es opcional",
 * tirando 400 siempre. "Compartir página" por email estaba roto para todo
 * profesional desde que se agregó este endpoint.
 */
import { ProfessionalsController } from './professionals.controller';
import { Role } from '../../common/roles.enum';

function makeController() {
  const svc = { findOne: jest.fn().mockResolvedValue({ id: 10, name: 'Dra. García', slug: 'dra-garcia' }) };
  const notificationsService = { sendShareLink: jest.fn().mockResolvedValue(undefined) };
  const storageService = {};
  const secretariesService = { assertAccess: jest.fn().mockResolvedValue(undefined) };
  const controller = new (ProfessionalsController as any)(svc, notificationsService, storageService, secretariesService);
  return { controller, svc, notificationsService, secretariesService };
}

const professionalUser: any = { sub: 10, role: Role.PROFESSIONAL, professionalId: 10 };
const secretaryUser: any = { sub: 7, role: Role.SECRETARY, secretaryId: 7, professionalId: null };

describe('ProfessionalsController.shareLink() — regresión del bug de ParseIntPipe', () => {
  it('un profesional comparte su propia página cuando professionalId no vino en el query (undefined real)', async () => {
    const { controller, svc, secretariesService } = makeController();

    const result = await controller.shareLink(professionalUser, 'destino@test.com', undefined);

    expect(svc.findOne).toHaveBeenCalledWith(10);
    expect(secretariesService.assertAccess).not.toHaveBeenCalled();
    expect(result).toEqual({ message: 'Email enviado correctamente' });
  });

  it('una secretaria con professionalId como string crudo lo convierte a number y valida acceso', async () => {
    const { controller, svc, secretariesService } = makeController();

    await controller.shareLink(secretaryUser, 'destino@test.com', '5');

    expect(secretariesService.assertAccess).toHaveBeenCalledWith(7, 5);
    expect(svc.findOne).toHaveBeenCalledWith(5);
  });
});
