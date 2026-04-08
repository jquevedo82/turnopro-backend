/**
 * secretaries.service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Módulo: Secretaries
 * Responsabilidad: CRUD de secretarias y validación de acceso.
 *
 * El superadmin crea/gestiona secretarias.
 * El AuthService consume validateSecretary() para el login.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import * as bcrypt          from 'bcrypt';
import * as crypto          from 'crypto';
import { Secretary }        from './secretary.entity';
import { Professional }     from '../professionals/professional.entity';

@Injectable()
export class SecretariesService {
  constructor(
    @InjectRepository(Secretary)
    private readonly secretaryRepo: Repository<Secretary>,

    @InjectRepository(Professional)
    private readonly professionalRepo: Repository<Professional>,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  /** Lista todas las secretarias de una organización */
  async findByOrg(organizationId: number): Promise<Secretary[]> {
    return this.secretaryRepo.find({
      where:  { organizationId },
      select: ['id', 'name', 'email', 'phone', 'isActive', 'createdAt'],
      order:  { name: 'ASC' },
    });
  }

  /** Detalle de una secretaria */
  async findOne(id: number): Promise<Secretary> {
    const secretary = await this.secretaryRepo.findOne({ where: { id } });
    if (!secretary) throw new NotFoundException(`Secretaria ${id} no encontrada`);
    return secretary;
  }

  /**
   * Crea una secretaria vinculada a una organización.
   * La contraseña se deja nullable — se configura via link de bienvenida
   * con el mismo mecanismo de reset-password que usan los profesionales.
   */
  async create(dto: {
    name:           string;
    email:          string;
    phone?:         string;
    organizationId: number;
  }): Promise<{ secretary: Secretary; resetToken: string }> {
    // Email único entre secretarias y profesionales
    const existingSec  = await this.secretaryRepo.findOne({ where: { email: dto.email } });
    if (existingSec) throw new ConflictException(`El email ${dto.email} ya está registrado como secretaria`);

    const existingProf = await this.professionalRepo.findOne({ where: { email: dto.email } });
    if (existingProf) throw new ConflictException(`El email ${dto.email} ya está registrado como profesional`);

    // Generar token para que configure su contraseña via email
    const resetToken  = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 horas

    const defaultPassword = await bcrypt.hash('turnopro', 10);

    const secretary = this.secretaryRepo.create({
      ...dto,
      password:         defaultPassword, // clave inicial: 'turnopro' — cambiar en primer ingreso
      resetToken,
      resetTokenExpiry: resetExpiry,
    });

    const saved = await this.secretaryRepo.save(secretary);
    return { secretary: saved, resetToken };
  }

  /**
   * Actualiza datos de una secretaria (superadmin).
   * Si se cambia el email, valida que no esté en uso por otra secretaria ni profesional.
   * Retorna { secretary, emailChanged } para que el controller envíe la notificación.
   */
  async update(id: number, dto: Partial<{
    name:     string;
    email:    string;
    phone:    string;
    isActive: boolean;
  }>): Promise<{ secretary: Secretary; emailChanged: boolean }> {
    const secretary = await this.findOne(id);

    if (dto.email && dto.email !== secretary.email) {
      const existingSec  = await this.secretaryRepo.findOne({ where: { email: dto.email } });
      if (existingSec)  throw new ConflictException(`El email ${dto.email} ya está registrado como secretaria`);

      const existingProf = await this.professionalRepo.findOne({ where: { email: dto.email } });
      if (existingProf) throw new ConflictException(`El email ${dto.email} ya está registrado como profesional`);
    }

    const emailChanged = !!dto.email && dto.email !== secretary.email;
    Object.assign(secretary, dto);
    const saved = await this.secretaryRepo.save(secretary);
    return { secretary: saved, emailChanged };
  }

  /** Activa o desactiva una secretaria */
  async setActive(id: number, isActive: boolean): Promise<{ message: string }> {
    const secretary = await this.findOne(id);
    await this.secretaryRepo.update(id, { isActive });
    const estado = isActive ? 'activada' : 'desactivada';
    return { message: `Secretaria ${secretary.name} ${estado}` };
  }

  // ── Validación de acceso (usada por AuthService) ──────────────────────────

  /**
   * Valida credenciales de una secretaria para el login.
   * Retorna la secretaria si las credenciales son válidas.
   */
  async validateSecretary(email: string, password: string): Promise<Secretary | null> {
    const secretary = await this.secretaryRepo.findOne({
      where:    { email },
      select:   ['id', 'name', 'email', 'password', 'isActive', 'organizationId'],
    });

    if (!secretary) return null;
    if (!secretary.isActive) return null;
    if (!secretary.password) return null; // Todavía no configuró contraseña

    const valid = await bcrypt.compare(password, secretary.password);
    if (!valid) return null;

    return secretary;
  }

  /**
   * Verifica que una secretaria tenga acceso a operar un profesional.
   * Regla: el profesional debe pertenecer a la misma organización que la secretaria.
   *
   * @throws ForbiddenException si no tiene acceso
   */
  async assertAccess(secretaryId: number, professionalId: number): Promise<void> {
    const secretary = await this.secretaryRepo.findOne({ where: { id: secretaryId } });
    if (!secretary) throw new ForbiddenException('Secretaria no encontrada');

    const professional = await this.professionalRepo.findOne({ where: { id: professionalId } });
    if (!professional) throw new NotFoundException('Profesional no encontrado');

    if (professional.organizationId !== secretary.organizationId) {
      throw new ForbiddenException('No tenés acceso a este profesional');
    }
  }

  /**
   * Devuelve los profesionales de la organización de la secretaria.
   * Es la lista que aparece en el selector "Trabajando como..."
   */
  async getProfessionalsForSecretary(secretaryId: number): Promise<Professional[]> {
    const secretary = await this.secretaryRepo.findOne({ where: { id: secretaryId } });
    if (!secretary) throw new NotFoundException('Secretaria no encontrada');

    return this.professionalRepo.find({
      where:  { organizationId: secretary.organizationId, isActive: true },
      select: ['id', 'name', 'profession', 'slug', 'avatar', 'professionalType'],
      order:  { name: 'ASC' },
    });
  }

  // ── Reset de contraseña (mismo mecanismo que profesionales) ──────────────

  /** Valida el token y actualiza la contraseña de la secretaria */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const secretary = await this.secretaryRepo.findOne({ where: { resetToken: token } });

    if (!secretary)
      throw new NotFoundException('El link no es válido');

    if (!secretary.resetTokenExpiry || secretary.resetTokenExpiry < new Date())
      throw new ForbiddenException('El link expiró. Pedí al administrador que reenvíe las credenciales.');

    const hashed = await bcrypt.hash(newPassword, 10);

    await this.secretaryRepo.update(secretary.id, {
      password:         hashed,
      resetToken:       null as any,
      resetTokenExpiry: null as any,
    });
  }

  /** Genera un nuevo token de reset (para reenvío de credenciales desde superadmin) */
  async generateResetToken(id: number): Promise<string> {
    const token  = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 horas

    await this.secretaryRepo.update(id, {
      resetToken:       token,
      resetTokenExpiry: expiry,
    });

    return token;
  }
}