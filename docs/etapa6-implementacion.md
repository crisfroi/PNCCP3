# ETAPA 6: Integraciones de Automatización Documental
## Documentación de Implementación

**Estado:** En implementación  
**Fecha inicio:** 2026-02-01  
**Proyecto:** PNCCP - Plataforma Nacional de Compras y Contratación Pública

---

## 📋 Resumen de Cambios

Esta etapa integra la generación automática de documentos (Etapa 5) con los módulos existentes M4-M7, creando un flujo donde los documentos se generan automáticamente durante los eventos clave del ciclo de contratación.

### Cambios en BD

#### 1. Nuevas Columnas

**Tabla `procurement.licitaciones`:**
```sql
pliego_emission_id UUID      -- Referencia a Pliego generado
acta_emission_id UUID        -- Referencia a Acta de Evaluación
```

**Tabla `core.contratos`:**
```sql
resolucion_emission_id UUID   -- Referencia a Resolución de Adjudicación
contrato_emission_id UUID     -- Referencia a Contrato Público
certificado_emission_id UUID  -- Referencia a Certificado de Cumplimiento
```

**Tabla `execution.hitos_contrato`:**
```sql
informe_emission_id UUID      -- Referencia a Informe de Hito
```

#### 2. Nueva Tabla: `documents.document_event_log`

Registra cada evento de generación documental para auditoría.

```sql
CREATE TABLE documents.document_event_log (
  id UUID PK,
  emission_id UUID FK,       -- Qué documento se generó
  evento TEXT,               -- Qué evento lo disparó
  entidad_tipo TEXT,         -- licitacion, contrato, hito
  entidad_id UUID,           -- ID de la entidad
  trigger_id UUID FK,        -- Qué regla disparó
  usuario_id UUID FK,        -- Quién lo generó
  created_at TIMESTAMPTZ
)
```

#### 3. Nuevas Vistas para Analítica

- `v_licitaciones_estadisticas` - Cobertura de documentos en licitaciones
- `v_contratos_estadisticas` - Cobertura de documentos en contratos
- `v_documentos_por_evento` - Agregación por evento y período
- `v_licitacion_cobertura_documental` - Detalle por licitación
- `v_contrato_cobertura_documental` - Detalle por contrato

#### 4. Nuevas Funciones PL/pgSQL

- `documents.log_document_event()` - Registra evento de generación
- `documents.generate_document_for_entity()` - Genera documento por entidad

---

## 🔧 Integraciones por Módulo

### M4: LicitacionesList.tsx → Pliego de Condiciones

**Flujo:**
```
Usuario publica licitación (cambio estado a "publicada")
  ↓
Llamar Edge Function generate-documents con:
  - template_id: plantilla activa categoría "pliego_tipo"
  - entidad_origen: "licitacion"
  - entidad_id: licitacion_id
  - variables: { objeto_contrato, presupuesto, fecha_cierre, requisitos }
  ↓
Guardar emission_id en licitaciones.pliego_emission_id
  ↓
Log evento en document_event_log
  ↓
Mostrar badge "✓ Pliego" en listado
```

**Código a agregar en LicitacionesList.tsx:**

