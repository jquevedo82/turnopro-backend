/**
 * notifications.service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Módulo: Notifications
 * Responsabilidad: Envío de emails y generación de links WhatsApp.
 *
 * FASE 1 (implementación actual): Email con Nodemailer + links wa.me
 * FASE 2 (futura): Reemplazar wa.me por Twilio o WPPConnect para envíos automáticos.
 *
 * Para cambiar el proveedor de email:
 *   Modificar createTransport() en el constructor.
 *   Para SendGrid: usar nodemailer-sendgrid-transport
 *   Para Resend: usar su SDK directamente
 *
 * Para agregar un nuevo tipo de notificación:
 *   1. Crear el método sendX() en este servicio
 *   2. Crear el template HTML en buildXEmailTemplate()
 *   3. Llamar el método desde appointments.service.ts en el momento correcto
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';
import * as nodemailer        from 'nodemailer';
import { NotificationLog }    from './notification-log.entity';
import { Appointment }        from '../appointments/appointment.entity';
import { Client }             from '../clients/client.entity';
import { Professional }       from '../professionals/professional.entity';
import { Service }            from '../services/service.entity';

@Injectable()
export class NotificationsService {
  private readonly logger     = new Logger(NotificationsService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly appUrl     = process.env.APP_URL || 'http://localhost:5173';

  constructor(
    @InjectRepository(NotificationLog)
    private readonly logRepo: Repository<NotificationLog>,
  ) {
    // ── Configurar transporte de email ────────────────────────────────────
    // Para cambiar a otro proveedor: reemplazar este objeto de configuración
    // Para Gmail: activar "Contraseñas de aplicación" en la cuenta Google
    this.transporter = nodemailer.createTransport({
      host:   process.env.MAIL_HOST || 'smtp.gmail.com',
      port:   parseInt(process.env.MAIL_PORT || '587'),
      secure: false, // true para puerto 465, false para otros
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });
  }

  /**
   * Envía la confirmación de cita al cliente.
   * Incluye todos los detalles de la cita y el link de gestión.
   * Para modificar el contenido del email: editar buildConfirmationTemplate()
   */
  async sendAppointmentConfirmation(
    appointment: Appointment,
    client:       Client,
    professional: Professional,
    service:      Service,
  ): Promise<void> {
    const managementLink = `${this.appUrl}/cita/${appointment.token}`;
    const cancelLink     = `${this.appUrl}/cita/${appointment.token}/cancelar`;
    const isPending      = appointment.status === 'pending';

    const html = this.buildConfirmationTemplate({
      clientName:       client.name,
      professionalName: professional.name,
      serviceName:      service.name,
      date:             appointment.date,
      time:             appointment.startTime,
      managementLink,
      cancelLink,
      isPending,
    });

    await this.sendEmail({
      to:      client.email,
      subject: isPending
        ? `Tu solicitud de cita con ${professional.name} fue recibida`
        : `Tu cita con ${professional.name} está confirmada ✅`,
      html,
    });

    await this.logNotification(appointment.id, 'email', 'confirmation');
  }

  /**
   * Genera el link de WhatsApp pre-cargado para que el profesional
   * contacte al cliente desde su panel.
   *
   * @returns URL wa.me con mensaje pre-cargado
   * No requiere API de WhatsApp. Funciona con cualquier número.
   */
  generateWhatsAppReminderLink(
    clientPhone:  string,
    clientName:   string,
    professional: Professional,
    appointment:  Appointment,
  ): string {
    const confirmLink = `${this.appUrl}/cita/${appointment.token}/reconfirmar`;
    const cancelLink  = `${this.appUrl}/cita/${appointment.token}/cancelar`;

    // Formatear fecha legible
    const dateObj  = new Date(appointment.date + 'T12:00:00');
    const dateStr  = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

    const message = encodeURIComponent(
      `Hola ${clientName}! 👋 Te recordamos tu cita mañana:\n\n` +
      `📅 ${dateStr}\n` +
      `⏰ ${appointment.startTime}hs\n` +
      `👨‍⚕️ ${professional.name}\n\n` +
      `¿Vas a asistir?\n\n` +
      `✅ SÍ, confirmo → ${confirmLink}\n` +
      `❌ No puedo ir → ${cancelLink}`
    );

    // Limpiar el número de teléfono (solo números y +)
    const phone = clientPhone.replace(/[^0-9+]/g, '');
    return `https://wa.me/${phone}?text=${message}`;
  }

  /**
   * Reenvía el email de confirmación al cliente — llamado desde el panel del profesional.
   * Reutiliza el mismo template de confirmación.
   */
  async resendConfirmationToClient(
    appointment: Appointment,
    client:       Client,
    professional: Professional,
    service:      Service,
  ): Promise<void> {
    const managementLink = `${this.appUrl}/cita/${appointment.token}`;
    const cancelLink     = `${this.appUrl}/cita/${appointment.token}/cancelar`;

    const html = this.buildConfirmationTemplate({
      clientName:       client.name,
      professionalName: professional.name,
      serviceName:      service.name,
      date:             appointment.date,
      time:             appointment.startTime,
      managementLink,
      cancelLink,
      isPending:        false,
    });

    await this.sendEmail({
      to:      client.email,
      subject: `Recordatorio: tu cita con ${professional.name} 📅`,
      html,
    });

    await this.logNotification(appointment.id, 'email', 'reminder');
  }

  /** Envía email de cancelación al cliente cuando el profesional cancela su cita */
  async sendCancellationNotification(
    appointment: Appointment,
    client:       Client,
    professional: Professional,
  ): Promise<void> {
    const rebookLink = `${this.appUrl}/${professional.slug}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #ef4444;">Tu cita fue cancelada</h2>
        <p>Hola <strong>${client.name}</strong>,</p>
        <p>Lamentablemente tu cita del <strong>${appointment.date}</strong> 
        a las <strong>${appointment.startTime}hs</strong> con 
        <strong>${professional.name}</strong> fue cancelada.</p>
        <a href="${rebookLink}" style="display:inline-block; background:#1a56db; color:white; padding:12px 24px; border-radius:8px; text-decoration:none; margin-top:16px;">
          Reservar nueva cita
        </a>
      </div>`;

    await this.sendEmail({
      to:      client.email,
      subject: `Tu cita con ${professional.name} fue cancelada`,
      html,
    });

    await this.logNotification(appointment.id, 'email', 'cancellation');
  }

  /** Método interno para enviar emails. Maneja errores y los registra */

  /**
   * Envía el link de reserva del profesional a un destinatario.
   * Usado cuando el médico quiere compartir su página con un paciente por email.
   */
  async sendShareLink(options: {
    toEmail:          string;
    professionalName: string;
    slug:             string;
  }): Promise<void> {
    const bookingUrl = `${this.appUrl}/${options.slug}`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#f9fafb;padding:20px">
        <div style="background:#0f2342;border-radius:12px 12px 0 0;padding:28px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:26px">TurnoPro</h1>
        </div>
        <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
          <h2 style="color:#0f2342;margin-top:0">Reservá tu turno online</h2>
          <p style="color:#6b7280">
            <strong style="color:#111827">${options.professionalName}</strong> te invita a reservar tu turno
            de forma rápida y sencilla, sin llamadas ni esperas.
          </p>
          <div style="text-align:center;margin:28px 0">
            <a href="${bookingUrl}"
               style="background:#2563eb;color:#fff;padding:14px 32px;border-radius:10px;
                      text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">
              Reservar mi turno →
            </a>
          </div>
          <p style="color:#9ca3af;font-size:13px;text-align:center">
            O copiá este link: <a href="${bookingUrl}" style="color:#2563eb">${bookingUrl}</a>
          </p>
        </div>
      </div>
    `;
    await this.sendEmail({
      to:      options.toEmail,
      subject: `Reservá tu turno con ${options.professionalName}`,
      html,
    });
  }

  private async sendEmail(options: { to: string; subject: string; html: string }): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: process.env.MAIL_FROM || '"TurnoPro" <noreply@turnopro.com>',
        ...options,
      });
      this.logger.log(`Email enviado a ${options.to}: ${options.subject}`);
    } catch (error) {
      // En fase 1 solo logueamos el error, no bloqueamos la cita
      // Para manejo más estricto: relanzar el error aquí
      this.logger.error(`Error enviando email a ${options.to}:`, error.message);
    }
  }

  /** Registra cada notificación enviada en la tabla notifications_log */
  private async logNotification(
    appointmentId: number,
    type:          string,
    event:         string,
    status:        string = 'sent',
    error?:        string,
  ): Promise<void> {
    await this.logRepo.save(this.logRepo.create({ appointmentId, type, event, status, error }));
  }

  /** Template HTML de confirmación de cita. Para modificar el diseño del email: editar aquí */
  private buildConfirmationTemplate(data: {
    clientName: string; professionalName: string; serviceName: string;
    date: string; time: string; managementLink: string; cancelLink: string; isPending: boolean;
  }): string {
    const dateObj  = new Date(data.date + 'T12:00:00');
    const dateStr  = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    return `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #f9fafb; padding: 24px; border-radius: 12px;">
      <div style="background: #0f2342; padding: 24px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; font-size: 22px; margin: 0;">TurnoPro</h1>
        <p style="color: #93c5fd; margin: 4px 0 0;">${data.isPending ? 'Solicitud recibida' : 'Cita confirmada ✅'}</p>
      </div>
      <div style="background: white; padding: 24px; border-radius: 0 0 10px 10px;">
        <p>Hola <strong>${data.clientName}</strong>,</p>
        <p>${data.isPending
          ? 'Tu solicitud de cita fue recibida. El profesional la confirmará a la brevedad.'
          : `Tu cita con <strong>${data.professionalName}</strong> está confirmada.`
        }</p>
        <div style="background: #eff6ff; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin:4px 0;">🩺 <strong>Servicio:</strong> ${data.serviceName}</p>
          <p style="margin:4px 0;">📅 <strong>Fecha:</strong> ${dateStr}</p>
          <p style="margin:4px 0;">⏰ <strong>Hora:</strong> ${data.time}hs</p>
          <p style="margin:4px 0;">👨‍⚕️ <strong>Profesional:</strong> ${data.professionalName}</p>
        </div>
        <a href="${data.managementLink}" style="display:block; background:#1a56db; color:white; padding:13px; border-radius:8px; text-decoration:none; text-align:center; margin-bottom:10px;">
          👁 Ver mi cita
        </a>
        <a href="${data.cancelLink}" style="display:block; background:white; color:#ef4444; padding:11px; border-radius:8px; text-decoration:none; text-align:center; border:1px solid #fecaca;">
          ✕ Cancelar mi cita
        </a>
        <p style="font-size:12px; color:#9ca3af; margin-top:16px; text-align:center;">
          Solo podés cancelar dentro del plazo permitido por el profesional.
        </p>
      </div>
    </div>`;
  }
}