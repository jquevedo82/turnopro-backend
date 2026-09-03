/**
 * appointments.controller.spec.ts
 * Bug real de producción (2026-09-03): "Hoy", "Mañana", "Pendientes" y todos los
 * demás endpoints de este controller devolvían 400 para CUALQUIER profesional
 * (no secretaria) — el ValidationPipe global (main.ts, transform:true) coacciona
 * un query ?: number ausente con `+value`, y `+undefined` da NaN, no undefined.
 * `new ParseIntPipe({ optional: true })` nunca detectaba ese NaN como "ausente"
 * (no es nil) y siempre lanzaba "Validation failed (numeric string is expected)"
 * ANTES de que el controller pudiera ejecutar nada — resolveProffesionalId()
 * nunca se llegaba a correr para el profesional, aunque internamente ignora
 * profId para ese rol. Confirmado con requests HTTP reales contra datos de
 * producción reales (no solo mocks): sin este fix, un profesional autenticado
 * nunca podía ver su propia agenda.
 * Fix: professionalId llega como string crudo (sin ParseIntPipe) y se convierte
 * a number dentro de resolveProffesionalId(), evitando que el ValidationPipe
 * global lo toque (su coerción automática solo aplica a metatype Number).
 */
import { ForbiddenException } from '@nestjs/common';
import { resolveProffesionalId } from './appointments.controller';
import { Role } from '../../common/roles.enum';

function makeSecretariesSvc(overrides: Partial<any> = {}): any {
  return { assertAccess: jest.fn().mockResolvedValue(undefined), ...overrides };
}

const professionalUser: any = { sub: 10, email: 'doc@test.com', role: Role.PROFESSIONAL, professionalId: 10 };
const secretaryUser: any = { sub: 7, email: 'sec@test.com', role: Role.SECRETARY, secretaryId: 7, professionalId: null };

describe('resolveProffesionalId() — regresión del bug de ParseIntPipe + ValidationPipe global', () => {
  it('un profesional resuelve a su propio id del JWT cuando professionalId no vino en el query (caso real: undefined, no un string)', async () => {
    const secretariesSvc = makeSecretariesSvc();

    const result = await resolveProffesionalId(professionalUser, secretariesSvc, undefined);

    expect(result).toBe(10);
    expect(secretariesSvc.assertAccess).not.toHaveBeenCalled();
  });

  it('una secretaria con professionalId como string crudo (tal como llega de la URL) lo convierte a number y valida acceso', async () => {
    const secretariesSvc = makeSecretariesSvc();

    const result = await resolveProffesionalId(secretaryUser, secretariesSvc, '5');

    expect(result).toBe(5);
    expect(secretariesSvc.assertAccess).toHaveBeenCalledWith(7, 5);
  });

  it('una secretaria sin professionalId es rechazada con ForbiddenException, no con un 400 de validación', async () => {
    const secretariesSvc = makeSecretariesSvc();

    await expect(resolveProffesionalId(secretaryUser, secretariesSvc, undefined)).rejects.toThrow(ForbiddenException);
    expect(secretariesSvc.assertAccess).not.toHaveBeenCalled();
  });

  it('propaga el rechazo si la secretaria no tiene acceso a ese profesional', async () => {
    const secretariesSvc = makeSecretariesSvc({
      assertAccess: jest.fn().mockRejectedValue(new ForbiddenException('No tenés acceso a este profesional')),
    });

    await expect(resolveProffesionalId(secretaryUser, secretariesSvc, '99')).rejects.toThrow(ForbiddenException);
  });
});
