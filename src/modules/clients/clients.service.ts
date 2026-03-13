/**
 * clients.service.ts — Módulo: Clients
 * Los clientes se identifican por (professionalId + email + nombre normalizado).
 * Esto permite que una familia use el mismo email para distintos pacientes:
 *   - "Juan García" + familia@mail.com → Cliente A
 *   - "María García" + familia@mail.com → Cliente B (mismo email, distinto cliente)
 *   - "Juan García" reserva de nuevo  → mismo Cliente A, actualiza teléfono si cambió
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { Client }           from './client.entity';

interface FindOrCreateDto {
  professionalId: number;
  name:  string;
  email: string;
  phone: string;
}

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly repo: Repository<Client>,
  ) {}

  /**
   * Normaliza un nombre para comparación:
   * "  Juan  García " → "juan garcía"
   * Evita duplicados por mayúsculas o espacios extra.
   */
  private normalizeName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Busca un cliente por (professionalId + email + nombre normalizado).
   * - Si no existe → lo crea.
   * - Si existe → actualiza teléfono si cambió.
   * - Mismo email + nombre distinto → crea cliente nuevo (familiar).
   */
  async findOrCreate(dto: FindOrCreateDto): Promise<Client> {
    const normalizedName = this.normalizeName(dto.name);

    // Buscar todos los clientes con mismo email y profesional
    const candidates = await this.repo.find({
      where: { email: dto.email, professionalId: dto.professionalId },
    });

    // Encontrar por nombre normalizado
    const existing = candidates.find(
      (c) => this.normalizeName(c.name) === normalizedName,
    );

    if (!existing) {
      // Nuevo cliente o familiar con mismo email pero distinto nombre
      return this.repo.save(this.repo.create({
        professionalId: dto.professionalId,
        name:  dto.name.trim(),
        email: dto.email,
        phone: dto.phone,
      }));
    }

    // Cliente encontrado — actualizar teléfono si cambió
    if (dto.phone && dto.phone !== existing.phone) {
      await this.repo.update(existing.id, { phone: dto.phone });
      return this.repo.findOne({ where: { id: existing.id } }) as Promise<Client>;
    }

    return existing;
  }

  /** Retorna todos los clientes de un profesional con su historial */
  findByProfessional(professionalId: number): Promise<Client[]> {
    return this.repo.find({
      where: { professionalId },
      relations: ['appointments'],
      order: { name: 'ASC' },
    });
  }
}