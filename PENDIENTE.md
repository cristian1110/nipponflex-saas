# NipponFlex - Estado del Proyecto
> Ultima actualizacion: 4 de enero 2026, 09:00 AM

---

## COMPLETADO HOY (4 enero 2026 - Sesion 2)

### Aislamiento de Datos por Cliente
- [x] API WhatsApp ahora usa instancias por cliente (no instancia fija)
- [x] Cada cliente obtiene su propia instancia de Evolution API automaticamente
- [x] Se crea instancia automatica si el cliente no tiene una
- [x] Usuario soporte@tecnisupportpc.com ahora tiene cliente_id asignado

### Panel de Super Admin
- [x] Nueva pagina `/admin/sistema` para administracion global
- [x] Gestion de clientes/empresas (crear, activar/desactivar)
- [x] Configuracion de integraciones globales:
  - GROQ_API_KEY (IA)
  - JINA_API_KEY (Embeddings)
  - ELEVENLABS_API_KEY (Voz)
  - EVOLUTION_API_URL/KEY (WhatsApp)
  - QDRANT_URL (Base vectorial)
  - SMTP (Email)
- [x] Nueva tabla `configuracion_global` para API keys

### Usuarios y Roles
- [x] Super admin puede seleccionar cliente al crear usuario
- [x] Super admin puede crear otros super admins
- [x] API de roles permite crear todos los niveles (para super admin)
- [x] Menu lateral incluye link "Admin Sistema" (solo nivel 100)

### Metricas APIs
- [x] Verificado que funciona correctamente
- [x] Solo visible para super admin (nivel >= 100)

---

## COMPLETADO ANTERIORMENTE (4 enero 2026 - Sesion 1)

### Campanas Masivas - Anti-Ban
- [x] Delays aleatorios entre mensajes (configurable min/max)
- [x] Variacion adicional ±20% para mas naturalidad
- [x] Orden aleatorio de contactos (ORDER BY RANDOM)
- [x] Soporte multimedia (imagen/audio) en campanas
- [x] Fix filtro leads por pipeline (busca en l.pipeline_id O e.pipeline_id)

### CRM - Mejoras de Etapas y Leads
- [x] Selector de etapa al crear nuevo lead
- [x] Selector de etapa al agregar contacto existente al pipeline
- [x] Boton editar en cada etapa del kanban
- [x] Modal para editar nombre y color de etapas

### Recordatorios de Citas
- [x] Fix token del worker (nf_worker_secret_2025_secure)
- [x] Cron funcionando correctamente cada 5 minutos

### Google Calendar (Pausado)
- [x] Integracion OAuth con Google Calendar API
- [x] Tabla `integraciones_google` para tokens
- [x] Columna `google_event_id` en citas
- [x] Sincronizacion automatica de citas (crear/editar/eliminar)
- [x] UI en Integraciones para conectar cuenta Google
- [ ] **PAUSADO** - Requiere configurar credenciales OAuth en Google Cloud Console

---

## PENDIENTE

### 1. Multi-idioma (ES/EN) - Prioridad Media
- [ ] Crear sistema de traducciones (i18n)
- [ ] Traducir interfaz a ingles
- [ ] Selector de idioma en configuracion
- [ ] Detectar idioma del navegador

### 2. Integracion Twilio/Vonage (Llamadas) - Prioridad Alta
- [ ] Decidir: Twilio o Vonage
- [ ] Crear cuenta y obtener credenciales
- [ ] Agregar variables al .env
- [ ] Crear `lib/twilio.ts` para llamadas
- [ ] Webhook para recibir llamadas entrantes
- [ ] Integrar con agente IA para responder

### 3. Completar Google Calendar - Prioridad Baja
- [ ] Configurar proyecto en Google Cloud Console
- [ ] Habilitar Google Calendar API
- [ ] Crear credenciales OAuth 2.0
- [ ] Agregar GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET al .env
- [ ] Probar flujo completo

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
TWILIO_ACCOUNT_SID=pendiente
TWILIO_AUTH_TOKEN=pendiente
TWILIO_PHONE_NUMBER=pendiente
GOOGLE_CLIENT_ID=pendiente
GOOGLE_CLIENT_SECRET=pendiente
```

---

## ARCHIVOS MODIFICADOS/CREADOS HOY

```
# Aislamiento de WhatsApp por cliente
app/api/whatsapp/route.ts                    - Usa instancia por cliente_id

# Panel Super Admin
app/admin/sistema/page.tsx                   - NUEVO - Gestion global
app/api/admin/clientes/route.ts              - NUEVO - API clientes
app/api/admin/configuracion/route.ts         - NUEVO - API config global

# Usuarios
app/usuarios/page.tsx                        - Selector de cliente para super admin
app/api/usuarios/route.ts                    - Permite crear super admins

# UI
components/Sidebar.tsx                       - Link Admin Sistema

# Base de datos
- Tabla configuracion_global (nueva)
- Cliente id=3 creado para soporte@tecnisupportpc.com
```

---

## NOTAS IMPORTANTES

1. **Cada cliente tiene su propia instancia de WhatsApp** - Ya no se comparte una sola instancia
2. **El super admin ve "Admin Sistema"** en el menu lateral para:
   - Gestionar clientes/empresas
   - Configurar API keys globales (Groq, Jina, ElevenLabs, etc.)
3. **Los usuarios normales NO ven** las integraciones globales ni pueden crear super admins
4. **Las citas y datos estan aislados** por cliente_id

---

*Continuar con las tareas pendientes*
