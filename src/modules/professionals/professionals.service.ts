/**
 * professionals.service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Módulo: Professionals
 * Responsabilidad: CRUD de profesionales. Solo accesible por el superadmin.
 *
 * Para cambiar las reglas de activación de suscripción:
 *   Modificar activate() y checkSubscriptions()
 * Para enviar email de bienvenida al crear profesional:
 *   Inyectar NotificationsService y llamarlo en create()
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  Injectable, ConflictException, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import * as bcrypt          from 'bcrypt';
import * as crypto          from 'crypto';
import { Professional }     from './professional.entity';
import { CreateProfessionalDto }  from './dto/create-professional.dto';
import { NotificationsService }   from '../notifications/notifications.service';

// Rondas de salt para bcrypt. A mayor número, más seguro pero más lento.
// Para cambiar: modificar este valor. Recomendado entre 10 y 12.
const BCRYPT_ROUNDS = 10;

@Injectable()
export class ProfessionalsService {
  constructor(
    @InjectRepository(Professional)
    private readonly repo:          Repository<Professional>,
    private readonly notifications: NotificationsService,
  ) {}

  /** Retorna todos los profesionales con su plan. Para filtrar activos: agregar where: { isActive: true } */
  findAll(): Promise<Professional[]> {
    return this.repo.find({
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Professional> {
    const prof = await this.repo.findOne({ where: { id }, relations: ['plan'] });
    if (!prof) throw new NotFoundException(`Profesional #${id} no encontrado`);
    return prof;
  }

  /** Busca por slug para la página pública. Solo retorna activos. */
  async findBySlug(slug: string): Promise<Professional> {
    const prof = await this.repo.findOne({
      where: { slug, isActive: true },
      relations: ['services'],
    });
    if (!prof) throw new NotFoundException(`Profesional '${slug}' no encontrado o inactivo`);
    return prof;
  }

  /**
   * Crea un nuevo profesional desde el panel superadmin.
   * Hashea la contraseña antes de guardar.
   * Para enviar email de bienvenida: agregar llamada a NotificationsService aquí.
   */
  async create(dto: CreateProfessionalDto): Promise<Professional> {
    // Verificar que el email y slug no estén en uso
    const existing = await this.repo.findOne({
      where: [{ email: dto.email }, { slug: dto.slug }],
    });
    if (existing) {
      throw new ConflictException('El email o slug ya está en uso');
    }

    // Contraseña inicial fija: 'turnopro' — el profesional la cambia en su primer ingreso
    const rawPassword    = dto.password || 'turnopro';
    const hashedPassword = await bcrypt.hash(rawPassword, BCRYPT_ROUNDS);

    const professional = this.repo.create({
      ...dto,
      password: hashedPassword,
    });

    const saved = await this.repo.save(professional);

    // Generar token de configuración de contraseña (expira en 24hs)
    const resetToken  = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.repo.update(saved.id, {
      resetToken,
      resetTokenExpiry: resetExpiry,
    });

    // Enviar email de bienvenida con link para configurar contraseña
    try {
      await this.notifications.sendWelcomeProfessional({
        toEmail:          saved.email,
        professionalName: saved.name,
        email:            saved.email,
        resetToken,
        slug:             saved.slug,
      });
      console.log('Email de bienvenida enviado a:', saved.email);
    } catch (err: any) {
      console.error('=== ERROR EMAIL BIENVENIDA ===');
      console.error('Destinatario:', saved.email);
      console.error('Mensaje:', err?.message);
      console.error('Código:', err?.code);
      console.error('Response:', err?.response);
      console.error('Stack:', err?.stack);
      console.error('==============================');
    }

    return saved;
  }

  /** Regenera el token de configuración y reenvía el email de bienvenida */
  async resendWelcome(id: number): Promise<{ message: string }> {
    const professional = await this.findOne(id);
    const resetToken   = crypto.randomBytes(32).toString('hex');
    const resetExpiry  = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.repo.update(id, { resetToken, resetTokenExpiry: resetExpiry });
    await this.notifications.sendWelcomeProfessional({
      toEmail:          professional.email,
      professionalName: professional.name,
      email:            professional.email,
      resetToken,
      slug:             professional.slug,
    });
    return { message: `Email de configuración reenviado a ${professional.email}` };
  }

  /** Actualiza datos del profesional. Para campos restringidos: agregar validaciones aquí. */
  async update(id: number, dto: Partial<CreateProfessionalDto>): Promise<Professional> {
    await this.findOne(id); // Verifica que exista

    // Verificar que el slug o email nuevo no estén en uso por OTRO profesional
    if (dto.slug || dto.email) {
      const conditions: any[] = [];
      if (dto.slug)  conditions.push({ slug:  dto.slug });
      if (dto.email) conditions.push({ email: dto.email });

      const conflict = await this.repo.findOne({ where: conditions });
      if (conflict && conflict.id !== id) {
        const field = conflict.slug === dto.slug ? 'slug' : 'email';
        throw new ConflictException(`El ${field} ya está en uso por otro profesional`);
      }
    }

    // Si se actualiza la contraseña, hashearla
    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    }

    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  /**
   * Activa la suscripción del profesional.
   * Habilita su página pública automáticamente.
   * Para cambiar la lógica de activación: modificar este método.
   */
  async activate(id: number, subscriptionEnd: Date): Promise<Professional> {
    await this.repo.update(id, {
      isActive:          true,
      subscriptionStart: new Date(),
      subscriptionEnd,
    });
    return this.findOne(id);
  }

  /**
   * Desactiva la suscripción. La página pública deja de estar accesible.
   * El profesional no puede loguearse hasta reactivar.
   */
  async deactivate(id: number): Promise<Professional> {
    await this.repo.update(id, { isActive: false });
    return this.findOne(id);
  }

  async changePassword(id: number, currentPassword: string, newPassword: string) {
    const prof = await this.repo.findOne({ where: { id } });
    if (!prof) throw new NotFoundException('Profesional no encontrado');

    const valid = await bcrypt.compare(currentPassword, prof.password);
    if (!valid) throw new BadRequestException('La contraseña actual es incorrecta');

    if (!newPassword || newPassword.length < 6)
      throw new BadRequestException('La nueva contraseña debe tener al menos 6 caracteres');

    prof.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.repo.save(prof);
    return { message: 'Contraseña actualizada correctamente' };
  }

  async updateAvatar(id: number, avatarUrl: string): Promise<void> {
    await this.repo.update(id, { avatar: avatarUrl });
  }

  /** Actualiza el timestamp de la cola — se llama cada vez que cambia el estado de un paciente en sala. */
  async bumpQueueUpdatedAt(professionalId: number): Promise<void> {
    await this.repo.update(professionalId, { queueUpdatedAt: new Date() });
  }
}