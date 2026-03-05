/**
 * superadmin.module.ts
 * El panel superadmin reutiliza los módulos existentes con guards de rol.
 * No requiere lógica adicional ya que ProfessionalsModule y PlansModule
 * ya tienen sus endpoints protegidos con @Roles(Role.SUPERADMIN).
 */
import { Module } from '@nestjs/common';

@Module({})
export class SuperadminModule {}
