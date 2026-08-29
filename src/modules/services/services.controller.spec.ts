/**
 * services.controller.spec.ts
 * Regresión de seguridad: mismo IDOR que en clients.controller.ts — una secretaria
 * podía pasar cualquier professionalId y leer los servicios de otra clínica sin
 * validar organización. Ahora pasa por assertAccess().
 */
import { ForbiddenException } from '@nestjs/common';
import { ServicesController } from './services.controller';
import { Role } from '../../common/roles.enum';

function makeController(svcOverrides: Partial<any> = {}, secretariesOverrides: Partial<any> = {}) {
  const svc = { findByProfessional: jest.fn().mockResolvedValue([]), ...svcOverrides };
  const secretariesSvc = { assertAccess: jest.fn().mockResolvedValue(undefined), ...secretariesOverrides };
  const controller = new (ServicesController as any)(svc, secretariesSvc);
  return { controller, svc, secretariesSvc };
}

describe('ServicesController.findAll() — acceso de secretaria', () => {
  it('valida assertAccess antes de devolver los servicios de otro profesional', async () => {
    const { controller, svc, secretariesSvc } = makeController();
    const user: any = { role: Role.SECRETARY, secretaryId: 7, sub: 7, email: 'sec@test.com', professionalId: null };

    await controller.findAll(user, '5');

    expect(secretariesSvc.assertAccess).toHaveBeenCalledWith(7, 5);
    expect(svc.findByProfessional).toHaveBeenCalledWith(5);
  });

  it('rechaza sin llegar al service si la secretaria no pertenece a la organización del profesional', async () => {
    const { controller, svc, secretariesSvc } = makeController(
      {},
      { assertAccess: jest.fn().mockRejectedValue(new ForbiddenException('No tenés acceso a este profesional')) },
    );
    const user: any = { role: Role.SECRETARY, secretaryId: 7, sub: 7, email: 'sec@test.com', professionalId: null };

    await expect(controller.findAll(user, '99')).rejects.toThrow(ForbiddenException);
    expect(svc.findByProfessional).not.toHaveBeenCalled();
  });

  it('rechaza si la secretaria no manda professionalId', async () => {
    const { controller, svc } = makeController();
    const user: any = { role: Role.SECRETARY, secretaryId: 7, sub: 7, email: 'sec@test.com', professionalId: null };

    await expect(controller.findAll(user, undefined)).rejects.toThrow(ForbiddenException);
    expect(svc.findByProfessional).not.toHaveBeenCalled();
  });

  it('un profesional usa su propio id del JWT y no pasa por assertAccess', async () => {
    const { controller, svc, secretariesSvc } = makeController();
    const user: any = { role: Role.PROFESSIONAL, sub: 3, email: 'doc@test.com', professionalId: 3 };

    await controller.findAll(user);

    expect(secretariesSvc.assertAccess).not.toHaveBeenCalled();
    expect(svc.findByProfessional).toHaveBeenCalledWith(3);
  });
});
