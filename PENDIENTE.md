# NipponFlex - Estado del Proyecto
> Ultima actualizacion: 5 de enero 2026, 15:45 PM

---

## COMPLETADO HOY (5 enero 2026)

### Deteccion Automatica de Desconexion WhatsApp (Sesion 2)
- [x] Deteccion cuando usuario desconecta desde el celular (Dispositivos vinculados)
- [x] Logout automatico para evitar loop de QR codes (cuello de botella)
- [x] Nuevas funciones en `lib/evolution.ts`:
  - `DISCONNECTION_CODES` - Constantes para codigos de Evolution API
  - `isDeviceRemovedDisconnection()` - Detecta desconexion desde celular (401, 440)
  - `requiresManualReconnection()` - Identifica si necesita escanear QR
  - `isTemporaryDisconnection()` - Detecta desconexiones temporales (408, 428)
  - `configureWebhook()` - Configura webhook automaticamente
  - `getWebhookConfig()` - Verifica configuracion del webhook
- [x] Webhook mejorado para manejar estados: 'close', 'disconnected', 'connecting', 'open'
- [x] Configuracion automatica de webhook al crear instancia y al solicitar QR
- [x] UI mejorada con estados visuales:
  - Verde = Conectado
  - Naranja = Desconexion desde dispositivo o problema detectado
  - Amarillo = Desconexion temporal (reconectando automaticamente)
- [x] Mensajes descriptivos segun tipo de desconexion
- [x] Actualizacion inmediata de BD con motivo de desconexion

### Plan Personalizado + Limite de Usuarios (Sesion 1)
- [x] Nuevo plan "Personalizado" con limites editables
- [x] Campos dinamicos en Admin Sistema al crear cliente con plan personalizado
- [x] Columna `es_personalizado` en tabla planes
- [x] Contador X/Y en pagina Usuarios (ej: 3/5)
- [x] Boton "Nuevo Usuario" se bloquea al alcanzar limite
- [x] Mensaje "Actualiza tu plan para mas usuarios"
- [x] Super admin sin limites de usuarios
- [x] Eliminado campo `tipo_cliente` (no se usaba)
- [x] Columna Usuarios muestra X/Y en tabla clientes (Admin)

### Metricas APIs - Correccion
- [x] Fix error client-side: convertir strings a numeros antes de toFixed()
- [x] PostgreSQL devuelve SUMs como strings, el frontend ahora los parsea

### Aislamiento de Conversaciones por Usuario
- [x] Cada usuario solo ve SUS propias conversaciones
- [x] Super admin ve todas las conversaciones del cliente
- [x] Campo `usuario_id` guardado en `historial_conversaciones`
- [x] Webhook asigna mensajes entrantes al ultimo usuario que respondio

### Leads desde Conversaciones
- [x] POST `/api/leads` para crear contactos desde chat
- [x] Asignar etapa automaticamente si no se especifica

---

## COMPLETADO (4 enero 2026 - Sesion 3)

### Multi-idioma y Zona Horaria
- [x] Campo `zona_horaria` en tabla clientes (default: America/Guayaquil)
- [x] Campo `idioma` en tabla clientes (es, en, pt)
- [x] Worker de recordatorios usa zona horaria del cliente
- [x] Traducciones en `/locales/es.json`, `en.json`, `pt.json`
- [x] Hook `useTranslation` con formateo de fechas/horas
- [x] Contexto `I18nProvider` en layout principal
- [x] Sidebar traducido
- [x] Nueva pestana "Regional" en Configuracion:
  - Selector de idioma (ES, EN, PT)
  - Selector de zona horaria (12 zonas comunes)
  - Preview de hora actual

### Conversaciones - Crear Contacto
- [x] Boton "Crear contacto" en header del chat
- [x] Solo aparece si la conversacion NO tiene lead_id asociado
- [x] Modal para ingresar nombre y email
- [x] Crea lead automaticamente en el CRM
- [x] Actualiza nombre en la conversacion

### Dashboard - Correcciones
- [x] Fix conteo de contactos (solo leads, no conversaciones)
- [x] Estado del Sistema muestra datos REALES:
  - WhatsApp: Conectado/Desconectado/No configurado
  - Agente IA: Activo/Sin agente (verifica BD)
  - Base de datos: Online/Offline
- [x] Nueva API `/api/sistema/estado`

### Limite de Contactos en Importacion
- [x] Verificacion de limite antes de importar
- [x] Cuenta contactos actuales vs limite del plan
- [x] Solo importa los que caben en el espacio disponible
- [x] Mensaje cuando hay contactos omitidos por limite
- [x] Muestra "X/Y contactos" en resultado
- [x] Aplicado a `/api/contactos/importar` y `/api/crm/importar`

---

## COMPLETADO (4 enero 2026 - Sesion 2)

### Aislamiento de Datos por Cliente
- [x] API WhatsApp ahora usa instancias por cliente
- [x] Cada cliente obtiene su propia instancia de Evolution API
- [x] Se crea instancia automatica si no existe

### Panel de Super Admin
- [x] Nueva pagina `/admin/sistema` para administracion global
- [x] Gestion de clientes/empresas (crear, activar/desactivar)
- [x] Configuracion de integraciones globales
- [x] Nueva tabla `configuracion_global`

### Usuarios y Roles
- [x] Super admin puede seleccionar cliente al crear usuario
- [x] Super admin puede crear otros super admins
- [x] Menu lateral incluye "Admin Sistema" (nivel 100)

### Multimedia en Conversaciones
- [x] Selector de emojis
- [x] Boton para adjuntar archivos (imagen, audio, video, docs)
- [x] Preview de archivos antes de enviar
- [x] Envio de multimedia via Evolution API

