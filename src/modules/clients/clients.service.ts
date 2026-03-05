/**
 * clients.service.ts — Módulo: Clients
 * Los clientes se registran automáticamente al hacer su primera reserva.
 * Si ya existe el email para ese profesional, se reutiliza el registro.
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { Client }           from './client.entity';

interface FindOrCreateDto {
  professionalId: number;
  name: string;
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
   * Busca un cliente por email y profesional. Si no existe, lo crea.
   * Esto permite que el cliente reserve múltiples veces sin registrarse.
   */
  async findOrCreate(dto: FindOrCreateDto): Promise<Client> {
    let client = await this.repo.findOne({
      where: { email: dto.email, professionalId: dto.professionalId },
    });

    if (!client) {
      client = await this.repo.save(this.repo.create(dto));
    }

    return client;
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