```typescript
// 1. Nueva función para generar pliego
const generarPliego = async (licitacionId: string) => {
  try {
    const licitacion = licitaciones.find(l => l.id === licitacionId)
    if (!licitacion || !licitacion.expedientes) return

    setSaving(true)
    
    // Llamar Edge Function
    const response = await fetch('/functions/v1/generate-documents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
      },
      body: JSON.stringify({
        template_id: null, // Será obtenido por categoría en Edge Function
        entidad_origen: 'licitacion',
        entidad_id: licitacionId,
        variables: {
          objeto_contrato: licitacion.expedientes.objeto_contrato,
          presupuesto: licitacion.expedientes.presupuesto,
          fecha_cierre: licitacion.fecha_cierre,
          requisitos: 'Consultar bases de licitación' // Variable de ejemplo
        }
      })
    })

    const data = await response.json()
    
    if (data.success) {
      // Actualizar licitación con referencia a emisión
      await supabase
        .schema('procurement')
        .from('licitaciones')
        .update({ pliego_emission_id: data.emission_id })
        .eq('id', licitacionId)

      // Log evento
      await supabase
        .schema('documents')
        .from('document_event_log')
        .insert({
          emission_id: data.emission_id,
          evento: 'licitacion_publicada',
          entidad_tipo: 'licitacion',
          entidad_id: licitacionId,
          usuario_id: profile?.id
        })

      setSuccess('Pliego de Condiciones generado exitosamente')
      loadData() // Recargar para mostrar pliego
    } else {
      setError(`Error generando pliego: ${data.error}`)
    }
  } catch (err: any) {
    setError(err.message)
  } finally {
    setSaving(false)
  }
}

// 2. Llamar desde handlePublicar
const handlePublicar = async (licitacionId: string) => {
  try {
    await supabase
      .schema('procurement')
      .from('licitaciones')
      .update({ estado: 'publicada', fecha_publicacion: new Date().toISOString() })
      .eq('id', licitacionId)

    // Generar pliego automáticamente
    await generarPliego(licitacionId)
    
    loadData()
  } catch (err: any) {
    setError(err.message)
  }
}

// 3. Mostrar en vista expandible
{/* En la vista expandible de cada licitación */}
{licitacion.pliego_emission_id && (
  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
    <p className="text-sm text-green-800">
      <FileText className="inline mr-2" size={16} />
      ✓ Pliego de Condiciones generado
    </p>
    <a 
      href={`/emisiones-documentales?filter=${licitacion.pliego_emission_id}`}
      className="text-sm text-blue-600 hover:underline"
    >
      Ver documento
    </a>
  </div>
)}
```

---

### M5: EvaluacionesPage.tsx → Acta de Evaluación

**Flujo:**
```
Evaluación marcada como "completada" y todas las ofertas evaluadas
  ↓
Llamar Edge Function generate-documents con:
  - template: "acta_evaluacion"
  - entidad_origen: "licitacion"
  - entidad_id: licitacion_id
  - variables: { ofertas_evaluadas, puntuaciones, evaluador, fecha }
  ↓
Guardar emission_id en licitaciones.acta_emission_id
  ↓
Log evento
  ↓
Mostrar badge "✓ Acta" en listado de evaluaciones
```

**Código a agregar en EvaluacionesPage.tsx:**

```typescript
const generarActaEvaluacion = async (licitacionId: string) => {
  try {
    setSaving(true)

    // Obtener datos de evaluación
    const { data: ofertas } = await supabase
      .schema('procurement')
      .from('ofertas')
      .select('proveedores(razon_social), evaluaciones(puntuacion_tecnica, puntuacion_economica, puntuacion_total)')
      .eq('licitacion_id', licitacionId)

    const response = await fetch('/functions/v1/generate-documents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
      },
      body: JSON.stringify({
        entidad_origen: 'licitacion',
        entidad_id: licitacionId,
        variables: {
          ofertas_evaluadas: ofertas?.length || 0,
          evaluador: profile?.nombre_completo,
          fecha_evaluacion: new Date().toISOString()
        }
      })
    })

    const data = await response.json()
    
    if (data.success) {
      await supabase
        .schema('procurement')
        .from('licitaciones')
        .update({ acta_emission_id: data.emission_id })
        .eq('id', licitacionId)

      await supabase
        .schema('documents')
        .from('document_event_log')
        .insert({
          emission_id: data.emission_id,
          evento: 'evaluacion_completada',
          entidad_tipo: 'licitacion',
          entidad_id: licitacionId,
          usuario_id: profile?.id
        })

      setSuccess('Acta de Evaluación generada')
      loadData()
    }
  } catch (err: any) {
    setError(err.message)
  } finally {
    setSaving(false)
  }
}
```

---

### M6: AdjudicacionesPage.tsx → Resolución + Contrato

**Flujo:**
```
Usuario adjudica oferta ganadora
  ↓
FASE 1: Generar Resolución de Adjudicación
  - template: "resolucion"
  - variables: { ganador, monto, fundamento }
  ↓
FASE 2: Crear Contrato
  - En database: INSERT en core.contratos
  ↓
FASE 3: Generar Contrato Público
  - template: "contrato"
  - variables: { partes, objeto, monto, fechas }
  ↓
Guardar ambos emission_ids en contratos
  ↓
Log eventos
  ↓
Mostrar "Contrato generado - Listo para firma"
```

