# 🤖 NipponFlex AI SaaS

Sistema SaaS completo para gestión de agentes de IA con integración WhatsApp, CRM y automatizaciones.

## 📋 Características

### CRM y Ventas
- ✅ Pipeline de ventas con Kanban drag-and-drop
- ✅ Gestión de leads con etapas personalizables
- ✅ Vista de lista y Kanban
- ✅ Búsqueda y filtrado de leads

### Conversaciones
- ✅ Chat en tiempo real estilo WhatsApp
- ✅ Multi-canal: WhatsApp, Telegram, Email
- ✅ Indicadores de mensajes no leídos
- ✅ Historial de conversaciones

### Agentes IA
- ✅ Configuración de múltiples agentes
- ✅ Selección de modelo (Groq, OpenAI)
- ✅ Personalidad y temperatura configurable
- ✅ Prompts personalizados

### Base de Conocimientos
- ✅ Documentos, URLs, texto y FAQs
- ✅ Vectorización con Qdrant
- ✅ RAG para respuestas contextuales

### Campañas
- ✅ Mensajes masivos (broadcast)
- ✅ Templates con variables
- ✅ Métricas de entrega y respuesta

### Calendario
- ✅ Vista mensual de citas
- ✅ Tipos: llamada, reunión, visita
- ✅ Próximas citas y resumen

### Reportes
- ✅ Dashboard con KPIs
- ✅ Leads por etapa y origen
- ✅ Actividad diaria
- ✅ Tasa de conversión

### Multi-tenant
- ✅ Aislamiento de datos por cliente
- ✅ Roles: SuperAdmin, Admin, Distribuidor, Vendedor
- ✅ Límites por plan (agentes, usuarios, mensajes)

## 🚀 Instalación

### Requisitos
- Docker y Docker Compose
- Dominio con DNS configurado
- VPS con mínimo 2GB RAM

### 1. Clonar y Configurar

```bash
# Clonar repositorio
git clone https://github.com/tu-usuario/nipponflex-saas.git
cd nipponflex-saas

# Copiar y editar variables de entorno
cp .env.example .env
nano .env
```

### 2. Variables de Entorno

```env
# Dominio
DOMAIN=tudominio.com

# Base de datos
DB_PASSWORD=tu_password_seguro

# JWT
JWT_SECRET=tu_jwt_secret_muy_largo

# Evolution API
EVOLUTION_API_KEY=tu_api_key
EVOLUTION_INSTANCE=nipponflex

# n8n
N8N_USER=admin
N8N_PASSWORD=tu_password

# Groq AI
GROQ_API_KEY=gsk_...

# Chatwoot (opcional)
CHATWOOT_SECRET=tu_secret
```

### 3. Iniciar Servicios

```bash
# Solo servicios esenciales
docker-compose up -d

# Con Chatwoot (panel de soporte)
docker-compose --profile full up -d
```

### 4. Verificar

- App: https://tudominio.com
- Evolution API: https://evolution.tudominio.com
- n8n: https://n8n.tudominio.com
- Qdrant: https://qdrant.tudominio.com

### 5. Primer Acceso

1. Ir a https://tudominio.com/registro
2. Crear cuenta de empresa
3. Configurar integraciones en /integraciones

## 📁 Estructura del Proyecto

```
nipponflex-saas/
├── app/                    # Páginas Next.js
│   ├── api/               # API Routes
│   │   ├── auth/          # Login, registro, logout
│   │   ├── crm/           # Leads, etapas
│   │   ├── agentes/       # CRUD agentes
│   │   ├── conocimientos/ # Base de conocimientos
│   │   ├── campanas/      # Campañas
│   │   ├── mensajes/      # Envío de mensajes
│   │   ├── webhook/       # Webhooks externos
│   │   └── ...
│   ├── dashboard/         # Dashboard principal
│   ├── crm/               # CRM Kanban/Lista
│   ├── conversaciones/    # Chat WhatsApp-style
│   ├── calendario/        # Citas
│   ├── agentes/           # Gestión IA
│   ├── conocimientos/     # Docs RAG
│   ├── campanas/          # Campañas
│   ├── reportes/          # Analytics
│   ├── usuarios/          # Admin usuarios
│   ├── clientes/          # SuperAdmin
│   ├── integraciones/     # Conexiones
│   └── configuracion/     # Settings
├── components/            # Componentes React
├── contexts/              # Context providers
├── lib/                   # Utilidades
│   ├── db.ts             # PostgreSQL
│   ├── auth.ts           # JWT auth
│   └── utils.ts          # Helpers
├── types/                 # TypeScript types
├── database/              # SQL schemas
├── docker-compose.yml     # Orquestación
├── Dockerfile            # Build app
├── Caddyfile             # Reverse proxy
└── README.md
```

## 🔌 Integraciones

### WhatsApp (Evolution API)
1. Ir a Integraciones → WhatsApp
2. Configurar URL, API Key e Instancia
3. Escanear QR desde Evolution API

### n8n Workflows
1. Crear workflow en n8n
2. Usar webhook trigger
3. Procesar mensaje con Groq
4. Responder vía Evolution API

### Qdrant (RAG)
1. Agregar conocimientos
2. Procesar/vectorizar documentos
3. Los agentes usarán el contexto automáticamente

### Odoo ERP
1. Configurar URL y credenciales
2. Sincronizar contactos
3. Crear leads desde Odoo

## 📊 API Endpoints

### Autenticación
- `POST /api/auth/login` - Login
- `POST /api/auth/registro` - Registro
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Usuario actual

### CRM
- `GET /api/crm/leads` - Listar leads
- `POST /api/crm/leads` - Crear lead
- `GET /api/crm/etapas` - Etapas pipeline

### Agentes
- `GET /api/agentes` - Listar agentes
- `POST /api/agentes` - Crear agente
- `PUT /api/agentes/:id` - Actualizar
- `DELETE /api/agentes/:id` - Eliminar

### Webhooks
- `POST /api/webhook/whatsapp` - Evolution API

## 🎨 Temas

Soporta modo claro y oscuro con transiciones suaves. Toggle en la esquina superior derecha.

## 📱 Responsive

Optimizado para desktop. Mobile en desarrollo.

## 🔐 Seguridad

- JWT con httpOnly cookies
- Passwords con bcrypt
- Aislamiento multi-tenant
- Roles y permisos por nivel

## 📄 Licencia

MIT License - Tecni Support PC

## 🤝 Soporte

- Email: soporte@tecnisupportpc.com
- WhatsApp: +593 99 999 9999
