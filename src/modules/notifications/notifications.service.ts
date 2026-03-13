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
    // Transporter de Nodemailer como fallback (funciona en local con Gmail)
    // En producción se usa Resend API directamente via HTTP (ver sendEmail)
    this.transporter = nodemailer.createTransport({
      host:   process.env.MAIL_HOST || 'smtp.gmail.com',
      port:   parseInt(process.env.MAIL_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false,
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
      clientName:        client.name,
      professionalName:  professional.name,
      professionalName2: professional.name,
      professionalPhone: professional.whatsappPhone || professional.phone || undefined,
      serviceName:       service.name,
      date:              appointment.date,
      time:              appointment.startTime,
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
  /**
   * Notifica al médico por email Y WhatsApp cuando llega una nueva reserva.
   * Email: siempre. WhatsApp: solo si el profesional tiene whatsappPhone configurado.
   */
  async notifyProfessionalNewAppointment(
    appointment: Appointment,
    client:      any,
    professional: Professional,
    service:     any,
  ): Promise<void> {
    const appUrl     = this.appUrl;
    const apptUrl    = `${appUrl}/cita/${appointment.token}`;
    const panelUrl   = `${appUrl}/panel`;
    const statusText = professional.autoConfirm ? 'CONFIRMADA ✅' : 'PENDIENTE ⏳ (requiere tu aprobación)';

    // ── Email al médico ───────────────────────────────────────────────────────
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#f9fafb;padding:20px">
        <div style="background:#0f2342;border-radius:12px 12px 0 0;padding:24px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:22px">📅 Nueva reserva recibida</h1>
        </div>
        <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
          <p style="color:#374151;margin-top:0">Hola <strong>${professional.name}</strong>, tenés una nueva cita:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280;width:40%">👤 Paciente</td>
                <td style="padding:10px;border-bottom:1px solid #f3f4f6;font-weight:600">${client.name}</td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280">📱 Teléfono</td>
                <td style="padding:10px;border-bottom:1px solid #f3f4f6">${client.phone}</td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280">📧 Email</td>
                <td style="padding:10px;border-bottom:1px solid #f3f4f6">${client.email}</td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280">🩺 Servicio</td>
                <td style="padding:10px;border-bottom:1px solid #f3f4f6">${service.name}</td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280">📅 Fecha</td>
                <td style="padding:10px;border-bottom:1px solid #f3f4f6">${appointment.date}</td></tr>
            <tr><td style="padding:10px;color:#6b7280">⏰ Hora</td>
                <td style="padding:10px;font-weight:600">${appointment.startTime}</td></tr>
          </table>
          <p style="background:#f0f9ff;border-left:4px solid #2563eb;padding:12px;border-radius:4px;color:#1e40af;font-weight:600">
            Estado: ${statusText}
          </p>
          <div style="text-align:center;margin-top:24px;display:flex;flex-direction:column;gap:10px">
            <a href="${panelUrl}" style="display:block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold">
              Ver en mi panel →
            </a>
            ${professional.whatsappPhone || client.phone ? `
            <a href="https://wa.me/${(client.phone || '').replace(/[^0-9+]/g, '')}?text=${encodeURIComponent('Hola ' + client.name + '! Te confirmo tu cita del ' + appointment.date + ' a las ' + appointment.startTime + 'hs.')}"
               style="display:block;background:#25d366;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold">
              💬 Escribir al paciente por WhatsApp
            </a>` : ''}
          </div>
        </div>
      </div>
    `;

    try {
      await this.sendEmail({
        to:      professional.publicEmail || professional.email,
        subject: `Nueva cita: ${client.name} — ${appointment.date} ${appointment.startTime}`,
        html,
      });
      await this.logNotification(appointment.id, 'email', 'new_appointment_pro');
    } catch (err) {
      this.logger.error(`Error notificando al profesional ${professional.email}: ${err.message}`);
    }

    // ── WhatsApp al médico (solo si tiene número configurado) ─────────────────
    if (professional.whatsappPhone) {
      const phone = professional.whatsappPhone.replace(/[^0-9+]/g, '');
      const msg   = encodeURIComponent(
        `📅 *Nueva reserva recibida*\n\n` +
        `👤 *${client.name}*\n` +
        `📱 ${client.phone}\n` +
        `🩺 ${service.name}\n` +
        `📅 ${appointment.date} a las ${appointment.startTime}hs\n\n` +
        `Estado: ${professional.autoConfirm ? '✅ Confirmada' : '⏳ Pendiente de aprobación'}\n\n` +
        `Ver en tu panel: ${panelUrl}`
      );
      // Guardamos el link de WA en el log para referencia
      this.logger.log(`WA médico: https://wa.me/${phone}?text=${msg}`);
      await this.logNotification(appointment.id, 'whatsapp', 'new_appointment_pro');
    }
  }


  // ══════════════════════════════════════════════════════════════════════════
  // NOTIFICACIÓN 1 — Médico confirmó cita PENDING → avisa al paciente
  // ══════════════════════════════════════════════════════════════════════════
  async notifyClientAppointmentConfirmed(
    appointment: Appointment,
    client:       Client,
    professional: Professional,
    service:      Service,
  ): Promise<void> {
    const managementLink = `${this.appUrl}/cita/${appointment.token}`;
    const cancelLink     = `${this.appUrl}/cita/${appointment.token}/cancelar`;
    const html = this.buildConfirmationTemplate({
      clientName:        client.name,
      professionalName:  professional.name,
      professionalName2: professional.name,
      professionalPhone: professional.whatsappPhone || professional.phone || undefined,
      serviceName:       service.name,
      date:              appointment.date,
      time:              appointment.startTime,
      managementLink,
      cancelLink,
      isPending:         false,
    });
    try {
      await this.sendEmail({
        to:      client.email,
        subject: `✅ Tu cita con ${professional.name} fue confirmada`,
        html,
      });
      await this.logNotification(appointment.id, 'email', 'confirmed_by_pro');
    } catch (err) {
      this.logger.error(`Error notificando confirmación al cliente: ${err.message}`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // NOTIFICACIÓN 2 — Cita cancelada → avisa al paciente
  // ══════════════════════════════════════════════════════════════════════════
  async notifyClientCancellation(
    appointment: Appointment,
    client:       Client,
    professional: Professional,
    cancelledBy:  'client' | 'professional',
  ): Promise<void> {
    const rebookLink = `${this.appUrl}/${professional.slug}`;
    const waPhone    = (professional.whatsappPhone || professional.phone || '').replace(/[^0-9+]/g, '');
    const waBtn      = waPhone
      ? `<a href="https://wa.me/${waPhone}?text=${encodeURIComponent('Hola ' + professional.name + ', quería consultar sobre mi cita cancelada.')}"
           style="display:block;background:#25d366;color:#fff;padding:11px;border-radius:8px;text-decoration:none;text-align:center;margin-bottom:10px;font-weight:bold;">
          💬 Escribir al profesional por WhatsApp
        </a>`
      : '';

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#f9fafb;padding:20px">
        <div style="background:#0f2342;border-radius:12px 12px 0 0;padding:24px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:22px">TurnoPro</h1>
          <p style="color:#fca5a5;margin:4px 0 0">Cita cancelada</p>
        </div>
        <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
          <p>Hola <strong>${client.name}</strong>,</p>
          <p>${cancelledBy === 'professional'
            ? `Tu cita con <strong>${professional.name}</strong> fue cancelada por el profesional.`
            : `Tu cita con <strong>${professional.name}</strong> fue cancelada correctamente.`
          }</p>
          <div style="background:#fff5f5;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #fecaca">
            <p style="margin:4px 0">🩺 <strong>Servicio:</strong> ${appointment.service?.name ?? ''}</p>
            <p style="margin:4px 0">📅 <strong>Fecha:</strong> ${appointment.date}</p>
            <p style="margin:4px 0">⏰ <strong>Hora:</strong> ${appointment.startTime}hs</p>
          </div>
          ${waBtn}
          <a href="${rebookLink}"
             style="display:block;background:#2563eb;color:#fff;padding:12px;border-radius:8px;text-decoration:none;text-align:center;font-weight:bold">
            Reservar nueva cita →
          </a>
        </div>
      </div>
    `;
    try {
      await this.sendEmail({
        to:      client.email,
        subject: `Tu cita con ${professional.name} fue cancelada`,
        html,
      });
      await this.logNotification(appointment.id, 'email', 'cancelled');
    } catch (err) {
      this.logger.error(`Error notificando cancelación al cliente: ${err.message}`);
    }

    // Notificar al médico solo si canceló el paciente
    if (cancelledBy === 'client') {
      const clientWaPhone = (client.phone || '').replace(/[^0-9+]/g, '');
      const clientWaBtn   = clientWaPhone
        ? `<a href="https://wa.me/${clientWaPhone}?text=${encodeURIComponent('Hola ' + client.name + ', vi que cancelaste tu cita del ' + appointment.date + ' a las ' + appointment.startTime + 'hs. ¿Querés reagendarla?')}"
               style="display:block;background:#25d366;color:#fff;padding:11px;border-radius:8px;text-decoration:none;text-align:center;margin-top:10px;font-weight:bold;">
              💬 Escribir al paciente por WhatsApp
            </a>`
        : '';
      const panelUrl  = `${this.appUrl}/panel`;
      const proHtml   = `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#f9fafb;padding:20px">
          <div style="background:#0f2342;border-radius:12px 12px 0 0;padding:24px;text-align:center">
            <h1 style="color:#fff;margin:0;font-size:22px">❌ Cita cancelada por el paciente</h1>
          </div>
          <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
            <p>Hola <strong>${professional.name}</strong>,</p>
            <p><strong>${client.name}</strong> canceló su cita.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280;width:40%">👤 Paciente</td>
                  <td style="padding:10px;border-bottom:1px solid #f3f4f6;font-weight:600">${client.name}</td></tr>
              <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280">📱 Teléfono</td>
                  <td style="padding:10px;border-bottom:1px solid #f3f4f6">${client.phone}</td></tr>
              <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280">🩺 Servicio</td>
                  <td style="padding:10px;border-bottom:1px solid #f3f4f6">${appointment.service?.name ?? ''}</td></tr>
              <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280">📅 Fecha</td>
                  <td style="padding:10px;border-bottom:1px solid #f3f4f6">${appointment.date}</td></tr>
              <tr><td style="padding:10px;color:#6b7280">⏰ Hora</td>
                  <td style="padding:10px;font-weight:600">${appointment.startTime}hs</td></tr>
            </table>
            ${clientWaBtn}
            <a href="${panelUrl}"
               style="display:block;background:#2563eb;color:#fff;padding:12px;border-radius:8px;text-decoration:none;text-align:center;font-weight:bold;margin-top:10px">
              Ver mi panel →
            </a>
          </div>
        </div>
      `;
      try {
        await this.sendEmail({
          to:      professional.publicEmail || professional.email,
          subject: `❌ ${client.name} canceló su cita del ${appointment.date}`,
          html:    proHtml,
        });
        await this.logNotification(appointment.id, 'email', 'cancelled_notify_pro');
      } catch (err) {
        this.logger.error(`Error notificando cancelación al profesional: ${err.message}`);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // NOTIFICACIÓN 3 — Cron 24hs antes → recordatorio automático al paciente
  // ══════════════════════════════════════════════════════════════════════════
  async sendAutomaticReminder(
    appointment: Appointment,
    client:       Client,
    professional: Professional,
    service:      Service,
  ): Promise<void> {
    const managementLink = `${this.appUrl}/cita/${appointment.token}`;
    const cancelLink     = `${this.appUrl}/cita/${appointment.token}/cancelar`;
    const html = this.buildConfirmationTemplate({
      clientName:        client.name,
      professionalName:  professional.name,
      professionalName2: professional.name,
      professionalPhone: professional.whatsappPhone || professional.phone || undefined,
      serviceName:       service.name,
      date:              appointment.date,
      time:              appointment.startTime,
      managementLink,
      cancelLink,
      isPending:         false,
    });
    try {
      await this.sendEmail({
        to:      client.email,
        subject: `⏰ Recordatorio: tu cita con ${professional.name} es mañana`,
        html,
      });
      await this.logNotification(appointment.id, 'email', 'auto_reminder');
    } catch (err) {
      this.logger.error(`Error enviando recordatorio automático: ${err.message}`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // NOTIFICACIÓN 4 — Paciente reconfirmó → avisa al médico
  // ══════════════════════════════════════════════════════════════════════════
  async notifyProfessionalClientReconfirmed(
    appointment: Appointment,
    client:       Client,
    professional: Professional,
    service:      Service,
  ): Promise<void> {
    const panelUrl = `${this.appUrl}/panel`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#f9fafb;padding:20px">
        <div style="background:#0f2342;border-radius:12px 12px 0 0;padding:24px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:22px">✅ Paciente confirmó asistencia</h1>
        </div>
        <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
          <p>Hola <strong>${professional.name}</strong>,</p>
          <p><strong>${client.name}</strong> confirmó su asistencia para mañana.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280;width:40%">👤 Paciente</td>
                <td style="padding:10px;border-bottom:1px solid #f3f4f6;font-weight:600">${client.name}</td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280">📱 Teléfono</td>
                <td style="padding:10px;border-bottom:1px solid #f3f4f6">${client.phone}</td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280">🩺 Servicio</td>
                <td style="padding:10px;border-bottom:1px solid #f3f4f6">${service.name}</td></tr>
            <tr><td style="padding:10px;color:#6b7280">⏰ Hora</td>
                <td style="padding:10px;font-weight:600">${appointment.startTime}hs</td></tr>
          </table>
          <a href="${panelUrl}"
             style="display:block;background:#2563eb;color:#fff;padding:12px;border-radius:8px;text-decoration:none;text-align:center;font-weight:bold">
            Ver en mi panel →
          </a>
        </div>
      </div>
    `;
    try {
      await this.sendEmail({
        to:      professional.publicEmail || professional.email,
        subject: `✅ ${client.name} confirmó su cita del ${appointment.date}`,
        html,
      });
      await this.logNotification(appointment.id, 'email', 'reconfirmed_by_client');
    } catch (err) {
      this.logger.error(`Error notificando reconfirmación al médico: ${err.message}`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // NOTIFICACIÓN 5 — Médico completó cita → gracias + rebooking al paciente
  // ══════════════════════════════════════════════════════════════════════════
  async notifyClientAppointmentCompleted(
    appointment: Appointment,
    client:       Client,
    professional: Professional,
  ): Promise<void> {
    const rebookLink = `${this.appUrl}/${professional.slug}`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#f9fafb;padding:20px">
        <div style="background:#0f2342;border-radius:12px 12px 0 0;padding:24px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:22px">TurnoPro</h1>
          <p style="color:#86efac;margin:4px 0 0">¡Gracias por tu visita!</p>
        </div>
        <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
          <p>Hola <strong>${client.name}</strong>,</p>
          <p>Gracias por tu visita con <strong>${professional.name}</strong>. Esperamos que haya sido de tu agrado.</p>
          <p style="color:#6b7280;font-size:14px">¿Necesitás volver a consultar? Podés reservar tu próxima cita fácilmente:</p>
          <div style="text-align:center;margin:24px 0">
            <a href="${rebookLink}"
               style="background:#2563eb;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">
              Reservar próxima cita →
            </a>
          </div>
          <p style="color:#9ca3af;font-size:12px;text-align:center">${professional.name} · TurnoPro</p>
        </div>
      </div>
    `;
    try {
      await this.sendEmail({
        to:      client.email,
        subject: `¡Gracias por tu visita con ${professional.name}! 🙏`,
        html,
      });
      await this.logNotification(appointment.id, 'email', 'completed');
    } catch (err) {
      this.logger.error(`Error enviando email de cita completada: ${err.message}`);
    }
  }

  async sendShareLink(options: {
    toEmail:          string;
    professionalName: string;
    slug:             string;
  }): Promise<void> {
    this.logger.log(`[sendShareLink] Enviando a: ${options.toEmail} | profesional: ${options.professionalName} | slug: ${options.slug}`);
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
    this.logger.log(`[sendShareLink] Email procesado para: ${options.toEmail}`);
  }

  async sendPasswordReset(options: {
    toEmail: string;
    name:    string;
    token:   string;
  }): Promise<void> {
    const resetUrl = `${this.appUrl}/reset-password?token=${options.token}`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#f9fafb;padding:20px">
        <div style="background:#0f2342;border-radius:12px 12px 0 0;padding:28px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:26px">TurnoPro</h1>
        </div>
        <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
          <h2 style="color:#0f2342;margin-top:0">Recuperar contraseña</h2>
          <p style="color:#4b5563">Hola <strong>${options.name}</strong>,</p>
          <p style="color:#4b5563">
            Recibimos una solicitud para restablecer la contraseña de tu cuenta.
            Hacé clic en el botón para crear una nueva contraseña.
          </p>
          <div style="text-align:center;margin:32px 0">
            <a href="${resetUrl}"
               style="background:#2563eb;color:#fff;padding:14px 32px;border-radius:10px;
                      text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">
              Restablecer contraseña →
            </a>
          </div>
          <p style="color:#6b7280;font-size:13px">
            Este link expira en <strong>1 hora</strong>. Si no solicitaste este cambio, podés ignorar este email.
          </p>
          <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px;
                    border-top:1px solid #f3f4f6;padding-top:16px">
            TurnoPro — Tu turno en un clic
          </p>
        </div>
      </div>
    `;
    await this.sendEmail({
      to:      options.toEmail,
      subject: 'TurnoPro — Restablecé tu contraseña',
      html,
    });
  }

  async sendWelcomeProfessional(options: {
    toEmail:          string;
    professionalName: string;
    email:            string;
    resetToken:       string;
    slug:             string;
  }): Promise<void> {
    const setupUrl   = `${this.appUrl}/reset-password?token=${options.resetToken}`;
    const bookingUrl = `${this.appUrl}/${options.slug}`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#f9fafb;padding:20px">
        <div style="background:#0f2342;border-radius:12px 12px 0 0;padding:28px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:26px">TurnoPro</h1>
          <p style="color:#93c5fd;margin:6px 0 0;font-size:14px">Sistema de gestión de citas</p>
        </div>
        <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
          <h2 style="color:#0f2342;margin-top:0">¡Bienvenido/a, ${options.professionalName}! 👋</h2>
          <p style="color:#4b5563">
            Tu cuenta en TurnoPro fue creada correctamente. Para acceder al panel necesitás
            configurar tu contraseña haciendo clic en el botón de abajo.
          </p>

          <div style="background:#eff6ff;border-radius:10px;padding:16px;margin:24px 0;border:1px solid #bfdbfe">
            <p style="color:#1e40af;font-weight:bold;margin:0 0 8px;font-size:14px">📧 Tu email de acceso</p>
            <p style="color:#1e3a8a;font-size:15px;margin:0;font-weight:bold">${options.email}</p>
          </div>

          <div style="text-align:center;margin:32px 0">
            <a href="${setupUrl}"
               style="background:#2563eb;color:#fff;padding:16px 36px;border-radius:10px;
                      text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">
              Configurar mi contraseña →
            </a>
          </div>

          <p style="color:#6b7280;font-size:13px;text-align:center">
            Este link expira en <strong>24 horas</strong>.
          </p>

          <div style="background:#f0fdf4;border-radius:10px;padding:16px;margin:24px 0;border:1px solid #bbf7d0">
            <p style="color:#166534;font-size:13px;margin:0">
              🌐 <strong>Tu página de reservas:</strong><br/>
              <a href="${bookingUrl}" style="color:#16a34a">${bookingUrl}</a><br/>
              <span style="color:#4b5563;font-size:12px">Una vez que configures tu contraseña, compartila con tus pacientes.</span>
            </p>
          </div>

          <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:28px;border-top:1px solid #f3f4f6;padding-top:16px">
            TurnoPro — Tu turno en un clic
          </p>
        </div>
      </div>
    `;
    await this.sendEmail({
      to:      options.toEmail,
      subject: `Bienvenido/a a TurnoPro — Configurá tu contraseña`,
      html,
    });
  }

  private async sendEmail(options: { to: string; subject: string; html: string }): Promise<void> {
    const brevoKey = process.env.BREVO_API_KEY;

    try {
      if (brevoKey) {
        // ── Brevo API HTTP (producción — puerto 443, Render no bloquea) ──────
        const from = process.env.MAIL_FROM || 'TurnoPro <tuturnopro@gmail.com>';
        const senderEmail = from.match(/<(.+)>/)?.[1] || from;
        this.logger.log(`[sendEmail] Brevo → to: ${options.to} | from: ${senderEmail} | subject: ${options.subject}`);

        const res  = await fetch('https://api.brevo.com/v3/smtp/email', {
          method:  'POST',
          headers: {
            'api-key':      brevoKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender:      { name: 'TurnoPro', email: senderEmail },
            to:          [{ email: options.to }],
            subject:     options.subject,
            htmlContent: options.html,
          }),
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Brevo API error ${res.status}: ${body}`);
        }
        this.logger.log(`[sendEmail] Brevo OK → ${options.to}: ${options.subject}`);
      } else {
        // ── Nodemailer SMTP (local con Gmail) ─────────────────────────────────
        this.logger.log(`[sendEmail] SMTP → to: ${options.to} | subject: ${options.subject}`);
        await this.transporter.sendMail({
          from: process.env.MAIL_FROM || 'TurnoPro <noreply@turnopro.com>',
          ...options,
        });
        this.logger.log(`[sendEmail] SMTP OK → ${options.to}: ${options.subject}`);
      }
    } catch (error) {
      this.logger.error(`[sendEmail] ERROR enviando a ${options.to} | subject: ${options.subject}`);
      this.logger.error(`[sendEmail] Detalle: ${error.message}`);
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
    date: string; time: string; managementLink: string; cancelLink: string; isPending: boolean; professionalPhone?: string; professionalName2?: string;
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
        ${data.professionalPhone ? `
        <a href="https://wa.me/${data.professionalPhone.replace(/[^0-9+]/g, '')}?text=${encodeURIComponent('Hola ' + (data.professionalName2 || 'doctor') + ', le escribo por mi cita del ' + data.date + ' a las ' + data.time + 'hs.')}"
           style="display:block; background:#25d366; color:white; padding:11px; border-radius:8px; text-decoration:none; text-align:center; margin-top:10px; font-weight:bold;">
          💬 Escribir al profesional por WhatsApp
        </a>` : ''}
        <p style="font-size:12px; color:#9ca3af; margin-top:16px; text-align:center;">
          Solo podés cancelar dentro del plazo permitido por el profesional.
        </p>
      </div>
    </div>`;
  }
}