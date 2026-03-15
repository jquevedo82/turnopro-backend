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
  role:           'superadmin' | 'professional' | 'secretary';
  // Solo presente en tokens de profesional
  professionalId: number | null;
  // Solo presente en tokens de secretaria
  secretaryId?:    number;
  organizationId?: number;
}

export function getProfessionalId(user: JwtPayload): number {
  if (user.professionalId === null || user.professionalId === undefined) {
    throw new Error('Este endpoint requiere rol profesional');
  }
  return user.professionalId;
}

export function getSecretaryId(user: JwtPayload): number {
  if (!user.secretaryId) {
    throw new Error('Este endpoint requiere rol secretaria');
  }
  return user.secretaryId;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') || 'fallback_secret_cambiar',
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.sub === undefined || payload.sub === null) throw new UnauthorizedException('Token inválido');
    return payload;
  }
}
