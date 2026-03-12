/**
 * auth.module.ts
 * FIX: Cambiado JwtModule.register() por JwtModule.registerAsync()
 * para asegurarse de que process.env.JWT_SECRET esté cargado DESPUÉS
 * de que ConfigModule inicialice el .env. Con register() podía leer
 * undefined y firmar con 'fallback_secret', causando 401 al verificar.
 */
import { Module }        from '@nestjs/common';
import { JwtModule }     from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService }    from './auth.service';
import { JwtStrategy }   from './jwt.strategy';
import { Professional }      from '../professionals/professional.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    PassportModule,
    // registerAsync garantiza que ConfigService ya tiene el .env cargado
    JwtModule.registerAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:      config.get<string>('JWT_SECRET') || 'fallback_secret_cambiar',
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRY') || '7d' },
      }),
    }),
    TypeOrmModule.forFeature([Professional]),
    NotificationsModule,
  ],
  controllers: [AuthController],
  providers:   [AuthService, JwtStrategy],
  exports:     [AuthService, JwtModule],
})
export class AuthModule {}