/**
 * storage.service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Servicio de almacenamiento de archivos con doble estrategia:
 *
 *   STORAGE=cloudinary → sube a Cloudinary (Render / hosting sin filesystem persistente)
 *   STORAGE=local      → guarda en uploads/ local (VPS / servidor propio)
 *
 * Para migrar de Render a servidor propio: cambiar STORAGE=local en .env
 * El resto del sistema no cambia.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Injectable, BadRequestException } from '@nestjs/common';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@Injectable()
export class StorageService {

  private readonly strategy = process.env.STORAGE || 'cloudinary';

  /**
   * Sube un archivo y retorna la URL pública.
   * @param file     — Buffer del archivo
   * @param mimetype — MIME type (ej: image/jpeg)
   * @param folder   — Carpeta destino (ej: 'avatars')
   * @returns        — URL pública del archivo
   */
  async upload(file: Buffer, mimetype: string, folder = 'avatars'): Promise<string> {
    this.validateImage(mimetype);

    if (this.strategy === 'local') {
      return this.uploadLocal(file, mimetype, folder);
    }
    return this.uploadCloudinary(file, mimetype, folder);
  }

  /**
   * Elimina un archivo por su URL pública.
   * Solo aplica si la URL pertenece al storage activo.
   */
  async delete(url: string): Promise<void> {
    if (!url) return;

    if (this.strategy === 'local' && url.includes('/uploads/')) {
      this.deleteLocal(url);
    } else if (this.strategy === 'cloudinary' && url.includes('cloudinary')) {
      await this.deleteCloudinary(url);
    }
  }

  // ── Cloudinary ────────────────────────────────────────────────────────────

  private async uploadCloudinary(file: Buffer, mimetype: string, folder: string): Promise<string> {
    const cloudinary = await this.getCloudinary();

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder:         `turnopro/${folder}`,
          resource_type:  'image',
          transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
        },
        (error, result) => {
          if (error || !result) return reject(new BadRequestException('Error al subir imagen a Cloudinary'));
          resolve(result.secure_url);
        },
      );
      uploadStream.end(file);
    });
  }

  private async deleteCloudinary(url: string): Promise<void> {
    try {
      const cloudinary = await this.getCloudinary();
      // Extraer public_id de la URL de Cloudinary
      const parts    = url.split('/');
      const filename = parts[parts.length - 1].split('.')[0];
      const folder   = parts[parts.length - 2];
      await cloudinary.uploader.destroy(`turnopro/${folder}/${filename}`);
    } catch {
      // No bloquear si falla el delete
    }
  }

  private async getCloudinary() {
    const cloudinaryUrl = process.env.CLOUDINARY_URL;
    if (!cloudinaryUrl) {
      throw new BadRequestException('CLOUDINARY_URL no configurada en las variables de entorno');
    }
    const { v2: cloudinary } = await import('cloudinary');
    cloudinary.config({ cloudinary_url: cloudinaryUrl });
    return cloudinary;
  }

  // ── Local ────────────────────────────────────────────────────────────────

  private uploadLocal(file: Buffer, mimetype: string, folder: string): string {
    const uploadDir = join(process.cwd(), 'uploads', folder);

    // Crear carpeta si no existe
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }

    const ext      = this.mimeToExt(mimetype);
    const filename = `${uuidv4()}${ext}`;
    const filepath = join(uploadDir, filename);

    writeFileSync(filepath, file);

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    return `${appUrl}/uploads/${folder}/${filename}`;
  }

  private deleteLocal(url: string): void {
    try {
      const appUrl   = process.env.APP_URL || 'http://localhost:3000';
      const filepath = join(process.cwd(), url.replace(appUrl, ''));
      if (existsSync(filepath)) unlinkSync(filepath);
    } catch {
      // No bloquear si falla el delete
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private validateImage(mimetype: string): void {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(mimetype)) {
      throw new BadRequestException('Solo se permiten imágenes JPG, PNG o WebP');
    }
  }

  private mimeToExt(mimetype: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg':  '.jpg',
      'image/png':  '.png',
      'image/webp': '.webp',
    };
    return map[mimetype] || '.jpg';
  }
}