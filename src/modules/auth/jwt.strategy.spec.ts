import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';

const makeConfig = (secret?: string) => ({
  get: jest.fn().mockReturnValue(secret),
}) as unknown as ConfigService;

describe('JwtStrategy', () => {
  it('debe instanciarse correctamente cuando JWT_SECRET está definido', () => {
    expect(() => new JwtStrategy(makeConfig('mi-secreto-seguro'))).not.toThrow();
  });

  it('debe lanzar error si JWT_SECRET no está definido', () => {
    expect(() => new JwtStrategy(makeConfig(undefined))).toThrow(
      'JWT_SECRET no está definido en las variables de entorno',
    );
  });

  it('debe lanzar error si JWT_SECRET es string vacío', () => {
    expect(() => new JwtStrategy(makeConfig(''))).toThrow(
      'JWT_SECRET no está definido en las variables de entorno',
    );
  });
});
