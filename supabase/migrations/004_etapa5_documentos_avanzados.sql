-- =============================================================================
-- PNCCP - ETAPA 5: Sistema Documental Avanzado
-- Mejoras a tablas documentales, nuevas tablas de variables y triggers
-- =============================================================================

-- =============================================================================
-- 1. MEJORAS A TABLAS EXISTENTES
-- =============================================================================

-- Agregar columnas a documents.document_templates
ALTER TABLE documents.document_templates
ADD COLUMN IF NOT EXISTS categoria TEXT CHECK (categoria IN ('pliego_tipo', 'acta_evaluacion', 'resolucion', 'contrato', 'informe', 'certificado')),
ADD COLUMN IF NOT EXISTS eventos_disparadores TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS descripcion_usos TEXT,
ADD COLUMN IF NOT EXISTS activa_desde TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS activa_hasta TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_doc_templates_estado ON documents.document_templates(estado);
CREATE INDEX IF NOT EXISTS idx_doc_templates_categoria ON documents.document_templates(categoria);

-- Agregar columnas a documents.document_emissions
ALTER TABLE documents.document_emissions
ADD COLUMN IF NOT EXISTS estado_emision TEXT DEFAULT 'generado' CHECK (estado_emision IN ('generado', 'enviado', 'archivado', 'revocado')),
ADD COLUMN IF NOT EXISTS firmante_id UUID REFERENCES core.profiles(id),
ADD COLUMN IF NOT EXISTS metadata JSONB,
ADD COLUMN IF NOT EXISTS descargado_en TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS revocado_en TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_doc_emissions_estado ON documents.document_emissions(estado_emision);
CREATE INDEX IF NOT EXISTS idx_doc_emissions_fecha ON documents.document_emissions(fecha_emision);
CREATE INDEX IF NOT EXISTS idx_doc_emissions_usuario ON documents.document_emissions(usuario_generador);

-- =============================================================================
-- 2. NUEVAS TABLAS
-- =============================================================================

-- Tabla: Variables en plantillas
CREATE TABLE IF NOT EXISTS documents.template_variables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES documents.document_templates(id) ON DELETE CASCADE,
  nombre_variable TEXT NOT NULL,
  descripcion TEXT,
  tipo_dato TEXT NOT NULL CHECK (tipo_dato IN ('text', 'number', 'date', 'email', 'phone', 'url', 'richtext')),
  requerida BOOLEAN NOT NULL DEFAULT false,
  valor_por_defecto TEXT,
  validacion_regex TEXT,
  posicion INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(template_id, nombre_variable)
);

CREATE INDEX IF NOT EXISTS idx_template_vars_template ON documents.template_variables(template_id);

-- Tabla: Triggers/Disparadores
CREATE TABLE IF NOT EXISTS documents.document_triggers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES documents.document_templates(id) ON DELETE CASCADE,
  evento TEXT NOT NULL CHECK (evento IN (
    'licitacion_publicada',
    'licitacion_cerrada',
    'evaluacion_completada',
    'oferta_descartada',
    'adjudicacion_realizada',
    'contrato_creado',
    'contrato_vigente',
    'hito_creado',
    'hito_completado',
    'contrato_finalizado'
  )),
  condicion_json JSONB,
  automatico BOOLEAN NOT NULL DEFAULT false,
  requiere_confirmacion BOOLEAN DEFAULT false,
  descripcion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(template_id, evento)
);

CREATE INDEX IF NOT EXISTS idx_doc_triggers_template ON documents.document_triggers(template_id);
CREATE INDEX IF NOT EXISTS idx_doc_triggers_evento ON documents.document_triggers(evento);

-- Tabla: Historial de cambios en plantillas
CREATE TABLE IF NOT EXISTS documents.template_changelog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES documents.document_templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  cambio_descripcion TEXT,
  usuario_id UUID REFERENCES core.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_template_changelog_template ON documents.template_changelog(template_id);

-- Tabla: Plantillas pre-configuradas (nacionales)
CREATE TABLE IF NOT EXISTS documents.plantillas_predefinidas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL,
  categoria TEXT NOT NULL,
  contenido_base TEXT,
  descripcion TEXT,
  formato TEXT NOT NULL,
  estructura_json JSONB,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 3. FUNCIÓN: Obtener plantilla activa por categoría
-- =============================================================================

