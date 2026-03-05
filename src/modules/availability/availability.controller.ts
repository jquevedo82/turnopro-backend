/**
 * GET /api/availability/:professionalId/:date          → Slots del día
 * GET /api/availability/:professionalId/month/:year/:month → Días disponibles del mes
 */
import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { Public }              from '../../common/decorators/public.decorator';

@Controller('availability')
export class AvailabilityController {
  constructor(private readonly svc: AvailabilityService) {}

  /** Endpoint público — El cliente lo llama desde la página de reservas */
  @Public()
  @Get(':professionalId/:date')
  getSlots(
    @Param('professionalId', ParseIntPipe) professionalId: number,
    @Param('date') date: string,
    @Query('serviceId') serviceId?: number,
  ) {
    return this.svc.getAvailableSlots(professionalId, date, serviceId);
  }

  @Public()
  @Get(':professionalId/month/:year/:month')
  getAvailableDays(
    @Param('professionalId', ParseIntPipe) professionalId: number,
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
  ) {
    return this.svc.getAvailableDaysInMonth(professionalId, year, month);
  }
}
