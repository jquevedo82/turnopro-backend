import { AuthController } from './auth.controller';
import { AuthService }    from './auth.service';
import { Test }           from '@nestjs/testing';

const mockAuthService = { login: jest.fn(), forgotPassword: jest.fn(), resetPassword: jest.fn() };

function getThrottleLimit(method: Function, name: string): number | undefined {
  return Reflect.getMetadata(`THROTTLER:LIMIT${name}`, method);
}
function getThrottleTtl(method: Function, name: string): number | undefined {
  return Reflect.getMetadata(`THROTTLER:TTL${name}`, method);
}

describe('AuthController — rate limiting', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();
    controller = module.get<AuthController>(AuthController);
  });

  it('login tiene @Throttle con límite de 5 requests por minuto', () => {
    expect(getThrottleLimit(controller.login, 'default')).toBe(5);
    expect(getThrottleTtl(controller.login, 'default')).toBe(60000);
  });

  it('forgotPassword tiene @Throttle con límite de 3 requests por minuto', () => {
    expect(getThrottleLimit(controller.forgotPassword, 'default')).toBe(3);
    expect(getThrottleTtl(controller.forgotPassword, 'default')).toBe(60000);
  });

  it('resetPassword NO tiene throttle propio (usa el global de 20/min)', () => {
    expect(getThrottleLimit(controller.resetPassword, 'default')).toBeUndefined();
  });
});