**Código a agregar en AdjudicacionesPage.tsx:**

```typescript
const handleAdjudicar = async (licitacionId: string, ofertaId: string) => {
  try {
    setSaving(true)
    
    // 1. Obtener datos de oferta ganadora
    const { data: oferta } = await supabase
      .schema('procurement')
      .from('ofertas')
      .select(`
        id, monto, proveedor_id,
        proveedores(razon_social),
        licitaciones(expediente_id),
        evaluaciones(puntuacion_total)
      `)
      .eq('id', ofertaId)
      .single()

    // 2. Generar Resolución
    const resolucionRes = await fetch('/functions/v1/generate-documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entidad_origen: 'licitacion',
        entidad_id: licitacionId,
        variables: {
          ganador: oferta.proveedores.razon_social,
          monto: oferta.monto,
          puntuacion: oferta.evaluaciones.puntuacion_total
        }
      })
    })

    const resolucionData = await resolucionRes.json()
    
    // 3. Crear contrato
    const { data: contrato } = await supabase
      .schema('core')
      .from('contratos')
      .insert({
        expediente_id: oferta.licitaciones.expediente_id,
        oferta_id: ofertaId,
        proveedor_id: oferta.proveedor_id,
        monto_adjudicado: oferta.monto,
        responsable_id: form.responsable_id,
        fecha_inicio: form.fecha_inicio,
        fecha_fin: form.fecha_fin,
        estado: 'vigente',
        resolucion_emission_id: resolucionData.emission_id
      })
      .select('id')
      .single()

    // 4. Generar Contrato Público
    const contratoRes = await fetch('/functions/v1/generate-documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entidad_origen: 'contrato',
        entidad_id: contrato.id,
        variables: {
          proveedor: oferta.proveedores.razon_social,
          monto: oferta.monto,
          fecha_inicio: form.fecha_inicio,
          fecha_fin: form.fecha_fin
        }
      })
    })

    const contratoData = await contratoRes.json()

    // 5. Actualizar contrato con emission_id
    await supabase
      .schema('core')
      .from('contratos')
      .update({ contrato_emission_id: contratoData.emission_id })
      .eq('id', contrato.id)

    // 6. Log eventos
    await supabase
      .schema('documents')
      .from('document_event_log')
      .insert([
        {
          emission_id: resolucionData.emission_id,
          evento: 'adjudicacion_realizada',
          entidad_tipo: 'licitacion',
          entidad_id: licitacionId,
          usuario_id: profile?.id
        },
        {
          emission_id: contratoData.emission_id,
          evento: 'contrato_creado',
          entidad_tipo: 'contrato',
          entidad_id: contrato.id,
          usuario_id: profile?.id
        }
      ])

    setSuccess('Adjudicación completada - Contrato generado')
    loadData()
  } catch (err: any) {
    setError(err.message)
  } finally {
    setSaving(false)
  }
}
```

---

### M7: ContratosList.tsx → Informes + Certificados

**Flujo para Hito:**
```
Usuario crea hito contractual y marca checkbox "Generar informe"
  ↓
Llamar Edge Function para generar Informe
  ↓
Guardar emission_id en hitos_contrato.informe_emission_id
```

**Flujo para Certificado:**
```
Usuario cambia estado contrato a "cerrado/finalizado"
  ↓
Generar automáticamente Certificado de Cumplimiento
  ↓
Guardar emission_id en contratos.certificado_emission_id
  ↓
Log evento
```

**Código a agregar en ContratosList.tsx:**

