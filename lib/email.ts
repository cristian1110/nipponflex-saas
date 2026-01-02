import nodemailer from 'nodemailer'
import { queryOne } from './db'

interface EmailOptions {
  to: string
  subject: string
  html: string
}

export async function sendEmail(options: EmailOptions, cuentaId: number = 1): Promise<{ success: boolean; error?: string }> {
  try {
    const config = await queryOne(
      `SELECT * FROM configuracion_email WHERE cuenta_id = $1 AND activo = true`,
      [cuentaId]
    )

    if (!config || !config.smtp_host || !config.smtp_user || !config.smtp_password) {
      console.log('Email no configurado, simulando envio a:', options.to)
      return { success: true }
    }

    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port || 587,
      secure: config.smtp_secure || false,
      auth: {
        user: config.smtp_user,
        pass: config.smtp_password
      }
    })

    await transporter.sendMail({
      from: `"${config.from_name || 'NipponFlex'}" <${config.from_email || config.smtp_user}>`,
      to: options.to,
      subject: options.subject,
      html: options.html
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error enviando email:', error)
    return { success: false, error: error.message }
  }
}

export const emailTemplates = {
  invitacionCliente: (nombre: string, token: string, plan: string, baseUrl: string) => ({
    subject: 'Bienvenido a NipponFlex - Activa tu cuenta',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #111827; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">NipponFlex</h1>
          <p style="color: rgba(255,255,255,0.9); margin-top: 10px;">Tu asistente IA para WhatsApp</p>
        </div>
        <div style="padding: 40px; background: #1f2937;">
          <h2 style="color: #10b981; margin-top: 0;">Hola ${nombre}!</h2>
          <p style="color: #d1d5db; font-size: 16px; line-height: 1.6;">Tu cuenta ha sido creada exitosamente.</p>
          <div style="background: #374151; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="color: #9ca3af; margin: 0; font-size: 14px;">Plan seleccionado:</p>
            <p style="color: #10b981; margin: 5px 0 0 0; font-size: 20px; font-weight: bold;">${plan}</p>
          </div>
          <p style="color: #d1d5db; font-size: 16px;">Haz clic para activar tu cuenta:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/activar/${token}" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
              ACTIVAR MI CUENTA
            </a>
          </div>
          <p style="color: #6b7280; font-size: 12px; text-align: center;">Este enlace expira en 48 horas.</p>
        </div>
      </div>
    `
  }),

  invitacionSubUsuario: (nombre: string, token: string, adminName: string, baseUrl: string) => ({
    subject: 'Invitacion a NipponFlex',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #111827; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">NipponFlex</h1>
        </div>
        <div style="padding: 40px; background: #1f2937;">
          <h2 style="color: #10b981; margin-top: 0;">Hola ${nombre}!</h2>
          <p style="color: #d1d5db; font-size: 16px; line-height: 1.6;"><strong>${adminName}</strong> te ha invitado a usar NipponFlex.</p>
          <div style="background: #374151; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="color: #9ca3af; margin: 0 0 10px 0; font-size: 14px;">Con tu cuenta podras:</p>
            <ul style="color: #d1d5db; margin: 0; padding-left: 20px;">
              <li>Configurar tu agente IA</li>
              <li>Conectar tu WhatsApp</li>
              <li>Gestionar tu CRM</li>
            </ul>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/activar/${token}" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
              ACEPTAR INVITACION
            </a>
          </div>
          <p style="color: #6b7280; font-size: 12px; text-align: center;">Este enlace expira en 48 horas.</p>
        </div>
      </div>
    `
  })
}
