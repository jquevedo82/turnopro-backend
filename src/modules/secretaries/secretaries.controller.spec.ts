/**
 * secretaries.controller.spec.ts
 * Verifica que create() y resendCredentials() informan si el email de bienvenida
 * falló, en vez de responder 200 OK sin que nadie se entere (ver notifications.service.ts
 * — sendWelcomeSecretary ahora devuelve boolean en vez de swallowar en silencio).
 */
import { SecretariesController } from './secretaries.controller';

function makeController(svcOverrides: Partial<any> = {}, notificationsOverrides: Partial<any> = {}) {
  const svc = {
    create: jest.fn().mockResolvedValue({
      secretary: { id: 1, name: 'Ana López', email: 'ana@test.com' },
      resetToken: 'token123',
    }),
    findOne: jest.fn().mockResolvedValue({ id: 1, name: 'Ana López', email: 'ana@test.com' }),
    generateResetToken: jest.fn().mockResolvedValue('token456'),
    ...svcOverrides,
  };
  const notifications = {
    sendWelcomeSecretary: jest.fn().mockResolvedValue(true),
    ...notificationsOverrides,
  };
  const controller = new (SecretariesController as any)(svc, notifications);
  return { controller, svc, notifications };
}

describe('SecretariesController.create()', () => {
  it('marca emailSent=true cuando el email de bienvenida sale bien', async () => {
    const { controller } = makeController();
    const result = await controller.create(1, { name: 'Ana López', email: 'ana@test.com' });
    expect((result as any).emailSent).toBe(true);
  });

  it('marca emailSent=false sin romper la creación cuando el email falla', async () => {
    const { controller } = makeController({}, { sendWelcomeSecretary: jest.fn().mockResolvedValue(false) });
    const result = await controller.create(1, { name: 'Ana López', email: 'ana@test.com' });
    expect((result as any).emailSent).toBe(false);
    expect((result as any).id).toBe(1); // la secretaria se creó igual
  });
});

describe('SecretariesController.resendCredentials()', () => {
  it('devuelve un mensaje de error claro si el reenvío falla', async () => {
    const { controller } = makeController({}, { sendWelcomeSecretary: jest.fn().mockResolvedValue(false) });
    const result = await controller.resendCredentials(1);
    expect(result.emailSent).toBe(false);
    expect(result.message).toContain('No se pudo enviar');
  });

  it('confirma el envío cuando sale bien', async () => {
    const { controller } = makeController();
    const result = await controller.resendCredentials(1);
    expect(result.emailSent).toBe(true);
    expect(result.message).toContain('Credenciales reenviadas');
  });
});
