/**
 * organizations.service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Módulo: Organizations
 * Responsabilidad: CRUD de organizaciones y asignación de profesionales.
 *
 * Solo el superadmin consume este servicio (via OrganizationsController).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository }       from 'typeorm';
import { Organization }     from './organization.entity';
import { Professional }     from '../professionals/professional.entity';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,

    @InjectRepository(Professional)
    private readonly professionalRepo: Repository<Professional>,
  ) {}

  // ── CRUD Organizaciones ───────────────────────────────────────────────────

  /** Devuelve todas las organizaciones con cantidad de profesionales y secretarias */
  async findAll(): Promise<any[]> {
    const orgs = await this.orgRepo.find({
      relations: ['secretaries'],
      order: { createdAt: 'DESC' },
    });

    // Enriquecer con cantidad de profesionales (query separada para no joinear todo)
    return Promise.all(orgs.map(async (org) => {
      const profCount = await this.professionalRepo.count({
        where: { organizationId: org.id },
      });
      return {
        ...org,
        professionalsCount: profCount,
        secretariesCount:   org.secretaries?.length ?? 0,
      };
    }));
  }

  /** Devuelve una organización con sus profesionales y secretarias */
  async findOne(id: number): Promise<Organization & { professionals: Professional[] }> {
    const org = await this.orgRepo.findOne({
      where: { id },
      relations: ['secretaries'],
    });
    if (!org) throw new NotFoundException(`Organización ${id} no encontrada`);

    const professionals = await this.professionalRepo.find({
      where: { organizationId: id },
      select: ['id', 'name', 'email', 'slug', 'profession', 'isActive'],
    });

    return { ...org, professionals } as any;
  }

  /** Crea una nueva organización */
  async create(dto: {
    name:     string;
    slug?:    string;
    address?: string;
    phone?:   string;
    email?:   string;
  }): Promise<Organization> {
    // Verificar slug único si se provee
    if (dto.slug) {
      const existing = await this.orgRepo.findOne({ where: { slug: dto.slug } });
      if (existing) throw new ConflictException(`El slug "${dto.slug}" ya está en uso`);
    }

    const org = this.orgRepo.create(dto);
    return this.orgRepo.save(org);
  }

  /** Actualiza datos de una organización */
  async update(id: number, dto: Partial<{
    name:     string;
    slug:     string;
    address:  string;
    phone:    string;
    email:    string;
    isActive: boolean;
  }>): Promise<Organization> {
    const org = await this.orgRepo.findOne({ where: { id } });
    if (!org) throw new NotFoundException(`Organización ${id} no encontrada`);

    if (dto.slug && dto.slug !== org.slug) {
      const existing = await this.orgRepo.findOne({ where: { slug: dto.slug } });
      if (existing) throw new ConflictException(`El slug "${dto.slug}" ya está en uso`);
    }

    Object.assign(org, dto);
    return this.orgRepo.save(org);
  }

  // ── Asignación de profesionales ───────────────────────────────────────────

  /**
   * Asigna un profesional existente a una organización.
   * El profesional pasa de independiente (organizationId: null) a miembro de la org.
   * Si ya pertenecía a otra org, se reasigna.
   */
  async assignProfessional(orgId: number, professionalId: number): Promise<{ message: string }> {
    const org = await this.orgRepo.findOne({ where: { id: orgId } });
    if (!org) throw new NotFoundException(`Organización ${orgId} no encontrada`);

    const professional = await this.professionalRepo.findOne({ where: { id: professionalId } });
    if (!professional) throw new NotFoundException(`Profesional ${professionalId} no encontrado`);

    await this.professionalRepo.update(professionalId, { organizationId: orgId });
    return { message: `${professional.name} asignado a ${org.name}` };
  }

  /**
   * Desvincula un profesional de su organización.
   * Vuelve al modo independiente (organizationId: null).
   * No borra ni modifica ninguna cita ni cliente histórico.
   */
  async removeProfessional(orgId: number, professionalId: number): Promise<{ message: string }> {
    const professional = await this.professionalRepo.findOne({
      where: { id: professionalId, organizationId: orgId },
    });
    if (!professional) {
      throw new NotFoundException(`El profesional ${professionalId} no pertenece a la organización ${orgId}`);
    }

    await this.professionalRepo.update(professionalId, { organizationId: null as any });
    return { message: `${professional.name} desvinculado. Ahora es profesional independiente.` };
  }

  /**
   * Devuelve todos los profesionales SIN organización asignada.
   * Útil para el selector del superadmin al asignar profesionales a una org.
   */
  async findUnassigned(): Promise<Professional[]> {
    return this.professionalRepo.find({
      where: { organizationId:  IsNull()},
      select: ['id', 'name', 'email', 'slug', 'profession', 'isActive'],
      order: { name: 'ASC' },
    });
  }
}
