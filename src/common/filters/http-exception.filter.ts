/**
 * http-exception.filter.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Filtro global que centraliza el formato de las respuestas de error HTTP.
 * Todos los errores del sistema tendrán este formato estándar:
 * {
 *   statusCode: 400,
 *   message:    "Descripción del error",
 *   error:      "Bad Request",
 *   timestamp:  "2026-03-05T10:00:00.000Z",
 *   path:       "/api/appointments"
 * }
 *
 * Para personalizar el formato de error: modificar el objeto response de este archivo.
 * Para agregar logging de errores a una base de datos o servicio externo: agregar aquí.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx      = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request  = ctx.getRequest<Request>();
    const status   = exception.getStatus
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = exception.getResponse() as any;

    // Formato estándar de error para toda la API
    response.status(status).json({
      statusCode: status,
      message:    exceptionResponse?.message || exception.message,
      error:      exceptionResponse?.error   || 'Error',
      timestamp:  new Date().toISOString(),
      path:       request.url,
    });
  }
}
