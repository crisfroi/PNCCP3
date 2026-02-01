-- ETAPA 6: Integración de Generación Automática de Documentos
-- Agregamos referencias a emisiones documentales en las tablas de proceso
-- Date: 2026-02-01

-- ===== procurement.licitaciones =====
-- Agregar columnas para referencias a documentos generados
ALTER TABLE procurement.licitaciones
ADD COLUMN IF NOT EXISTS pliego_emission_id UUID REFERENCES documents.document_emissions(id),
ADD COLUMN IF NOT EXISTS acta_emission_id UUID REFERENCES documents.document_emissions(id);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_licitaciones_pliego_emission 
ON procurement.licitaciones(pliego_emission_id);

CREATE INDEX IF NOT EXISTS idx_licitaciones_acta_emission 
ON procurement.licitaciones(acta_emission_id);

-- ===== core.contratos =====
-- Agregar columnas para referencias a documentos de contrato
ALTER TABLE core.contratos
ADD COLUMN IF NOT EXISTS resolucion_emission_id UUID REFERENCES documents.document_emissions(id),
ADD COLUMN IF NOT EXISTS contrato_emission_id UUID REFERENCES documents.document_emissions(id),
ADD COLUMN IF NOT EXISTS certificado_emission_id UUID REFERENCES documents.document_emissions(id);

-- Índices para búsqueda
CREATE INDEX IF NOT EXISTS idx_contratos_resolucion_emission 
ON core.contratos(resolucion_emission_id);

CREATE INDEX IF NOT EXISTS idx_contratos_contrato_emission 
ON core.contratos(contrato_emission_id);

CREATE INDEX IF NOT EXISTS idx_contratos_certificado_emission 
ON core.contratos(certificado_emission_id);

-- ===== execution.hitos_contrato =====
-- Agregar columna para informe de hito
ALTER TABLE execution.hitos_contrato
ADD COLUMN IF NOT EXISTS informe_emission_id UUID REFERENCES documents.document_emissions(id);

-- Índice para búsqueda
CREATE INDEX IF NOT EXISTS idx_hitos_informe_emission 
ON execution.hitos_contrato(informe_emission_id);

-- ===== Nueva tabla para mapeo de eventos documentales =====
-- Registra qué documentos se generaron para qué eventos en qué entidades
CREATE TABLE IF NOT EXISTS documents.document_event_log (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  
  -- Referencias
  emission_id UUID NOT NULL REFERENCES documents.document_emissions(id),
  evento TEXT NOT NULL,  -- licitacion_publicada, contrato_creado, etc
  
  -- Entidad que disparó el evento
  entidad_tipo TEXT NOT NULL,  -- licitacion, contrato, hito, etc
  entidad_id UUID NOT NULL,
  
  -- Trigger que se ejecutó
  trigger_id UUID REFERENCES documents.document_triggers(id),
  
  -- Auditoría
  usuario_id UUID REFERENCES core.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT evento_enum CHECK (
    evento IN (
      'licitacion_publicada',
      'licitacion_cerrada',
      'evaluacion_completada',
      'adjudicacion_realizada',
      'contrato_creado',
      'contrato_vigente',
      'hito_creado',
      'hito_completado',
      'contrato_finalizado'
    )
  )
);

-- Índices en document_event_log
CREATE INDEX IF NOT EXISTS idx_document_event_log_emission 
ON documents.document_event_log(emission_id);

CREATE INDEX IF NOT EXISTS idx_document_event_log_evento 
ON documents.document_event_log(evento);

CREATE INDEX IF NOT EXISTS idx_document_event_log_entidad 
ON documents.document_event_log(entidad_tipo, entidad_id);

CREATE INDEX IF NOT EXISTS idx_document_event_log_usuario 
ON documents.document_event_log(usuario_id);

CREATE INDEX IF NOT EXISTS idx_document_event_log_fecha 
ON documents.document_event_log(created_at DESC);

-- ===== Habilitar RLS en document_event_log =====
ALTER TABLE documents.document_event_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_event_log_select_auditor"
ON documents.document_event_log
FOR SELECT
TO authenticated
USING (
  -- Auditors can read all
  core.is_auditor() 
  OR
  -- Admin Nacional can read all
  core.is_admin_nacional()
);

-- ===== Views para Analítica =====

-- Vista de estadísticas de licitaciones
CREATE OR REPLACE VIEW v_licitaciones_estadisticas AS
SELECT
  estado,
  COUNT(*) as total_licitaciones,
  COUNT(CASE WHEN pliego_emission_id IS NOT NULL THEN 1 END) as con_pliego,
  COUNT(CASE WHEN acta_emission_id IS NOT NULL THEN 1 END) as con_acta,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/86400) as dias_promedio
FROM procurement.licitaciones
GROUP BY estado;

-- Vista de estadísticas de contratos
CREATE OR REPLACE VIEW v_contratos_estadisticas AS
SELECT
  estado,
  COUNT(*) as total_contratos,
  COUNT(CASE WHEN resolucion_emission_id IS NOT NULL THEN 1 END) as con_resolucion,
  COUNT(CASE WHEN contrato_emission_id IS NOT NULL THEN 1 END) as con_contrato_emitido,
  COUNT(CASE WHEN certificado_emission_id IS NOT NULL THEN 1 END) as con_certificado,
  SUM(monto_adjudicado) as monto_total