```typescript
// Generar informe de hito (opcional)
const generarInformeHito = async (hitoId: string, contratoId: string) => {
  try {
    const response = await fetch('/functions/v1/generate-documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entidad_origen: 'hito',
        entidad_id: hitoId,
        variables: {
          contrato_id: contratoId,
          fecha_informe: new Date().toISOString()
        }
      })
    })

    const data = await response.json()
    
    if (data.success) {
      await supabase
        .schema('execution')
        .from('hitos_contrato')
        .update({ informe_emission_id: data.emission_id })
        .eq('id', hitoId)
    }
  } catch (err) {
    console.error('Error generando informe:', err)
  }
}

// Generar certificado al finalizar contrato
const handleFinalizarContrato = async (contratoId: string) => {
  try {
    setSaving(true)

    // Generar certificado
    const response = await fetch('/functions/v1/generate-documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entidad_origen: 'contrato',
        entidad_id: contratoId,
        variables: {
          fecha_finalizacion: new Date().toISOString()
        }
      })
    })

    const data = await response.json()
    
    if (data.success) {
      // Actualizar contrato
      await supabase
        .schema('core')
        .from('contratos')
        .update({
          estado: 'cerrado',
          certificado_emission_id: data.emission_id
        })
        .eq('id', contratoId)

      // Log evento
      await supabase
        .schema('documents')
        .from('document_event_log')
        .insert({
          emission_id: data.emission_id,
          evento: 'contrato_finalizado',
          entidad_tipo: 'contrato',
          entidad_id: contratoId,
          usuario_id: profile?.id
        })

      setSuccess('Certificado de Cumplimiento generado')
      loadContratos()
    }
  } catch (err: any) {
    setError(err.message)
  } finally {
    setSaving(false)
  }
}
```

---

## 📊 Componente: DocumentStatusBadge

**Nuevo componente reutilizable para mostrar estado de documento:**

```typescript
// frontend/src/components/DocumentStatusBadge.tsx

import { FileText } from 'lucide-react'

interface DocumentStatusBadgeProps {
  status: 'generado' | 'enviado' | 'archivado' | 'revocado'
  emissionDate: string
  hash?: string
  onClick?: () => void
}

export function DocumentStatusBadge({
  status,
  emissionDate,
  hash,
  onClick
}: DocumentStatusBadgeProps) {
  const statusConfig = {
    generado: { bg: 'bg-blue-100', text: 'text-blue-800', icon: '📄' },
    enviado: { bg: 'bg-green-100', text: 'text-green-800', icon: '✓' },
    archivado: { bg: 'bg-gray-100', text: 'text-gray-800', icon: '📦' },
    revocado: { bg: 'bg-red-100', text: 'text-red-800', icon: '✗' }
  }

  const config = statusConfig[status]
  const date = new Date(emissionDate).toLocaleDateString('es-ES')

  return (
    <div 
      className={`${config.bg} ${config.text} px-3 py-2 rounded text-sm cursor-pointer hover:shadow-md transition`}
      onClick={onClick}
      title={`Generado: ${date}${hash ? ` - Hash: ${hash}` : ''}`}
    >
      <span>{config.icon} {status}</span>
      {hash && (
        <p className="text-xs opacity-75 mt-1">Hash: {hash.substring(0, 12)}...</p>
      )}
    </div>
  )
}
```

---

## 🎯 Testing Checklist

- [ ] Publicar licitación genera pliego automáticamente
- [ ] Completar evaluación genera acta
- [ ] Adjudicar oferta genera resolución + contrato
- [ ] Crear hito puede generar informe (opcional)
- [ ] Finalizar contrato genera certificado
- [ ] Todos los hashes SHA-256 calculados correctamente
- [ ] document_event_log registra cada evento
- [ ] RLS bloquea acceso no autorizado
- [ ] Vistas analíticas devuelven datos correctos

---

## 📈 Métricas de Cobertura

Después de implementar, verificar:

```sql
-- % de licitaciones con pliego
SELECT 
  (COUNT(CASE WHEN pliego_emission_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*)) as cobertura_pliego
FROM procurement.licitaciones;

-- % de contratos con documentación completa
SELECT
  (COUNT(CASE WHEN 
    resolucion_emission_id IS NOT NULL 
    AND contrato_emission_id IS NOT NULL 
  THEN 1 END) * 100.0 / COUNT(*)) as cobertura_completa
FROM core.contratos;
```

---

## 🚀 Próximos Pasos

Una vez completadas las integraciones M4-M7:

1. ✅ Crear Dashboard de Analítica (DashboardAnalytics.tsx)
2. ✅ Crear ReportePorInstitución.tsx
3. ✅ Mejorar exportación de reportes
4. ✅ Optimizar performance (vistas materializadas)
5. ✅ Documentación final de Etapa 6

---

**Documentación de Implementación ETAPA 6**  
Última actualización: 2026-02-01
