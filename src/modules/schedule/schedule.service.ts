import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository }  from '@nestjs/typeorm';
import { Repository }        from 'typeorm';
import { ProfessionalSchedule } from './professional-schedule.entity';
import { ScheduleException }    from './schedule-exception.entity';
import { CreateScheduleDto, CreateExceptionDto } from './dto/create-schedule.dto';

@Injectable()
export class ScheduleService {
  constructor(
    @InjectRepository(ProfessionalSchedule)
    private readonly scheduleRepo: Repository<ProfessionalSchedule>,
    @InjectRepository(ScheduleException)
    private readonly exceptionRepo: Repository<ScheduleException>,
  ) {}

  getWeeklySchedule(professionalId: number): Promise<ProfessionalSchedule[]> {
    return this.scheduleRepo.find({ where: { professionalId }, order: { dayOfWeek: 'ASC' } });
  }

  async upsertDay(professionalId: number, dto: CreateScheduleDto): Promise<ProfessionalSchedule> {
    const existing = await this.scheduleRepo.findOne({
      where: { professionalId, dayOfWeek: dto.dayOfWeek },
    });

    if (existing) {
      await this.scheduleRepo.update(existing.id, dto);
      const updated = await this.scheduleRepo.findOne({ where: { id: existing.id } });
      if (!updated) throw new NotFoundException('Schedule no encontrado');
      return updated;
    }

    return this.scheduleRepo.save(this.scheduleRepo.create({ ...dto, professionalId }));
  }

  getExceptions(professionalId: number): Promise<ScheduleException[]> {
    return this.exceptionRepo
      .createQueryBuilder('e')
      .where('e.professionalId = :professionalId', { professionalId })
      .andWhere('e.date >= CURDATE()')
      .orderBy('e.date', 'ASC')
      .getMany();
  }

  createException(professionalId: number, dto: CreateExceptionDto): Promise<ScheduleException> {
    return this.exceptionRepo.save(this.exceptionRepo.create({ ...dto, professionalId }));
  }

  async deleteException(id: number, professionalId: number): Promise<void> {
    const exception = await this.exceptionRepo.findOne({ where: { id, professionalId } });
    if (!exception) throw new NotFoundException('Excepción no encontrada');
    await this.exceptionRepo.remove(exception);
  }

  getExceptionForDate(professionalId: number, date: string): Promise<ScheduleException | null> {
    return this.exceptionRepo.findOne({ where: { professionalId, date } });
  }
}
