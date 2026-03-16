/**
 * auth.service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Módulo: Auth
 * Responsabilidad: Autenticación de usuarios (superadmin, profesionales y secretarias).
 *   - Login unificado: verifica superadmin → secretaria → profesional en ese orden
 *   - Generación de tokens JWT diferenciados por rol
 *   - Validación de credenciales y recuperación de contraseña
 *
 * Para cambiar la duración del token: modificar JWT_EXPIRY en el .env
 * Para agregar datos al token: modificar el objeto payload en signToken()
 * Para cambiar el algoritmo de hash: modificar las llamadas a bcrypt
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService }       from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import * as bcrypt          from 'bcrypt';
import * as crypto          from 'crypto';
import { Professional }     from '../professionals/professional.entity';
import { LoginDto }         from './dto/login.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { SecretariesService }   from '../secretaries/secretaries.service';

// Superadmin hardcodeado temporalmente.
// Para producción: crear tabla de admins en la BD y manejar aquí
const SUPERADMIN = {
  id:    0,
  email: process.env.SUPERADMIN_EMAIL || 'admin@turnopro.com',
  role:  'superadmin',
};

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Professional)
    private readonly professionalRepo: Repository<Professional>,
    private readonly jwtService:          JwtService,
    private readonly notifications:       NotificationsService,
    private readonly secretariesService:  SecretariesService,
  ) {}

  /**
   * Login unificado para superadmin, secretarias y profesionales.
   * Orden de verificación:
   *   1. Superadmin (hardcodeado en env)
   *   2. Secretaria (tabla secretaries)
   *   3. Profesional (tabla professionals)
   *
   * @param dto - { email, password }
   * @returns { accessToken, user: { id, email, role, ... } }
   * @throws UnauthorizedException si las credenciales son incorrectas
   */
  async login(dto: LoginDto) {
    // ── 1. Verificar si es el superadmin ─────────────────────────────────────
    if (dto.email === process.env.SUPERADMIN_EMAIL) {
      const validPass = await bcrypt.compare(dto.password, process.env.SUPERADMIN_HASH || '');
      if (!validPass) throw new UnauthorizedException('Credenciales incorrectas');

      return {
        accessToken: this.signToken({
          sub:            0,
          email:          dto.email,
          role:           'superadmin',
          professionalId: null,
        }),
        user: { id: 0, email: dto.email, role: 'superadmin' },
      };
    }

    // ── 2. Verificar si es una secretaria ────────────────────────────────────
    const secretary = await this.secretariesService.validateSecretary(dto.email, dto.password);
    if (secretary) {
      // Obtener profesionales disponibles para mostrar en el selector
      const professionals = await this.secretariesService.getProfessionalsForSecretary(secretary.id);

      return {
        accessToken: this.signToken({
          sub:            secretary.id,
          email:          secretary.email,
          role:           'secretary',
          secretaryId:    secretary.id,
          organizationId: secretary.organizationId,
        }),
        user: {
          id:             secretary.id,
          email:          secretary.email,
          role:           'secretary',
          name:           secretary.name,
          organizationId: secretary.organizationId,
          professionals,  // lista para el selector "Trabajando como..."
        },
      };
    }

    // ── 3. Verificar si es un profesional ────────────────────────────────────
    const professional = await this.professionalRepo.findOne({
      where: { email: dto.email },
    });

    if (!professional) throw new UnauthorizedException('Credenciales incorrectas');

    // Verificar que la suscripción esté activa
    if (!professional.isActive) {
      throw new UnauthorizedException('Tu suscripción está inactiva. Contactá al administrador.');
    }

    // Verificar contraseña con bcrypt
    const validPass = await bcrypt.compare(dto.password, professional.password);
    if (!validPass) throw new UnauthorizedException('Credenciales incorrectas');

    return {
      accessToken: this.signToken({
        sub:            professional.id,
        email:          professional.email,
        role:           'professional',
        professionalId: professional.id,
      }),
      user: {
        id:    professional.id,
        email: professional.email,
        role:  'professional',
        name:  professional.name,
        slug:  professional.slug,
      },
    };
  }

  /**
   * POST /api/auth/forgot-password
   * Genera un token de recuperación y envía el email.
   * Busca primero en profesionales — si no encuentra, no hace nada
   * (no revela si el email existe).
   */
  async forgotPassword(email: string): Promise<void> {
    const professional = await this.professionalRepo.findOne({ where: { email } });
    if (!professional) return;

    const token  = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await this.professionalRepo.update(professional.id, {
      resetToken:       token,
      resetTokenExpiry: expiry,
    });

    await this.notifications.sendPasswordReset({
      toEmail: professional.email,
      name:    professional.name,
      token,
    });
  }

  /**
   * POST /api/auth/reset-password
   * Valida el token y actualiza la contraseña.
   * Funciona tanto para profesionales como para secretarias.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 6)
      throw new BadRequestException('La contraseña debe tener al menos 6 caracteres');

    // Intentar con profesional primero
    const professional = await this.professionalRepo.findOne({
      where: { resetToken: token },
    });

    if (professional) {
      if (!professional.resetTokenExpiry || professional.resetTokenExpiry < new Date())
        throw new BadRequestException('El link de recuperación expiró. Solicitá uno nuevo.');

      const hashed = await bcrypt.hash(newPassword, 10);
      await this.professionalRepo.update(professional.id, {
        password:         hashed,
        resetToken:       null as any,
        resetTokenExpiry: null as any,
      });
      return;
    }

    // Si no fue profesional, intentar con secretaria
    await this.secretariesService.resetPassword(token, newPassword);
  }

  /**
   * Genera un token JWT con el payload del usuario.
   * Para agregar más datos al token: agregar campos al objeto payload.
   * Para cambiar expiración: modificar JWT_EXPIRY en el .env
   */
  private signToken(payload: object): string {
    return this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_EXPIRY || '7d',
    });
  }
}
