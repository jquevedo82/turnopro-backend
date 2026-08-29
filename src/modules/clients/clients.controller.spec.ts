/**
 * clients.controller.spec.ts
 * Regresión de seguridad: antes del fix, una secretaria podía pasar cualquier
 * professionalId por query string y el controller devolvía los clientes de
 * ESE profesional sin validar que perteneciera a su organización — un IDOR
 * que exponía nombre/email/teléfono de pacientes de cualquier clínica del
 * sistema a cualquier secretaria autenticada. Ahora pasa por assertAccess(),
 * mismo patrón que resolveProffesionalId() en appointments.controller.ts.
 */
import { ForbiddenException } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { Role } from '../../common/roles.enum';

function makeController(svcOverrides: Partial<any> = {}, secretariesOverrides: Partial<any> = {}) {
  const svc = { findClientsPage: jest.fn().mockResolvedValue({ items: [], total: 0 }), ...svcOverrides };
  const secretariesSvc = { assertAccess: jest.fn().mockResolvedValue(undefined), ...secretariesOverrides };
  const controller = new (ClientsController as any)(svc, secretariesSvc);
  return { controller, svc, secretariesSvc };
}

describe('ClientsController.findAll() — acceso de secretaria', () => {
  it('valida assertAccess antes de devolver los clientes de otro profesional', async () => {
    const { controller, svc, secretariesSvc } = makeController();
    const user: any = { role: Role.SECRETARY, secretaryId: 7, sub: 7, email: 'sec@test.com', professionalId: null };

    await controller.findAll(user, '5', '1', '50');

    expect(secretariesSvc.assertAccess).toHaveBeenCalledWith(7, 5);
    expect(svc.findClientsPage).toHaveBeenCalledWith(5, 1, 50);
  });

  it('rechaza sin llegar al service si la secretaria no pertenece a la organización del profesional', async () => {
    const { controller, svc, secretariesSvc } = makeController(
      {},
      { assertAccess: jest.fn().mockRejectedValue(new ForbiddenException('No tenés acceso a este profesional')) },
    );
    const user: any = { role: Role.SECRETARY, secretaryId: 7, sub: 7, email: 'sec@test.com', professionalId: null };

    await expect(controller.findAll(user, '99')).rejects.toThrow(ForbiddenException);
    expect(svc.findClientsPage).not.toHaveBeenCalled();
  });

  it('rechaza si la secretaria no manda professionalId', async () => {
    const { controller, svc } = makeController();
    const user: any = { role: Role.SECRETARY, secretaryId: 7, sub: 7, email: 'sec@test.com', professionalId: null };

    await expect(controller.findAll(user, undefined)).rejects.toThrow(ForbiddenException);
    expect(svc.findClientsPage).not.toHaveBeenCalled();
  });

  it('un profesional usa su propio id del JWT y no pasa por assertAccess', async () => {
    const { controller, svc, secretariesSvc } = makeController();
    const user: any = { role: Role.PROFESSIONAL, sub: 3, email: 'doc@test.com', professionalId: 3 };

    await controller.findAll(user);

    expect(secretariesSvc.assertAccess).not.toHaveBeenCalled();
    expect(svc.findClientsPage).toHaveBeenCalledWith(3, 1, 50);
  });
});