CREATE OR REPLACE FUNCTION documents.get_active_template(
  p_categoria TEXT,
  p_institucion_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  nombre_documento TEXT,
  tipo TEXT,
  version INTEGER,
  contenido JSONB,
  formato TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dt.id,
    dt.nombre_documento,
    dt.tipo,
    dt.version,
    dt.estructura_json,
    dt.formato
  FROM documents.document_templates dt
  WHERE
    dt.categoria = p_categoria
    AND dt.estado = 'activo'
    AND dt.activa_desde <= now()
    AND (dt.activa_hasta IS NULL OR dt.activa_hasta > now())
    AND (dt.ambito = 'nacional' OR (dt.ambito = 'institucional' AND dt.institucion_id = p_institucion_id))
  ORDER BY dt.version DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- 4. FUNCIÓN: Registrar emisión de documento
-- =============================================================================

CREATE OR REPLACE FUNCTION documents.register_emission(
  p_template_id UUID,
  p_entidad_origen TEXT,
  p_entidad_id UUID,
  p_usuario_id UUID,
  p_url_storage TEXT,
  p_hash_documento TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_emission_id UUID;
  v_version INTEGER;
BEGIN
  -- Obtener versión de la plantilla
  SELECT version INTO v_version
  FROM documents.document_templates
  WHERE id = p_template_id;

  -- Insertar emisión
  INSERT INTO documents.document_emissions (
    template_id,
    entidad_origen,
    entidad_id,
    version_utilizada,
    hash_documento,
    url_storage,
    usuario_generador,
    firmante_id,
    estado_emision,
    metadata
  ) VALUES (
    p_template_id,
    p_entidad_origen,
    p_entidad_id,
    v_version,
    p_hash_documento,
    p_url_storage,
    p_usuario_id,
    p_usuario_id,
    'generado'::TEXT,
    p_metadata
  )
  RETURNING id INTO v_emission_id;

  RETURN v_emission_id;
END;
$$ LANGUAGE plpgsql STRICT;

-- =============================================================================
-- 5. FUNCIÓN: Validar elegibilidad de trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION documents.check_trigger_eligibility(
  p_template_id UUID,
  p_evento TEXT,
  p_entidad_origen TEXT,
  p_entidad_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_condicion JSONB;
  v_trigger_existe BOOLEAN;
BEGIN
  -- Verificar que existe un trigger para este template y evento
  SELECT EXISTS(
    SELECT 1
    FROM documents.document_triggers
    WHERE template_id = p_template_id
      AND evento = p_evento
      AND activo = true
  ) INTO v_trigger_existe;

  RETURN v_trigger_existe;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- 6. FUNCIÓN: Cambiar versión de plantilla (deprecate old, activate new)
-- =============================================================================

CREATE OR REPLACE FUNCTION documents.deprecate_and_activate_template(
  p_template_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_categoria TEXT;
  v_ambito TEXT;
  v_institucion_id UUID;
BEGIN
  -- Obtener categoría, ámbito e institución
  SELECT categoria, ambito, institucion_id
  INTO v_categoria, v_ambito, v_institucion_id
  FROM documents.document_templates
  WHERE id = p_template_id;

  -- Si es ámbito nacional, obsoletizar todas las demás de esa categoría nacionales
  IF v_ambito = 'nacional' THEN
    UPDATE documents.document_templates
    SET estado = 'obsoleto'
    WHERE categoria = v_categoria
      AND ambito = 'nacional'
      AND id != p_template_id
      AND estado = 'activo';
  END IF;

  -- Si es institucional, obsoletizar todas de esa institución/categoría
  IF v_ambito = 'institucional' THEN
    UPDATE documents.document_templates
    SET estado = 'obsoleto'
    WHERE categoria = v_categoria
      AND ambito = 'institucional'
      AND institucion_id = v_institucion_id
      AND id != p_template_id
      AND estado = 'activo';
  END IF;

  -- Activar esta plantilla
  UPDATE documents.document_templates
  SET estado = 'activo', activa_desde = now()
  WHERE id = p_template_id;

  -- Registrar en changelog
  INSERT INTO documents.template_changelog (
    template_id,
    version,
    cambio_descripcion,
    usuario_id
  ) VALUES (
    p_template_id,
    (SELECT version FROM documents.document_templates WHERE id = p_template_id),
    'Plantilla activada',
    auth.uid()
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 7. RLS POLICIES (Plantillas)
-- =============================================================================

ALTER TABLE documents.document_templates ENABLE ROW LEVEL SECURITY;

-- Admin Nacional y Admin Institucional pueden ver todas sus plantillas
CREATE POLICY "Plantillas: Admin Nacional ve todas"
  ON documents.document_templates
  FOR SELECT
  USING (
    (SELECT rol_sistema_id FROM core.profiles WHERE id = auth.uid())
    IN (SELECT id FROM core.roles_sistema WHERE nombre_rol = 'Admin Nacional')
    OR (ambito = 'nacional')
  );

-- Admin Institucional ve nacionales + sus institucionales
CREATE POLICY "Plantillas: Admin Institucional ve propias"
  ON documents.document_templates
  FOR SELECT
  USING (
    ambito = 'nacional'
    OR (
      ambito = 'institucional'
      AND institucion_id = (SELECT institucion_id FROM core.profiles WHERE id = auth.uid())
    )
  );

-- Solo Admin puede crear/editar
CREATE POLICY "Plantillas: Solo Admin puede crear"
  ON documents.document_templates
  FOR INSERT
  USING (
    (SELECT rol_sistema_id FROM core.profiles WHERE id = auth.uid())
    IN (SELECT id FROM core.roles_sistema WHERE nombre_rol IN ('Admin Nacional', 'Admin Institucional'))
  );

CREATE POLICY "Plantillas: Solo Admin puede actualizar"
  ON documents.document_templates
  FOR UPDATE
  USING (
    (SELECT rol_sistema_id FROM core.profiles WHERE id = auth.uid())
    IN (SELECT id FROM core.roles_sistema WHERE nombre_rol IN ('Admin Nacional', 'Admin Institucional'))
  );

-- =============================================================================
-- 8. RLS POLICIES (Emisiones)
-- =============================================================================

ALTER TABLE documents.document_emissions ENABLE ROW LEVEL SECURITY;

-- Todos pueden ver emisiones de su institución
CREATE POLICY "Emisiones: Ver por institución"
  ON documents.document_emissions
  FOR SELECT
  USING (
    -- Admin Nacional ve todo
    (SELECT rol_sistema_id FROM core.profiles WHERE id = auth.uid())
    IN (SELECT id FROM core.roles_sistema WHERE nombre_rol = 'Admin Nacional')
    OR
    -- Otros ven de su institución
    (
      SELECT true FROM documents.document_emissions de
      JOIN core.expedientes ex ON de.entidad_origen = 'expediente' AND de.entidad_id = ex.id
      WHERE ex.institucion_id = (SELECT institucion_id FROM core.profiles WHERE id = auth.uid())
    )
  );

-- =============================================================================
-- 9. RLS POLICIES (Triggers y Variables)
-- =============================================================================

ALTER TABLE documents.document_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents.template_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents.template_changelog ENABLE ROW LEVEL SECURITY;

-- Admin Nacional puede gestionar triggers
CREATE POLICY "Triggers: Admin Nacional"
  ON documents.document_triggers
  FOR ALL
  USING (
    (SELECT rol_sistema_id FROM core.profiles WHERE id = auth.uid())
    IN (SELECT id FROM core.roles_sistema WHERE nombre_rol = 'Admin Nacional')
  );

-- Similar para variables
CREATE POLICY "Variables: Admin Nacional"
  ON documents.template_variables
  FOR ALL
  USING (
    (SELECT rol_sistema_id FROM core.profiles WHERE id = auth.uid())
    IN (SELECT id FROM core.roles_sistema WHERE nombre_rol = 'Admin Nacional')
  );

-- =============================================================================
-- 10. TRIGGERS AUTOMÁTICOS (updated_at)
-- =============================================================================

CREATE TRIGGER set_updated_at_document_triggers
  BEFORE UPDATE ON documents.document_triggers
  FOR EACH ROW EXECUTE PROCEDURE core.set_updated_at();

CREATE TRIGGER set_updated_at_document_emissions
  BEFORE UPDATE ON documents.document_emissions
  FOR EACH ROW EXECUTE PROCEDURE core.set_updated_at();

-- =============================================================================
-- 11. AUDITORÍA PARA TABLAS DOCUMENTALES
-- =============================================================================

CREATE TRIGGER audit_document_emissions
  AFTER INSERT OR UPDATE OR DELETE ON documents.document_emissions
  FOR EACH ROW EXECUTE PROCEDURE audit.trigger_audit_log();

CREATE TRIGGER audit_document_templates
  AFTER INSERT OR UPDATE OR DELETE ON documents.document_templates
  FOR EACH ROW EXECUTE PROCEDURE audit.trigger_audit_log();

-- =============================================================================
-- 12. PLANTILLAS PREDEFINIDAS (Seed)
-- =============================================================================

INSERT INTO documents.plantillas_predefinidas (
  nombre,
  tipo,
  categoria,
  descripcion,
  formato,
  activa
) VALUES
  ('Pliego de Condiciones Estándar', 'pliego', 'pliego_tipo', 'Pliego de condiciones para licitaciones públicas', 'pdf', true),
  ('Acta de Evaluación Técnica', 'acta', 'acta_evaluacion', 'Acta de evaluación técnica y económica de ofertas', 'pdf', true),
  ('Resolución de Adjudicación', 'resolucion', 'resolucion', 'Resolución administrativa de adjudicación', 'pdf', true),
  ('Contrato Público Estándar', 'contrato', 'contrato', 'Formato estándar de contrato público', 'pdf', true),
  ('Informe de Ejecución', 'informe', 'informe', 'Informe mensual de ejecución contractual', 'pdf', true),
  ('Certificado de Cumplimiento', 'certificado', 'certificado', 'Certificado de cumplimiento de hitos', 'pdf', true)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- FIN MIGRACIÓN 004
-- =============================================================================
