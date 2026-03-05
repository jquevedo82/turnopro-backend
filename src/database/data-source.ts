/**
 * data-source.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuración de TypeORM para el CLI de migraciones.
 * Se usa con los comandos:
 *   npm run migration:generate --name=nombre-migracion
 *   npm run migration:run
 *   npm run migration:revert
 *
 * Para cambiar la BD: modificar las variables en .env
 * ─────────────────────────────────────────────────────────────────────────────
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv    from 'dotenv';
dotenv.config();

export const AppDataSource = new DataSource({
  type:        'mysql',
  host:        process.env.DB_HOST     || 'localhost',
  port:        parseInt(process.env.DB_PORT || '3306'),
  username:    process.env.DB_USER     || 'root',
  password:    process.env.DB_PASS     || '',
  database:    process.env.DB_NAME     || 'turnopro_db',
  entities:    ['src/**/*.entity.ts'],
  migrations:  ['src/database/migrations/*.ts'],
  synchronize: false, // SIEMPRE false en el CLI de migraciones
  charset:     'utf8mb4',
});