### ElevenLabs TTS
- [x] Respuestas con audio en WhatsApp
- [x] Clonacion de voces personalizadas
- [x] UI para clonar voz (subir audio)
- [x] Toggle "Responder con audio"
- [x] Si cliente envia audio -> responde con audio

### Usuarios - Mejoras
- [x] Crear usuarios con contrasena generada
- [x] Enviar credenciales por email, WhatsApp o copiar
- [x] Forzar cambio de contrasena en primer inicio
- [x] Pagina `/cambiar-password`

---

## COMPLETADO (4 enero 2026 - Sesion 1)

### Campanas Masivas - Anti-Ban
- [x] Delays aleatorios entre mensajes
- [x] Variacion adicional ±20%
- [x] Orden aleatorio de contactos
- [x] Soporte multimedia

### CRM - Etapas y Leads
- [x] Selector de etapa al crear lead
- [x] Boton editar en etapas del kanban
- [x] Modal para editar nombre y color

### Recordatorios de Citas
- [x] Fix token del worker
- [x] Cron funcionando cada 5 minutos
- [x] Usa zona horaria del cliente

---

## PENDIENTE

### 1. API Oficial de Meta - WhatsApp Business (Prioridad Alta)
- [ ] Migrar de Evolution API a Meta WhatsApp Business API oficial
- [ ] Implementar **Embedded Signup** para onboarding multi-tenant
  - Cada cliente conecta SU propia cuenta de WhatsApp Business
  - No requiere configuracion manual de tokens
  - Flow OAuth integrado en la plataforma
- [ ] Crear app en Meta Business Suite
- [ ] Configurar webhook para mensajes entrantes
- [ ] Soporte para templates de mensajes (HSM)
- [ ] Verificacion de negocios en Meta
- [ ] Variables: `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_TOKEN`

### 2. Integracion Twilio/Vonage (Llamadas) - Prioridad Media
- [ ] Decidir: Twilio o Vonage
- [ ] Crear cuenta y obtener credenciales
- [ ] Agregar variables al .env
- [ ] Crear `lib/twilio.ts` para llamadas
- [ ] Webhook para recibir llamadas entrantes
- [ ] Integrar con agente IA

### 3. Completar Google Calendar - Prioridad Baja
- [ ] Configurar proyecto en Google Cloud Console
- [ ] Habilitar Google Calendar API
- [ ] Crear credenciales OAuth 2.0
- [ ] Agregar GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET
- [ ] Probar flujo completo

### 4. Mejoras Pendientes
- [ ] Reportes exportables (PDF/Excel)
- [ ] Dashboard con mas graficos
- [ ] Notificaciones push
- [ ] Modo offline/PWA

---

## VARIABLES DE ENTORNO

### Configuradas
```
GROQ_API_KEY=configurado
JINA_API_KEY=configurado
QDRANT_URL=http://qdrant-igogc4kw8kow4cssgos0g8gs:6333
QDRANT_API_KEY=configurado
REDIS_URL=redis://redis-nipponflex:6379
WORKER_SECRET=nf_worker_secret_2025_secure
ELEVENLABS_API_KEY=configurado
EVOLUTION_API_URL=https://evolution-api-nipponflex.84.247.166.88.sslip.io
EVOLUTION_API_KEY=configurado
```

### Pendientes
```
META_APP_ID=pendiente
META_APP_SECRET=pendiente
META_WEBHOOK_TOKEN=pendiente
TWILIO_ACCOUNT_SID=pendiente
TWILIO_AUTH_TOKEN=pendiente
TWILIO_PHONE_NUMBER=pendiente
GOOGLE_CLIENT_ID=pendiente
GOOGLE_CLIENT_SECRET=pendiente
```

---

## ARCHIVOS MODIFICADOS/CREADOS HOY (5 enero 2026)

```
# Deteccion Desconexion WhatsApp (Sesion 2)
lib/evolution.ts                             - Funciones de deteccion y configuracion webhook
app/api/webhook/whatsapp/route.ts            - Manejo mejorado de eventos de conexion
app/api/whatsapp/route.ts                    - Configuracion automatica de webhook
app/integraciones/page.tsx                   - UI con estados visuales de desconexion

# Plan Personalizado + Limites (Sesion 1)
app/admin/sistema/page.tsx                   - Plan personalizado + limites dinamicos
app/usuarios/page.tsx                        - Contador X/Y + bloqueo limite
app/api/planes/route.ts                      - Devuelve es_personalizado
app/api/admin/clientes/route.ts              - Acepta limites personalizados
app/api/auth/me/route.ts                     - Devuelve limites del cliente
lib/auth.ts                                  - Incluye limites en getCurrentUser

# Metricas APIs
app/admin/metricas/page.tsx                  - Fix strings a numeros

# Aislamiento conversaciones
app/conversaciones/page.tsx                  - Filtro por usuario_id
app/api/conversaciones/route.ts              - WHERE usuario_id
app/api/webhook/evolution/route.ts           - Asigna usuario_id

# Leads
app/api/leads/route.ts                       - POST para crear leads
```

---

## NOTAS IMPORTANTES

1. **Desconexion WhatsApp automatica** - El sistema detecta cuando el usuario desconecta desde el celular y actualiza la UI automaticamente, evitando loops de QR que causan cuellos de botella
2. **Plan Personalizado** - Super admin puede crear clientes con limites a medida
3. **Limite de usuarios visible** - Cada empresa ve cuantos usuarios tiene vs limite
4. **Conversaciones aisladas** - Cada vendedor ve solo sus chats
5. **Meta WhatsApp Business** - Proximo paso grande: migrar a API oficial con Embedded Signup
6. **Multi-tenant real** - Cada cliente conecta su propio WhatsApp Business

---

*Proximo: Implementar API oficial de Meta con Embedded Signup para WhatsApp multi-tenant*
