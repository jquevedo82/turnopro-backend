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
import { getVerticalConfig }  from '../../config/verticals';

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

    const vc   = getVerticalConfig(professional.professionalType);
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
      clientLabel:       vc.clientLabel,
      appointmentLabel:  vc.appointmentLabel,
      emailGreeting:     vc.emailGreeting,
    });

    await this.sendEmail({
      to:      client.email,
      subject: isPending
        ? `Tu solicitud de ${vc.appointmentLabel.toLowerCase()} con ${professional.name} fue recibida`
        : `Tu ${vc.appointmentLabel.toLowerCase()} con ${professional.name} está confirmada ✅`,
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
    const vc          = getVerticalConfig(professional.professionalType);

    // Formatear fecha legible
    const dateObj  = new Date(appointment.date + 'T12:00:00');
    const dateStr  = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

    const message = encodeURIComponent(
      `Hola ${clientName}! 👋 Te recordamos tu ${vc.appointmentLabel.toLowerCase()} mañana:\n\n` +
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
    const vc             = getVerticalConfig(professional.professionalType);

    const html = this.buildConfirmationTemplate({
      clientName:       client.name,
      professionalName: professional.name,
      serviceName:      service.name,
      date:             appointment.date,
      time:             appointment.startTime,
      managementLink,
      cancelLink,
      isPending:        false,
      clientLabel:      vc.clientLabel,
      appointmentLabel: vc.appointmentLabel,
      emailGreeting:    vc.emailGreeting,
    });

    await this.sendEmail({
      to:      client.email,
      subject: `Recordatorio: tu ${vc.appointmentLabel.toLowerCase()} con ${professional.name} 📅`,
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
    const vc         = getVerticalConfig(professional.professionalType);
    const apptL      = vc.appointmentLabel.toLowerCase();
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #ef4444;">Tu ${apptL} fue cancelada</h2>
        <p>${vc.emailGreeting} <strong>${NotificationsService.esc(client.name)}</strong>,</p>
        <p>Lamentablemente tu ${apptL} del <strong>${appointment.date}</strong>
        a las <strong>${appointment.startTime}hs</strong> con
        <strong>${NotificationsService.esc(professional.name)}</strong> fue cancelada.</p>
        <a href="${rebookLink}" style="display:inline-block; background:#1a56db; color:white; padding:12px 24px; border-radius:8px; text-decoration:none; margin-top:16px;">
          Reservar nueva ${apptL}
        </a>
      </div>`;

    await this.sendEmail({
      to:      client.email,
      subject: `Tu ${apptL} con ${professional.name} fue cancelada`,
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
    const vc         = getVerticalConfig(professional.professionalType);
    const apptL      = vc.appointmentLabel.toLowerCase();
    const statusText = professional.autoConfirm ? 'CONFIRMADA ✅' : 'PENDIENTE ⏳ (requiere tu aprobación)';
    const cn         = NotificationsService.esc(client.name);
    const cp         = NotificationsService.esc(client.phone);
    const ce         = NotificationsService.esc(client.email);
    const sn         = NotificationsService.esc(service.name);

    // ── Email al profesional ──────────────────────────────────────────────────
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#f9fafb;padding:20px">
        <div style="background:#0f2342;border-radius:12px 12px 0 0;padding:24px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:22px">📅 Nueva ${apptL} recibida</h1>
        </div>
        <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
          <p style="color:#374151;margin-top:0">Hola <strong>${NotificationsService.esc(professional.name)}</strong>, tenés una nueva ${apptL}:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280;width:40%">👤 ${vc.clientLabel}</td>
                <td style="padding:10px;border-bottom:1px solid #f3f4f6;font-weight:600">${cn}</td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280">📱 Teléfono</td>
                <td style="padding:10px;border-bottom:1px solid #f3f4f6">${cp}</td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280">📧 Email</td>
                <td style="padding:10px;border-bottom:1px solid #f3f4f6">${ce}</td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280">🗂 Servicio</td>
                <td style="padding:10px;border-bottom:1px solid #f3f4f6">${sn}</td></tr>
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
            <a href="https://wa.me/${(client.phone || '').replace(/[^0-9+]/g, '')}?text=${encodeURIComponent('Hola ' + client.name + '! Te confirmo tu ' + apptL + ' del ' + appointment.date + ' a las ' + appointment.startTime + 'hs.')}"
               style="display:block;background:#25d366;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold">
              💬 Escribir al ${vc.clientLabel.toLowerCase()} por WhatsApp
            </a>` : ''}
          </div>
        </div>
      </div>
    `;

    try {
      await this.sendEmail({
        to:      professional.publicEmail || professional.email,
        subject: `Nueva ${apptL}: ${client.name} — ${appointment.date} ${appointment.startTime}`,
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
    const vc             = getVerticalConfig(professional.professionalType);
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
      clientLabel:       vc.clientLabel,
      appointmentLabel:  vc.appointmentLabel,
      emailGreeting:     vc.emailGreeting,
    });
    try {
      await this.sendEmail({
        to:      client.email,
        subject: `✅ Tu ${vc.appointmentLabel.toLowerCase()} con ${professional.name} fue confirmada`,
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
    const vc2        = getVerticalConfig(professional.professionalType);
    const apptL2     = vc2.appointmentLabel.toLowerCase();
    const cn2        = NotificationsService.esc(client.name);
    const cp2        = NotificationsService.esc(client.phone);
    const waPhone    = (professional.whatsappPhone || professional.phone || '').replace(/[^0-9+]/g, '');
    const waBtn      = waPhone
      ? `<a href="https://wa.me/${waPhone}?text=${encodeURIComponent('Hola ' + professional.name + ', quería consultar sobre mi ' + apptL2 + ' cancelada.')}"
           style="display:block;background:#25d366;color:#fff;padding:11px;border-radius:8px;text-decoration:none;text-align:center;margin-bottom:10px;font-weight:bold;">
          💬 Escribir al profesional por WhatsApp
        </a>`
      : '';

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#f9fafb;padding:20px">
        <div style="background:#0f2342;border-radius:12px 12px 0 0;padding:24px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:22px">TurnoPro</h1>
          <p style="color:#fca5a5;margin:4px 0 0">${vc2.appointmentLabel} cancelada</p>
        </div>
        <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
          <p>${vc2.emailGreeting} <strong>${cn2}</strong>,</p>
          <p>${cancelledBy === 'professional'
            ? `Tu ${apptL2} con <strong>${NotificationsService.esc(professional.name)}</strong> fue cancelada por el profesional.`
            : `Tu ${apptL2} con <strong>${NotificationsService.esc(professional.name)}</strong> fue cancelada correctamente.`
          }</p>
          <div style="background:#fff5f5;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #fecaca">
            <p style="margin:4px 0">🗂 <strong>Servicio:</strong> ${NotificationsService.esc(appointment.service?.name ?? '')}</p>
            <p style="margin:4px 0">📅 <strong>Fecha:</strong> ${appointment.date}</p>
            <p style="margin:4px 0">⏰ <strong>Hora:</strong> ${appointment.startTime}hs</p>
          </div>
          ${waBtn}
          <a href="${rebookLink}"
             style="display:block;background:#2563eb;color:#fff;padding:12px;border-radius:8px;text-decoration:none;text-align:center;font-weight:bold">
            Reservar nueva ${apptL2} →
          </a>
        </div>
      </div>
    `;
    try {
      await this.sendEmail({
        to:      client.email,
        subject: `Tu ${apptL2} con ${professional.name} fue cancelada`,
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
            <h1 style="color:#fff;margin:0;font-size:22px">❌ ${vc2.appointmentLabel} cancelada por el/la ${vc2.clientLabel.toLowerCase()}</h1>
          </div>
          <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
            <p>Hola <strong>${NotificationsService.esc(professional.name)}</strong>,</p>
            <p><strong>${cn2}</strong> canceló su ${apptL2}.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280;width:40%">👤 ${vc2.clientLabel}</td>
                  <td style="padding:10px;border-bottom:1px solid #f3f4f6;font-weight:600">${cn2}</td></tr>
              <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280">📱 Teléfono</td>
                  <td style="padding:10px;border-bottom:1px solid #f3f4f6">${cp2}</td></tr>
              <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280">🗂 Servicio</td>
                  <td style="padding:10px;border-bottom:1px solid #f3f4f6">${NotificationsService.esc(appointment.service?.name ?? '')}</td></tr>
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
          subject: `❌ ${client.name} canceló su ${apptL2} del ${appointment.date}`,
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
    const vc             = getVerticalConfig(professional.professionalType);
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
      clientLabel:       vc.clientLabel,
      appointmentLabel:  vc.appointmentLabel,
      emailGreeting:     vc.emailGreeting,
    });
    try {
      await this.sendEmail({
        to:      client.email,
        subject: `⏰ Recordatorio: tu ${vc.appointmentLabel.toLowerCase()} con ${professional.name} es mañana`,
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
    const vc       = getVerticalConfig(professional.professionalType);
    const apptL    = vc.appointmentLabel.toLowerCase();
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#f9fafb;padding:20px">
        <div style="background:#0f2342;border-radius:12px 12px 0 0;padding:24px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:22px">✅ ${vc.clientLabel} confirmó asistencia</h1>
        </div>
        <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
          <p>Hola <strong>${NotificationsService.esc(professional.name)}</strong>,</p>
          <p><strong>${NotificationsService.esc(client.name)}</strong> confirmó su asistencia para mañana.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280;width:40%">👤 ${vc.clientLabel}</td>
                <td style="padding:10px;border-bottom:1px solid #f3f4f6;font-weight:600">${NotificationsService.esc(client.name)}</td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280">📱 Teléfono</td>
                <td style="padding:10px;border-bottom:1px solid #f3f4f6">${NotificationsService.esc(client.phone)}</td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280">🗂 Servicio</td>
                <td style="padding:10px;border-bottom:1px solid #f3f4f6">${NotificationsService.esc(service.name)}</td></tr>
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
        subject: `✅ ${client.name} confirmó su ${apptL} del ${appointment.date}`,
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
    const vc         = getVerticalConfig(professional.professionalType);
    const apptL      = vc.appointmentLabel.toLowerCase();
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#f9fafb;padding:20px">
        <div style="background:#0f2342;border-radius:12px 12px 0 0;padding:24px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:22px">TurnoPro</h1>
          <p style="color:#86efac;margin:4px 0 0">¡Gracias por tu visita!</p>
        </div>
        <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
          <p>${vc.emailGreeting} <strong>${NotificationsService.esc(client.name)}</strong>,</p>
          <p>Gracias por tu visita con <strong>${NotificationsService.esc(professional.name)}</strong>. Esperamos que haya sido de tu agrado.</p>
          <p style="color:#6b7280;font-size:14px">¿Necesitás otra ${apptL}? Podés reservar fácilmente:</p>
          <div style="text-align:center;margin:24px 0">
            <a href="${rebookLink}"
               style="background:#2563eb;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">
              Reservar próxima ${apptL} →
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

  /**
   * Email de bienvenida para secretarias.
   * Mismo mecanismo que sendWelcomeProfessional — link para configurar contraseña.
   * El token usa el mismo endpoint /reset-password que comparten todos los roles.
   */
  async sendWelcomeSecretary(options: {
    toEmail: string;
    name:    string;
    token:   string;
  }): Promise<void> {
    const setupUrl = `${this.appUrl}/reset-password?token=${options.token}`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#f9fafb;padding:20px">
        <div style="background:#0f2342;border-radius:12px 12px 0 0;padding:28px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:26px">TurnoPro</h1>
          <p style="color:#93c5fd;margin:6px 0 0;font-size:14px">Sistema de gestión de citas</p>
        </div>
        <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
          <h2 style="color:#0f2342;margin-top:0">¡Bienvenida, ${options.name}! 👋</h2>
          <p style="color:#4b5563">
            Tu cuenta de secretaria en TurnoPro fue creada. Para acceder al panel
            necesitás configurar tu contraseña haciendo clic en el botón de abajo.
          </p>

          <div style="background:#eff6ff;border-radius:10px;padding:16px;margin:24px 0;border:1px solid #bfdbfe">
            <p style="color:#1e40af;font-weight:bold;margin:0 0 8px;font-size:14px">📧 Tu email de acceso</p>
            <p style="color:#1e3a8a;font-size:15px;margin:0;font-weight:bold">${options.toEmail}</p>
          </div>

          <div style="text-align:center;margin:32px 0">
            <a href="${setupUrl}"
               style="background:#2563eb;color:#fff;padding:16px 36px;border-radius:10px;
                      text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">
              Configurar mi contraseña →
            </a>
          </div>

          <p style="color:#6b7280;font-size:13px;text-align:center">
            Este link expira en <strong>48 horas</strong>.
            Si expiró, pedile al administrador que reenvíe tus credenciales.
          </p>

          <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:28px;
                    border-top:1px solid #f3f4f6;padding-top:16px">
            TurnoPro — Tu turno en un clic
          </p>
        </div>
      </div>
    `;
    await this.sendEmail({
      to:      options.toEmail,
      subject: 'TurnoPro — Configurá tu contraseña de secretaria',
      html,
    });
  }

  /** Notifica al usuario cuando el superadmin cambia su email de acceso */
  async sendEmailChanged(options: {
    toEmail:  string; // nuevo email — aquí llega la notificación
    name:     string;
    newEmail: string;
    role:     'profesional' | 'secretaria';
  }): Promise<void> {
    const loginUrl = `${this.appUrl}/login`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#f9fafb;padding:20px">
        <div style="background:#0f2342;border-radius:12px 12px 0 0;padding:28px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:26px">TurnoPro</h1>
          <p style="color:#93c5fd;margin:6px 0 0;font-size:14px">Sistema de gestión de citas</p>
        </div>
        <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
          <h2 style="color:#0f2342;margin-top:0">Tu email de acceso fue actualizado</h2>
          <p style="color:#4b5563">
            Hola <strong>${NotificationsService.esc(options.name)}</strong>, el administrador actualizó
            tu email de acceso como ${NotificationsService.esc(options.role)} en TurnoPro.
          </p>

          <div style="background:#eff6ff;border-radius:10px;padding:16px;margin:24px 0;border:1px solid #bfdbfe">
            <p style="color:#1e40af;font-weight:bold;margin:0 0 8px;font-size:14px">📧 Tu nuevo email de acceso</p>
            <p style="color:#1e3a8a;font-size:15px;margin:0;font-weight:bold">${NotificationsService.esc(options.newEmail)}</p>
          </div>

          <p style="color:#4b5563">Usá este email la próxima vez que inicies sesión.</p>

          <div style="text-align:center;margin:32px 0">
            <a href="${loginUrl}"
               style="background:#2563eb;color:#fff;padding:16px 36px;border-radius:10px;
                      text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">
              Ir al login →
            </a>
          </div>

          <p style="color:#6b7280;font-size:13px">
            Si no reconocés este cambio, contactá al administrador del sistema.
          </p>

          <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:28px;
                    border-top:1px solid #f3f4f6;padding-top:16px">
            TurnoPro — Tu turno en un clic
          </p>
        </div>
      </div>
    `;
    await this.sendEmail({
      to:      options.toEmail,
      subject: 'TurnoPro — Tu email de acceso fue actualizado',
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

  /** Escapa caracteres HTML en strings de usuarios no autenticados (nombres, teléfonos, emails) */
  private static esc(s: string | null | undefined): string {
    if (!s) return '';
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
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
    professionalPhone?: string; professionalName2?: string;
    // Labels adaptados al vertical — con fallback para compatibilidad
    clientLabel?:      string;
    appointmentLabel?: string;
    emailGreeting?:    string;
  }): string {
    const dateObj         = new Date(data.date + 'T12:00:00');
    const dateStr         = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const apptLabel       = data.appointmentLabel ?? 'Cita';
    const apptLabelLower  = apptLabel.toLowerCase();
    const greeting        = data.emailGreeting ?? 'Hola';
    const clientName      = NotificationsService.esc(data.clientName);
    const professionalName = NotificationsService.esc(data.professionalName);
    const serviceName     = NotificationsService.esc(data.serviceName);

    return `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #f9fafb; padding: 24px; border-radius: 12px;">
      <div style="background: #0f2342; padding: 24px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; font-size: 22px; margin: 0;">TurnoPro</h1>
        <p style="color: #93c5fd; margin: 4px 0 0;">${data.isPending ? 'Solicitud recibida' : `${apptLabel} confirmada ✅`}</p>
      </div>
      <div style="background: white; padding: 24px; border-radius: 0 0 10px 10px;">
        <p>${greeting} <strong>${clientName}</strong>,</p>
        <p>${data.isPending
          ? `Tu solicitud de ${apptLabelLower} fue recibida. El profesional la confirmará a la brevedad.`
          : `Tu ${apptLabelLower} con <strong>${professionalName}</strong> está confirmada.`
        }</p>
        <div style="background: #eff6ff; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin:4px 0;">🗂 <strong>Servicio:</strong> ${serviceName}</p>
          <p style="margin:4px 0;">📅 <strong>Fecha:</strong> ${dateStr}</p>
          <p style="margin:4px 0;">⏰ <strong>Hora:</strong> ${data.time}hs</p>
          <p style="margin:4px 0;">👤 <strong>Profesional:</strong> ${professionalName}</p>
        </div>
        <a href="${data.managementLink}" style="display:block; background:#1a56db; color:white; padding:13px; border-radius:8px; text-decoration:none; text-align:center; margin-bottom:10px;">
          👁 Ver mi ${apptLabelLower}
        </a>
        <a href="${data.cancelLink}" style="display:block; background:white; color:#ef4444; padding:11px; border-radius:8px; text-decoration:none; text-align:center; border:1px solid #fecaca;">
          ✕ Cancelar mi ${apptLabelLower}
        </a>
        ${data.professionalPhone ? `
        <a href="https://wa.me/${data.professionalPhone.replace(/[^0-9+]/g, '')}?text=${encodeURIComponent('Hola ' + (data.professionalName2 || data.professionalName) + ', le escribo por mi ' + apptLabelLower + ' del ' + data.date + ' a las ' + data.time + 'hs.')}"
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