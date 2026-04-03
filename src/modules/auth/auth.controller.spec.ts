import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService }    from './auth.service';

const mockAuthService = {
  login:         jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword:  jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('debe instanciarse correctamente', () => {
    expect(controller).toBeDefined();
  });

  it('NO debe tener el método mailCheck (endpoint eliminado por seguridad)', () => {
    expect((controller as any).mailCheck).toBeUndefined();
  });

  it('debe tener los endpoints legítimos: login, forgotPassword, resetPassword', () => {
    expect(typeof controller.login).toBe('function');
    expect(typeof controller.forgotPassword).toBe('function');
    expect(typeof controller.resetPassword).toBe('function');
  });
});
