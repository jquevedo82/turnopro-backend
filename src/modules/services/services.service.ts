/**
 * services.service.ts — Módulo: Services
 * Gestión de servicios que ofrece cada profesional.
 * Para agregar lógica de precios o duraciones dinámicas: modificar aquí.
 */
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { Service }          from './service.entity';
import { CreateServiceDto } from './dto/create-service.dto';

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private readonly repo: Repository<Service>,
  ) {}

  /** Retorna los servicios activos de un profesional */
  findByProfessional(professionalId: number): Promise<Service[]> {
    return this.repo.find({
      where: { professionalId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  /** Retorna todos los servicios de un profesional (incluye inactivos) */
  findAllByProfessional(professionalId: number): Promise<Service[]> {
    return this.repo.find({
      where: { professionalId },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Service> {
    const service = await this.repo.findOne({ where: { id } });
    if (!service) throw new NotFoundException(`Servicio #${id} no encontrado`);
    return service;
  }

  create(dto: CreateServiceDto): Promise<Service> {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: number, professionalId: number, dto: Partial<CreateServiceDto>): Promise<Service> {
    const service = await this.findOne(id);
    // Verifica que el servicio pertenezca al profesional que hace la petición
    if (service.professionalId !== professionalId) throw new ForbiddenException();
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  /** Desactiva sin borrar para preservar historial de citas */
  async deactivate(id: number, professionalId: number): Promise<Service> {
    return this.update(id, professionalId, { isActive: false });
  }
}
