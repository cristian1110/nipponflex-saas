import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import nodemailer from 'nodemailer'

export const dynamic = 'force-dynamic'

// GET - Obtener configuración de email
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    
    // Solo super admin o admin pueden ver config
    if (user.rol !== 'super_admin' && user.rol !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const config = await queryOne(
      `SELECT id, activo, smtp_host, smtp_port, smtp_secure, smtp_user,
              from_email, from_name, reply_to, ultimo_test, test_exitoso, error_mensaje
       FROM configuracion_email WHERE cuenta_id = $1`,
      [user.cuenta_id || 1]
    )

    return NextResponse.json({
      configurado: !!(config?.smtp_host && config?.smtp_user),
      activo: config?.activo || false,
      config: config ? {
        smtp_host: config.smtp_host || '',
        smtp_port: config.smtp_port || 587,
        smtp_secure: config.smtp_secure || false,
        smtp_user: config.smtp_user || '',
        has_password: !!config.smtp_password,
        from_email: config.from_email || '',
        from_name: config.from_name || 'NipponFlex',
        reply_to: config.reply_to || ''
      } : null,
      ultimo_test: config?.ultimo_test,
      test_exitoso: config?.test_exitoso,
      error_mensaje: config?.error_mensaje
    })
  } catch (error) {
    console.error('Error GET email config:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST - Guardar configuración y/o probar
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    
    if (user.rol !== 'super_admin' && user.rol !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const { 
      smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password,
      from_email, from_name, reply_to, action, test_email 
    } = body

    // Obtener password existente si no se envía uno nuevo
    let passwordToUse = smtp_password
    if (!passwordToUse) {
      const existing = await queryOne(
        `SELECT smtp_password FROM configuracion_email WHERE cuenta_id = $1`,
        [user.cuenta_id || 1]
      )
      passwordToUse = existing?.smtp_password
    }

    // Si es solo test
    if (action === 'test') {
      if (!smtp_host || !smtp_user || !passwordToUse) {
        return NextResponse.json({ error: 'Configuración SMTP incompleta' }, { status: 400 })
      }

      try {
        const transporter = nodemailer.createTransport({
          host: smtp_host,
          port: smtp_port || 587,
          secure: smtp_secure || false,
          auth: {
            user: smtp_user,
            pass: passwordToUse
          }
        })

        // Verificar conexión
        await transporter.verify()

        // Enviar email de prueba
        const testTo = test_email || smtp_user
        await transporter.sendMail({
          from: `"${from_name || 'NipponFlex'}" <${from_email || smtp_user}>`,
          to: testTo,
          subject: '✅ Test de Email - NipponFlex',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0;">🎉 ¡Configuración Exitosa!</h1>
              </div>
              <div style="padding: 30px; background: #f9fafb;">
                <p style="font-size: 16px; color: #374151;">
                  Tu servidor de correo está configurado correctamente.
                </p>
                <p style="font-size: 14px; color: #6b7280;">
                  <strong>Servidor:</strong> ${smtp_host}<br>
                  <strong>Puerto:</strong> ${smtp_port}<br>
                  <strong>Usuario:</strong> ${smtp_user}
                </p>
                <p style="font-size: 12px; color: #9ca3af; margin-top: 20px;">
                  Este es un email de prueba enviado desde NipponFlex.
                </p>
              </div>
            </div>
          `
        })

        // Actualizar estado del test
        await query(
          `UPDATE configuracion_email 
           SET ultimo_test = NOW(), test_exitoso = true, error_mensaje = NULL, updated_at = NOW()
           WHERE cuenta_id = $1`,
          [user.cuenta_id || 1]
        )

        return NextResponse.json({ 
          success: true, 
          mensaje: `✅ Email de prueba enviado a ${testTo}` 
        })

      } catch (emailError: any) {
        await query(
          `UPDATE configuracion_email 
           SET ultimo_test = NOW(), test_exitoso = false, error_mensaje = $1, updated_at = NOW()
           WHERE cuenta_id = $2`,
          [emailError.message, user.cuenta_id || 1]
        )

        return NextResponse.json({ 
          success: false, 
          error: emailError.message 
        })
      }
    }

    // Guardar configuración
    await query(
      `INSERT INTO configuracion_email 
       (cuenta_id, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, from_email, from_name, reply_to, activo, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW())
       ON CONFLICT (cuenta_id) DO UPDATE SET
       smtp_host = $2, smtp_port = $3, smtp_secure = $4, smtp_user = $5,
       smtp_password = COALESCE(NULLIF($6, ''), configuracion_email.smtp_password),
       from_email = $7, from_name = $8, reply_to = $9, activo = true, updated_at = NOW()`,
      [
        user.cuenta_id || 1,
        smtp_host,
        smtp_port || 587,
        smtp_secure || false,
        smtp_user,
        smtp_password || '',
        from_email || smtp_user,
        from_name || 'NipponFlex',
        reply_to || ''
      ]
    )

    return NextResponse.json({ 
      success: true, 
      mensaje: '✅ Configuración guardada' 
    })

  } catch (error) {
    console.error('Error POST email config:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
