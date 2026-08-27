/**
 * clients.service.spec.ts
 * Tests de findClientsPage() — paginación de GET /clients (baja conectividad:
 * antes traía la tabla completa + relations: ['appointments'] sin usar en el frontend).
 */
import { ClientsService } from './clients.service';

function makeService(findAndCountResult: [any[], number] = [[], 0]) {
  const repo = {
    find:         jest.fn(),
    findAndCount: jest.fn().mockResolvedValue(findAndCountResult),
    save: jest.fn(), create: jest.fn(),
  };
  const svc = new (ClientsService as any)(repo);
  return { svc, repo };
}

describe('ClientsService.findClientsPage()', () => {
  it('devuelve items y total con paginación default (page=1, limit=50)', async () => {
    const clients = [{ id: 1, name: 'Juan' }, { id: 2, name: 'Ana' }];
    const { svc, repo } = makeService([clients, 2]);

    const result = await svc.findClientsPage(10);

    expect(result).toEqual({ items: clients, total: 2 });
    expect(repo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
      where: { professionalId: 10 },
      skip:  0,
      take:  50,
    }));
  });

  it('calcula skip/take según page y limit personalizados', async () => {
    const { svc, repo } = makeService();

    await svc.findClientsPage(10, 3, 20); // página 3, 20 por página

    expect(repo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
      skip: 40, // (3-1) * 20
      take: 20,
    }));
  });

  it('no trae la relación appointments — el frontend no la usa', async () => {
    const { svc, repo } = makeService();

    await svc.findClientsPage(10);

    const callArgs = repo.findAndCount.mock.calls[0][0];
    expect(callArgs.relations).toBeUndefined();
  });

  it('limita el limit a un máximo de 100 aunque se pida más', async () => {
    const { svc, repo } = makeService();

    await svc.findClientsPage(10, 1, 500);

    expect(repo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
  });

  it('no permite page menor a 1', async () => {
    const { svc, repo } = makeService();

    await svc.findClientsPage(10, 0, 50);

    expect(repo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ skip: 0 }));
  });

  it('no permite limit menor a 1', async () => {
    const { svc, repo } = makeService();

    await svc.findClientsPage(10, 1, 0);

    expect(repo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ take: 1 }));
  });
});
