import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('responde ok:true y toca la base de datos (para que Aiven tampoco se duerma)', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue([{ 1: 1 }]) };
    const controller = new (HealthController as any)(dataSource);

    const result = await controller.check();

    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
    expect(result).toEqual({ ok: true });
  });
});
