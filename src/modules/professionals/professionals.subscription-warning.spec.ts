/**
 * professionals.subscription-warning.spec.ts
 * Tests de sendSubscriptionExpiryWarnings() (cron) y del reset en activate().
 */
import { ProfessionalsService } from './professionals.service';
import { localDateString, addDays } from '../../common/utils/timezone';

function makeProf(overrides: Partial<any> = {}): any {
  return {
    id: 1, name: 'Dr. García', email: 'garcia@test.com', phone: '+5491112345678',
    isActive: true, subscriptionEnd: null, subscriptionWarningSentAt: null,
    ...overrides,
  };
}

function makeService(profs: any[] = []) {
  const repo = {
    find:   jest.fn().mockResolvedValue(profs),
    findOne: jest.fn(), update: jest.fn().mockResolvedValue(undefined),
    save: jest.fn(), create: jest.fn(), createQueryBuilder: jest.fn(),
  };
  const secretaryRepo = { findOne: jest.fn().mockResolvedValue(null) };
  const notifications = { sendSubscriptionExpiryWarning: jest.fn().mockResolvedValue(undefined) };
  const svc = new (ProfessionalsService as any)(repo, secretaryRepo, notifications);
  return { svc, repo, notifications };
}

describe('ProfessionalsService.sendSubscriptionExpiryWarnings()', () => {
  it('envía el aviso cuando faltan exactamente SUBSCRIPTION_WARNING_DAYS_BEFORE días (default 5)', async () => {
    const subscriptionEnd = addDays(localDateString(-3), 5); // vence en 5 días, huso Argentina
    const prof = makeProf({ subscriptionEnd });
    const { svc, repo, notifications } = makeService([prof]);

    await svc.sendSubscriptionExpiryWarnings();

    expect(notifications.sendSubscriptionExpiryWarning).toHaveBeenCalledWith(
      expect.objectContaining({ toEmail: 'garcia@test.com', subscriptionEndStr: subscriptionEnd, daysLeft: 5 }),
    );
    expect(repo.update).toHaveBeenCalledWith(1, { subscriptionWarningSentAt: expect.any(Date) });
  });

  it('NO envía si todavía faltan más días que el umbral', async () => {
    const subscriptionEnd = addDays(localDateString(-3), 10); // vence en 10 días — muy pronto para avisar
    const prof = makeProf({ subscriptionEnd });
    const { svc, notifications } = makeService([prof]);

    await svc.sendSubscriptionExpiryWarnings();

    expect(notifications.sendSubscriptionExpiryWarning).not.toHaveBeenCalled();
  });

  it('envía igual si ya se pasó el día exacto de aviso (catch-up si el cron no corrió a tiempo)', async () => {
    const subscriptionEnd = addDays(localDateString(-3), 2); // faltan 2 días, el umbral (5) ya pasó
    const prof = makeProf({ subscriptionEnd });
    const { svc, notifications } = makeService([prof]);

    await svc.sendSubscriptionExpiryWarnings();

    expect(notifications.sendSubscriptionExpiryWarning).toHaveBeenCalled();
  });

  it('NO envía dos veces en el mismo ciclo (subscriptionWarningSentAt ya seteado)', async () => {
    const subscriptionEnd = addDays(localDateString(-3), 3);
    const prof = makeProf({ subscriptionEnd, subscriptionWarningSentAt: new Date() });
    const { svc, notifications } = makeService([prof]);

    await svc.sendSubscriptionExpiryWarnings();

    expect(notifications.sendSubscriptionExpiryWarning).not.toHaveBeenCalled();
  });

  it('NO envía si la suscripción ya venció del todo (no tiene sentido avisar "vence pronto")', async () => {
    const subscriptionEnd = addDays(localDateString(-3), -10); // venció hace 10 días, ya pasó la gracia
    const prof = makeProf({ subscriptionEnd });
    const { svc, notifications } = makeService([prof]);

    await svc.sendSubscriptionExpiryWarnings();

    expect(notifications.sendSubscriptionExpiryWarning).not.toHaveBeenCalled();
  });

  it('NO envía si subscriptionEnd es null', async () => {
    const prof = makeProf({ subscriptionEnd: null });
    const { svc, notifications } = makeService([prof]);

    await svc.sendSubscriptionExpiryWarnings();

    expect(notifications.sendSubscriptionExpiryWarning).not.toHaveBeenCalled();
  });

  it('no rompe el resto del batch si falla el envío de uno', async () => {
    const subscriptionEnd = addDays(localDateString(-3), 5);
    const prof1 = makeProf({ id: 1, email: 'uno@test.com', subscriptionEnd });
    const prof2 = makeProf({ id: 2, email: 'dos@test.com', subscriptionEnd });
    const { svc, repo, notifications } = makeService([prof1, prof2]);
    notifications.sendSubscriptionExpiryWarning
      .mockRejectedValueOnce(new Error('Brevo caído'))
      .mockResolvedValueOnce(undefined);

    await svc.sendSubscriptionExpiryWarnings();

    expect(repo.update).toHaveBeenCalledTimes(1);
    expect(repo.update).toHaveBeenCalledWith(2, expect.anything());
  });
});

describe('ProfessionalsService.activate() — reset de subscriptionWarningSentAt', () => {
  it('resetea subscriptionWarningSentAt a null al renovar', async () => {
    const { svc, repo } = makeService();
    repo.findOne.mockResolvedValue(makeProf());

    await svc.activate(1, new Date('2026-09-01'));

    expect(repo.update).toHaveBeenCalledWith(1, expect.objectContaining({
      subscriptionWarningSentAt: null,
    }));
  });
});
