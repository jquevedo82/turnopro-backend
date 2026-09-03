/**
 * health.controller.ts
 * GET /api/health — para UptimeRobot (mismo patrón que TuCatálogo), que evita que
 * Render duerma la instancia por inactividad (plan gratuito: 15 min).
 *
 * Toca la base de datos a propósito (no es un simple "200 OK" estático) — Aiven en
 * plan gratuito también puede pausarse por inactividad, así que el ping debe
 * mantener viva la conexión real, no solo el proceso de Node.
 *
 * Importante además de la latencia: los cron jobs de este backend
 * (recordatorio 20:00hs, aviso de vencimiento 09:00hs) corren DENTRO del mismo
 * proceso — si Render lo puso a dormir, el cron simplemente no se dispara, no
 * hay nada corriendo que lo dispare. Mantener la instancia despierta es lo que
 * garantiza que esos dos emails automáticos existan de verdad.
 */
import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Public()
  @Get()
  async check() {
    await this.dataSource.query('SELECT 1');
    return { ok: true };
  }
}