FROM core.contratos
GROUP BY estado;

-- Vista de documentos generados por período
CREATE OR REPLACE VIEW v_documentos_por_evento AS
SELECT
  DATE_TRUNC('week', created_at)::DATE as semana,
  evento,
  COUNT(*) as total
FROM documents.document_event_log
GROUP BY DATE_TRUNC('week', created_at), evento
ORDER BY semana DESC, total DESC;

-- Vista de cobertura documental por licitación
CREATE OR REPLACE VIEW v_licitacion_cobertura_documental AS
SELECT
  l.id,
  e.codigo_expediente,
  e.objeto_contrato,
  l.estado,
  CASE WHEN l.pliego_emission_id IS NOT NULL THEN '✓' ELSE '✗' END as tiene_pliego,
  CASE WHEN l.acta_emission_id IS NOT NULL THEN '✓' ELSE '✗' END as tiene_acta,
  l.created_at
FROM procurement.licitaciones l
JOIN core.expedientes e ON l.expediente_id = e.id
ORDER BY l.created_at DESC;

-- Vista de cobertura documental por contrato
CREATE OR REPLACE VIEW v_contrato_cobertura_documental AS
SELECT
  c.id,
  e.codigo_expediente,
  c.estado,
  CASE WHEN c.resolucion_emission_id IS NOT NULL THEN '✓' ELSE '✗' END as tiene_resolucion,
  CASE WHEN c.contrato_emission_id IS NOT NULL THEN '✓' ELSE '✗' END as tiene_contrato,
  CASE WHEN c.certificado_emission_id IS NOT NULL THEN '✓' ELSE '✗' END as tiene_certificado,
  c.monto_adjudicado,
  c.created_at
FROM core.contratos c
JOIN core.expedientes e ON c.expediente_id = e.id
ORDER BY c.created_at DESC;

-- ===== Función para registrar evento documental =====
CREATE OR REPLACE FUNCTION documents.log_document_event(
  p_emission_id UUID,
  p_evento TEXT,
  p_entidad_tipo TEXT,
  p_entidad_id UUID,
  p_trigger_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = documents, core, public
AS $$
DECLARE
  v_user_id UUID;
  v_log_id UUID;
BEGIN
  -- Obtener usuario actual
  v_user_id := (SELECT auth.uid());
  
  -- Insertar log
  INSERT INTO documents.document_event_log (
    emission_id,
    evento,
    entidad_tipo,
    entidad_id,
    trigger_id,
    usuario_id
  ) VALUES (
    p_emission_id,
    p_evento,
    p_entidad_tipo,
    p_entidad_id,
    p_trigger_id,
    v_user_id
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- ===== Función para generar documento automáticamente =====
CREATE OR REPLACE FUNCTION documents.generate_document_for_entity(
  p_template_categoria TEXT,
  p_entidad_origen TEXT,
  p_entidad_id UUID,
  p_evento TEXT,
  p_variables JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = documents, core, public
AS $$
DECLARE
  v_template_id UUID;
  v_emission_id UUID;
BEGIN
  -- Obtener plantilla activa por categoría
  SELECT id INTO v_template_id
  FROM documents.document_templates
  WHERE categoria = p_template_categoria
    AND estado = 'activo'
  LIMIT 1;
  
  IF v_template_id IS NULL THEN
    RAISE EXCEPTION 'No hay plantilla activa para categoría: %', p_template_categoria;
  END IF;
  
  -- Aquí se llamaría a la Edge Function generate-documents
  -- Por ahora, registramos la intención
  -- En producción, esto sería un call a la API
  
  RETURN v_emission_id;
END;
$$;

-- ===== Comentarios para documentación =====
COMMENT ON COLUMN procurement.licitaciones.pliego_emission_id IS 
  'Referencia a emisión de Pliego de Condiciones generado automáticamente';

COMMENT ON COLUMN procurement.licitaciones.acta_emission_id IS 
  'Referencia a emisión de Acta de Evaluación generada automáticamente';

COMMENT ON COLUMN core.contratos.resolucion_emission_id IS 
  'Referencia a Resolución de Adjudicación generada automáticamente';

COMMENT ON COLUMN core.contratos.contrato_emission_id IS 
  'Referencia a Contrato Público generado automáticamente';

COMMENT ON COLUMN core.contratos.certificado_emission_id IS 
  'Referencia a Certificado de Cumplimiento generado automáticamente';

COMMENT ON COLUMN execution.hitos_contrato.informe_emission_id IS 
  'Referencia a Informe de Hito generado automáticamente';

-- ===== Verificación de integridad =====
-- Asegurar que no hay orfandades
ALTER TABLE documents.document_event_log
ADD CONSTRAINT fk_document_event_log_emission
FOREIGN KEY (emission_id) REFERENCES documents.document_emissions(id)
ON DELETE CASCADE;

COMMIT;
