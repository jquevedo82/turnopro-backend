/**
 * professionals.service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Módulo: Professionals
 * Responsabilidad: CRUD de profesionales. Solo accesible por el superadmin.
 *
 * Para cambiar las reglas de activación de suscripción:
 *   Modificar activate() y isSubscriptionExpired()
 * Para cambiar el aviso de vencimiento próximo:
 *   Modificar sendSubscriptionExpiryWarnings() (cron diario)
 * Para enviar email de bienvenida al crear profesional:
 *   Inyectar NotificationsService y llamarlo en create()
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  Injectable, ConflictException, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { Cron }             from '@nestjs/schedule';
import * as bcrypt          from 'bcrypt';
import * as crypto          from 'crypto';
import { Professional }     from './professional.entity';
import { Secretary }       from '../secretaries/secretary.entity';
import { CreateProfessionalDto }  from './dto/create-professional.dto';
import { NotificationsService }   from '../notifications/notifications.service';
import { resolveTzOffsetHours, localDateString, addDays, dateOnly } from '../../common/utils/timezone';

// Rondas de salt para bcrypt. A mayor número, más seguro pero más lento.
// Para cambiar: modificar este valor. Recomendado entre 10 y 12.
const BCRYPT_ROUNDS = 10;

// Días de gracia después de subscriptionEnd antes de bloquear nuevas reservas.
// Para cambiar: variable de entorno SUBSCRIPTION_GRACE_DAYS.
const SUBSCRIPTION_GRACE_DAYS = parseInt(process.env.SUBSCRIPTION_GRACE_DAYS ?? '3', 10);

// Días de anticipación para el email de aviso de vencimiento próximo.
// Para cambiar: variable de entorno SUBSCRIPTION_WARNING_DAYS_BEFORE.
const SUBSCRIPTION_WARNING_DAYS_BEFORE = parseInt(process.env.SUBSCRIPTION_WARNING_DAYS_BEFORE ?? '5', 10);

@Injectable()
export class ProfessionalsService {
  constructor(
    @InjectRepository(Professional)
    private readonly repo:          Repository<Professional>,

    @InjectRepository(Secretary)
    private readonly secretaryRepo: Repository<Secretary>,

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
    // Verificar que el email y slug no estén en uso en professionals
    const existing = await this.repo.findOne({
      where: [{ email: dto.email }, { slug: dto.slug }],
    });
    if (existing) {
      throw new ConflictException('El email o slug ya está en uso');
    }

    // Verificar que el email no pertenezca a una secretaria
    const existingSec = await this.secretaryRepo.findOne({ where: { email: dto.email } });
    if (existingSec) {
      throw new ConflictException(`El email ${dto.email} ya está registrado como secretaria`);
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

    // Verificar que el email nuevo no pertenezca a una secretaria
    if (dto.email) {
      const existingSec = await this.secretaryRepo.findOne({ where: { email: dto.email } });
      if (existingSec) {
        throw new ConflictException(`El email ${dto.email} ya está registrado como secretaria`);
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
      // Nuevo ciclo de suscripción → el próximo aviso de vencimiento debe poder enviarse de nuevo
      subscriptionWarningSentAt: null,
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

  /**
   * True si venció la suscripción (subscriptionEnd + SUBSCRIPTION_GRACE_DAYS ya pasó),
   * calculado en la fecha-calendario LOCAL del profesional (huso resuelto por prefijo
   * de teléfono +54/+58) — no en la fecha del servidor (Render corre en UTC). Mismo
   * motivo que el fix de availability.service.ts: comparar por fecha del servidor
   * corta el acceso hasta 4hs antes/después de lo que corresponde en Argentina/Venezuela.
   *
   * No bloquea nada por sí sola — no reemplaza isActive (que sigue siendo el
   * apagado manual del superadmin). Hoy solo se usa para bloquear NUEVAS reservas
   * (ver AppointmentsService.create()); el panel, la agenda existente y el login
   * siguen funcionando aunque haya vencido — decisión de producto 2026-07-20.
   */
  isSubscriptionExpired(professional: Professional): boolean {
    if (!professional.subscriptionEnd) return false;
    const offset     = resolveTzOffsetHours(professional.phone);
    const todayLocal = localDateString(offset);
    const validThrough = addDays(dateOnly(professional.subscriptionEnd), SUBSCRIPTION_GRACE_DAYS);
    return todayLocal > validThrough;
  }

  /**
   * Cron diario: avisa por email a los profesionales cuya suscripción vence en
   * SUBSCRIPTION_WARNING_DAYS_BEFORE días (default 5), en la fecha-calendario LOCAL de cada
   * uno (mismo motivo que isSubscriptionExpired() y common/utils/timezone.ts).
   *
   * A diferencia del bloqueo de reservas nuevas (que se calcula al vuelo, sin cron), esto
   * necesita ser proactivo — no depende de que el profesional haga un request.
   *
   * Idempotente y con catch-up: usa `todayLocal >= warnDate` (no `===`), así que si el cron
   * no corre justo el día exacto (el servidor estuvo caído, por ejemplo), igual manda el
   * aviso en la próxima corrida en vez de perder la ventana en silencio.
   * `subscriptionWarningSentAt` evita reenviar una vez que ya se avisó en este ciclo — se
   * resetea a null en activate() cuando el superadmin renueva.
   */
  @Cron('0 9 * * *') // Todos los días a las 09:00hs (hora del servidor)
  async sendSubscriptionExpiryWarnings(): Promise<void> {
    const professionals = await this.repo.find({ where: { isActive: true } });

    let sent = 0;
    for (const professional of professionals) {
      if (!professional.subscriptionEnd || professional.subscriptionWarningSentAt) continue;

      const offset      = resolveTzOffsetHours(professional.phone);
      const todayLocal   = localDateString(offset);
      const endDateStr   = dateOnly(professional.subscriptionEnd);
      const warnDate     = addDays(endDateStr, -SUBSCRIPTION_WARNING_DAYS_BEFORE);
      if (todayLocal < warnDate) continue; // todavía no llegó el día de avisar

      // Ya venció del todo (o está en gracia) — no tiene sentido "avisar que vence pronto"
      if (this.isSubscriptionExpired(professional)) continue;

      try {
        const daysLeft = this.diffDays(endDateStr, todayLocal);
        await this.notifications.sendSubscriptionExpiryWarning({
          toEmail:            professional.email,
          professionalName:   professional.name,
          subscriptionEndStr: endDateStr,
          daysLeft:           Math.max(daysLeft, 0),
        });
        await this.repo.update(professional.id, { subscriptionWarningSentAt: new Date() });
        sent++;
      } catch (err) {
        console.error(`[Cron subscription warning] Error con profesional ${professional.id}: ${err.message}`);
      }
    }
    if (sent > 0) console.log(`[Cron] ${sent} avisos de vencimiento de suscripción enviados`);
  }

  /** Diferencia en días entre dos fechas 'YYYY-MM-DD' (end - from). */
  private diffDays(endDateStr: string, fromDateStr: string): number {
    const end  = new Date(endDateStr   + 'T00:00:00Z').getTime();
    const from = new Date(fromDateStr  + 'T00:00:00Z').getTime();
    return Math.round((end - from) / (24 * 3600_000));
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