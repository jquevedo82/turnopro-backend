/**
 * jwt.strategy.ts
 * FIX: Usa ConfigService para leer JWT_SECRET en vez de process.env directo,
 * garantizando que el .env ya esté cargado cuando se instancia la estrategia.
 */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy }  from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService }     from '@nestjs/config';

export interface JwtPayload {
  sub:            number;
  email:          string;
  role:           string;
  professionalId: number | null;
}

export function getProfessionalId(user: JwtPayload): number {
  if (user.professionalId === null || user.professionalId === undefined) {
    throw new Error('Este endpoint requiere rol profesional');
  }
  return user.professionalId;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // ConfigService ya tiene el .env cargado al llegar acá
      secretOrKey: config.get<string>('JWT_SECRET') || 'fallback_secret_cambiar',
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.sub === undefined || payload.sub === null) throw new UnauthorizedException('Token inválido');
    return payload;
  }
}
