-- ============================================
-- NipponFlex AI SaaS - Schema PostgreSQL
-- ============================================

-- Extensión para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLA: clientes (tenants)
-- ============================================
CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    telefono VARCHAR(50),
    plan VARCHAR(50) DEFAULT 'starter',
    limite_agentes INTEGER DEFAULT 1,
    limite_usuarios INTEGER DEFAULT 2,
    limite_mensajes INTEGER DEFAULT 500,
    mensajes_usados INTEGER DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    fecha_inicio TIMESTAMP DEFAULT NOW(),
    fecha_fin TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- TABLA: usuarios
-- ============================================
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    telefono VARCHAR(50),
    rol VARCHAR(50) DEFAULT 'vendedor',
    nivel INTEGER DEFAULT 2,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
    activo BOOLEAN DEFAULT true,
    debe_cambiar_password BOOLEAN DEFAULT false,
    ultimo_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices usuarios
CREATE INDEX IF NOT EXISTS idx_usuarios_cliente ON usuarios(cliente_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);

-- ============================================
-- TABLA: etapas_pipeline
-- ============================================
CREATE TABLE IF NOT EXISTS etapas_pipeline (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    color VARCHAR(20) DEFAULT '#3b82f6',
    orden INTEGER DEFAULT 0,
    es_ganado BOOLEAN DEFAULT false,
    es_perdido BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_etapas_cliente ON etapas_pipeline(cliente_id);

-- ============================================
-- TABLA: leads
-- ============================================
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    telefono VARCHAR(50),
    email VARCHAR(255),
    empresa VARCHAR(255),
    etapa_id INTEGER REFERENCES etapas_pipeline(id),
    valor_estimado DECIMAL(12,2) DEFAULT 0,
    origen VARCHAR(100),
    notas TEXT,
    asignado_a INTEGER REFERENCES usuarios(id),
    ultimo_contacto TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_cliente ON leads(cliente_id);
CREATE INDEX IF NOT EXISTS idx_leads_etapa ON leads(etapa_id);
CREATE INDEX IF NOT EXISTS idx_leads_telefono ON leads(telefono);
CREATE INDEX IF NOT EXISTS idx_leads_asignado ON leads(asignado_a);

-- ============================================
-- TABLA: actividades
-- ============================================
CREATE TABLE IF NOT EXISTS actividades (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    usuario_id INTEGER REFERENCES usuarios(id),
    tipo VARCHAR(50) NOT NULL,
    descripcion TEXT,
    fecha_programada TIMESTAMP,
    completada BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_actividades_lead ON actividades(lead_id);

-- ============================================
-- TABLA: mensajes
-- ============================================
CREATE TABLE IF NOT EXISTS mensajes (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
    conversacion_id VARCHAR(100),
    numero_whatsapp VARCHAR(50) NOT NULL,
    rol VARCHAR(20) NOT NULL, -- 'user' o 'assistant'
    mensaje TEXT NOT NULL,
    tipo VARCHAR(50) DEFAULT 'text',
    media_url TEXT,
    canal VARCHAR(50) DEFAULT 'whatsapp',
    leido BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mensajes_cliente ON mensajes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_numero ON mensajes(numero_whatsapp);
CREATE INDEX IF NOT EXISTS idx_mensajes_fecha ON mensajes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mensajes_leido ON mensajes(cliente_id, leido) WHERE NOT leido;

-- ============================================
-- TABLA: agentes
-- ============================================
CREATE TABLE IF NOT EXISTS agentes (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    prompt_sistema TEXT NOT NULL,
    personalidad VARCHAR(50) DEFAULT 'profesional',
    temperatura DECIMAL(3,2) DEFAULT 0.7,
    modelo VARCHAR(100) DEFAULT 'llama-3.3-70b-versatile',
    activo BOOLEAN DEFAULT true,
    whatsapp_numero VARCHAR(50),
    telegram_bot VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agentes_cliente ON agentes(cliente_id);

-- ============================================
-- TABLA: bases_conocimiento
-- ============================================
CREATE TABLE IF NOT EXISTS bases_conocimiento (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
    agente_id INTEGER REFERENCES agentes(id) ON DELETE SET NULL,
    nombre VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL, -- 'documento', 'url', 'texto', 'faq'
    contenido TEXT,
    archivo_url TEXT,
    vectorizado BOOLEAN DEFAULT false,
    total_chunks INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conocimiento_cliente ON bases_conocimiento(cliente_id);
CREATE INDEX IF NOT EXISTS idx_conocimiento_agente ON bases_conocimiento(agente_id);

-- ============================================
-- TABLA: campanas
-- ============================================
CREATE TABLE IF NOT EXISTS campanas (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) DEFAULT 'broadcast',
    estado VARCHAR(50) DEFAULT 'borrador',
    mensaje_template TEXT,
    variables JSONB,
    canal VARCHAR(50) DEFAULT 'whatsapp',
    total_destinatarios INTEGER DEFAULT 0,
    enviados INTEGER DEFAULT 0,
    entregados INTEGER DEFAULT 0,
    leidos INTEGER DEFAULT 0,
    respondidos INTEGER DEFAULT 0,
    fecha_programada TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campanas_cliente ON campanas(cliente_id);

-- ============================================
-- TABLA: destinatarios_campana
-- ============================================
CREATE TABLE IF NOT EXISTS destinatarios_campana (
    id SERIAL PRIMARY KEY,
    campana_id INTEGER REFERENCES campanas(id) ON DELETE CASCADE,
    lead_id INTEGER REFERENCES leads(id),
    telefono VARCHAR(50) NOT NULL,
    nombre VARCHAR(255),
    variables JSONB,
    estado VARCHAR(50) DEFAULT 'pendiente',
    error_mensaje TEXT,
    enviado_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_destinatarios_campana ON destinatarios_campana(campana_id);

-- ============================================
-- TABLA: citas
-- ============================================
CREATE TABLE IF NOT EXISTS citas (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
    lead_id INTEGER REFERENCES leads(id),
    usuario_id INTEGER REFERENCES usuarios(id),
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    fecha_inicio TIMESTAMP NOT NULL,
    fecha_fin TIMESTAMP,
    ubicacion VARCHAR(255),
    tipo VARCHAR(50) DEFAULT 'reunion',
    estado VARCHAR(50) DEFAULT 'pendiente',
    recordatorio_enviado BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_citas_cliente ON citas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_citas_fecha ON citas(fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_citas_usuario ON citas(usuario_id);

-- ============================================
-- TABLA: automatizaciones
-- ============================================
CREATE TABLE IF NOT EXISTS automatizaciones (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    trigger_tipo VARCHAR(100) NOT NULL,
    trigger_config JSONB,
    acciones JSONB,
    activo BOOLEAN DEFAULT true,
    ejecuciones INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automatizaciones_cliente ON automatizaciones(cliente_id);

-- ============================================
-- TABLA: integraciones
-- ============================================
CREATE TABLE IF NOT EXISTS integraciones (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
    tipo VARCHAR(100) NOT NULL,
    nombre VARCHAR(255),
    config JSONB,
    activo BOOLEAN DEFAULT true,
    ultimo_sync TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integraciones_cliente ON integraciones(cliente_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_integraciones_tipo ON integraciones(cliente_id, tipo);

-- ============================================
-- DATOS INICIALES
-- ============================================

-- Usuario SuperAdmin inicial (password: admin123)
INSERT INTO clientes (nombre, email, plan, limite_agentes, limite_usuarios, limite_mensajes)
VALUES ('NipponFlex Admin', 'admin@nipponflex.com', 'enterprise', -1, -1, -1)
ON CONFLICT (email) DO NOTHING;

INSERT INTO usuarios (email, password_hash, nombre, rol, nivel, cliente_id, activo, debe_cambiar_password)
SELECT 'admin@nipponflex.com', 
       '$2a$10$rQnM8K5P5w5KqZ5Z5Z5Z5eABCDEFGHIJKLMNOPQRSTUVWXYZ12345', -- cambiar por hash real
       'Super Admin',
       'superadmin',
       5,
       id,
       true,
       true
FROM clientes WHERE email = 'admin@nipponflex.com'
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agentes_updated_at BEFORE UPDATE ON agentes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VISTAS ÚTILES
-- ============================================

CREATE OR REPLACE VIEW v_dashboard_stats AS
SELECT 
    c.id as cliente_id,
    (SELECT COUNT(*) FROM leads WHERE cliente_id = c.id) as total_leads,
    (SELECT COUNT(*) FROM leads WHERE cliente_id = c.id AND DATE(created_at) = CURRENT_DATE) as leads_hoy,
    (SELECT COUNT(*) FROM mensajes WHERE cliente_id = c.id AND DATE(created_at) = CURRENT_DATE) as mensajes_hoy,
    (SELECT COUNT(*) FROM citas WHERE cliente_id = c.id AND estado = 'pendiente' AND fecha_inicio >= NOW()) as citas_pendientes,
    c.mensajes_usados,
    c.limite_mensajes
FROM clientes c WHERE c.activo = true;

-- Vista de conversaciones agrupadas
CREATE OR REPLACE VIEW v_conversaciones AS
SELECT 
    cliente_id,
    numero_whatsapp,
    MAX(created_at) as ultimo_mensaje,
    COUNT(*) as total_mensajes,
    SUM(CASE WHEN NOT leido AND rol = 'user' THEN 1 ELSE 0 END) as no_leidos,
    (SELECT mensaje FROM mensajes m2 WHERE m2.cliente_id = m1.cliente_id AND m2.numero_whatsapp = m1.numero_whatsapp ORDER BY created_at DESC LIMIT 1) as ultimo_texto,
    (SELECT rol FROM mensajes m2 WHERE m2.cliente_id = m1.cliente_id AND m2.numero_whatsapp = m1.numero_whatsapp ORDER BY created_at DESC LIMIT 1) as ultimo_rol
FROM mensajes m1
GROUP BY cliente_id, numero_whatsapp;

-- ============================================
-- COMENTARIOS
-- ============================================
COMMENT ON TABLE clientes IS 'Tenants/empresas que usan el SaaS';
COMMENT ON TABLE usuarios IS 'Usuarios del sistema con roles y permisos';
COMMENT ON TABLE leads IS 'Prospectos/contactos del CRM';
COMMENT ON TABLE mensajes IS 'Historial de mensajes WhatsApp/Telegram';
COMMENT ON TABLE agentes IS 'Agentes de IA configurados';
COMMENT ON TABLE bases_conocimiento IS 'Documentos y datos para RAG';
COMMENT ON TABLE campanas IS 'Campañas de mensajería masiva';
COMMENT ON TABLE integraciones IS 'Configuración de servicios externos';
