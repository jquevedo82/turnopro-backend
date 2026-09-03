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

describe('AuthService — login profesional', () => {
  beforeEach(() => {
    mockSecretariesService.validateSecretary.mockResolvedValue(null);
  });

  it('incluye el país configurado en la respuesta de login', async () => {
    const password = 'password-correcto';
    mockRepo.findOne.mockResolvedValue({
      id: 5,
      email: 'doc@turnopro.com',
      password: await bcrypt.hash(password, 10),
      isActive: true,
      name: 'Dra. García',
      slug: 'dra-garcia',
      professionalType: 'health',
      country: '+58',
      autoConfirm: false,
    });

    const service = await buildService();
    const result  = await service.login({ email: 'doc@turnopro.com', password });

    expect(result.user.country).toBe('+58');
    expect(result.user.autoConfirm).toBe(false); // el frontend decide con esto si muestra "Pendientes"
  });
});

describe('AuthService — resetPassword', () => {
  it('rechaza contraseña de menos de 10 caracteres', async () => {
    const service = await buildService();
    await expect(service.resetPassword('token', 'corta123')).rejects.toThrow(
      'La contraseña debe tener al menos 10 caracteres',
    );
  });

  it('rechaza contraseña vacía', async () => {
    const service = await buildService();
    await expect(service.resetPassword('token', '')).rejects.toThrow(
      'La contraseña debe tener al menos 10 caracteres',
    );
  });
});
