import { AuthService }    from './auth.service';
import { JwtService }     from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Professional }   from '../professionals/professional.entity';
import { Test }           from '@nestjs/testing';
import { NotificationsService } from '../notifications/notifications.service';
import { SecretariesService }   from '../secretaries/secretaries.service';
import * as bcrypt from 'bcrypt';

const mockRepo              = { findOne: jest.fn() };
const mockJwtService        = { sign: jest.fn().mockReturnValue('token-mock') };
const mockNotifications     = {};
const mockSecretariesService = { validateSecretary: jest.fn(), getProfessionalsForSecretary: jest.fn() };

async function buildService() {
  const module = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: JwtService,             useValue: mockJwtService },
      { provide: NotificationsService,   useValue: mockNotifications },
      { provide: SecretariesService,     useValue: mockSecretariesService },
      { provide: getRepositoryToken(Professional), useValue: mockRepo },
    ],
  }).compile();
  return module.get<AuthService>(AuthService);
}

describe('AuthService — login superadmin', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    mockSecretariesService.validateSecretary.mockResolvedValue(null);
  });

  afterAll(() => { process.env = originalEnv; });

  it('debe lanzar error si SUPERADMIN_HASH no está definido', async () => {
    process.env.SUPERADMIN_EMAIL = 'admin@turnopro.com';
    delete process.env.SUPERADMIN_HASH;

    const service = await buildService();
    await expect(
      service.login({ email: 'admin@turnopro.com', password: 'cualquier' }),
    ).rejects.toThrow('SUPERADMIN_HASH no está definido');
  });

  it('debe rechazar con credenciales incorrectas cuando SUPERADMIN_HASH está definido', async () => {
    process.env.SUPERADMIN_EMAIL = 'admin@turnopro.com';
    process.env.SUPERADMIN_HASH  = await bcrypt.hash('password-correcto', 10);

    const service = await buildService();
    await expect(
      service.login({ email: 'admin@turnopro.com', password: 'password-incorrecto' }),
    ).rejects.toThrow('Credenciales incorrectas');
  });

  it('debe retornar token cuando las credenciales del superadmin son correctas', async () => {
    const password = 'password-correcto';
    process.env.SUPERADMIN_EMAIL = 'admin@turnopro.com';
    process.env.SUPERADMIN_HASH  = await bcrypt.hash(password, 10);

    const service = await buildService();
    const result  = await service.login({ email: 'admin@turnopro.com', password });

    expect(result.accessToken).toBe('token-mock');
    expect(result.user.role).toBe('superadmin');
  });
});
