import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository }  from '@nestjs/typeorm';
import { Repository }        from 'typeorm';
import { Plan }              from './plan.entity';
import { CreatePlanDto }     from './dto/create-plan.dto';

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
  ) {}

  findAll(): Promise<Plan[]> {
    return this.planRepo.find({ where: { isActive: true }, order: { price: 'ASC' } });
  }

  async findOne(id: number): Promise<Plan> {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException(`Plan #${id} no encontrado`);
    return plan;
  }

  create(dto: CreatePlanDto): Promise<Plan> {
    return this.planRepo.save(this.planRepo.create(dto));
  }

  async update(id: number, dto: Partial<CreatePlanDto>): Promise<Plan> {
    await this.planRepo.update(id, dto);
    return this.findOne(id);
  }

  deactivate(id: number): Promise<Plan> {
    return this.update(id, { isActive: false });
  }
}
