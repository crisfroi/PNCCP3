# ETAPA 5: Automatización Documental Avanzada - PLAN DE EJECUCIÓN

## Objetivo General

Implementar un **sistema central de generación documental inteligente**, capaz de producir documentos **jurídicamente consistentes**, versionados, auditables y configurables por la Administración, sin intervención manual.

Principio rector:
> *El documento es consecuencia del dato, no un archivo aislado.*

---

## Estructura de Implementación

### FASE 1: Base de Datos Mejorada (Migración 004)

**Archivos a crear/modificar:**
- `supabase/migrations/004_etapa5_documentos_avanzados.sql` (new)

**Cambios:**
1. Agregar campos a `documents.document_templates`:
   - `categoria TEXT` (pliego_tipo, acta_evaluacion, resolucion, contrato, informe)
   - `eventos_disparadores TEXT[]` (array de eventos que generan documento automáticamente)
   - `descripcion_usos TEXT` (textos de ayuda para admin)

2. Agregar campos a `documents.document_emissions`:
   - `estado_emision TEXT` (generado, enviado, archivado, revocado)
   - `firmante_id UUID` (perfil que generó el documento)
   - `metadata JSONB` (datos adicionales para auditoria)

3. Crear tabla `documents.document_templates_variables`:
   - `template_id UUID FK`
   - `nombre_variable TEXT` (ej. {{monto}}, {{proveedor}}, {{fecha_inicio}})
   - `descripcion TEXT`
   - `tipo_dato TEXT` (text, number, date, email)
   - `requerida BOOLEAN`

4. Crear tabla `documents.document_triggers`:
   - `id UUID PK`
   - `template_id UUID FK`
   - `evento TEXT` (adjudicacion, evaluacion_completa, contrato_vigente, etc.)
   - `condicion JSONB` (reglas: ej. si licitacion.estado='cerrada')
   - `automatico BOOLEAN` (se genera automáticamente o requiere confirmación)

5. Agregar RLS policies a todas las tablas documentales

6. Crear funciones PL/pgSQL:
   - `documents.get_template_by_categoria(categoria TEXT)`
   - `documents.check_trigger_eligibility(template_id, evento, entidad_origen, entidad_id)`
   - `documents.register_emission(template_id, entidad_origen, entidad_id, usuario_id, metadata)`

---

### FASE 2: Frontend - Gestión de Plantillas (DocumentosPage.tsx)

**Ruta:** `/documentos`

**Funcionalidades:**
1. Listado de plantillas activas
2. Crear nueva plantilla
   - Nombre, tipo, categoría
   - Formato (PDF, Word, Excel)
   - Contenido base (texto enriquecido o JSON)
   - Variables requeridas
   - Eventos que disparan generación automática

3. Editar plantilla existente
   - Vista previa con variables
   - Versionado automático

4. Activar/desactivar plantillas
   - Template en estado 'activo' es la que se usa
   - Antiguas pasan a 'obsoleto' con historial

5. Ver emisiones desde plantilla
   - Listado histórico de documentos generados

**Componentes:**
- `Card` (plantilla)
- `Badge` (estado, tipo)
- `Button` (editar, activar, ver emisiones)

**Acceso:**
- Admin Nacional: crear, editar, activar plantillas nacionales
- Admin Institucional: crear plantillas institucionales
- Técnico/Auditor: solo lectura

---

### FASE 3: Frontend - Emisiones Documentales (EmisionesDocumentalesPage.tsx)

**Ruta:** `/emisiones-documentales`

**Funcionalidades:**
1. Listado centralizado de todas las emisiones
2. Filtros:
   - Por tipo de documento
   - Por categoría
   - Por estado (generado, enviado, archivado)
   - Por rango de fechas
   - Por usuario generador

3. Vista expandible por emisión:
   - Metadata: qué datos se utilizaron
   - Quién generó, cuándo
   - Historial de cambios
   - Link para descargar/visualizar

4. Operaciones:
   - Descargar documento
   - Exportar a diferentes formatos
   - Archivar emisión
   - Auditar cambios

**Acceso:**
- Admin Nacional: todas las emisiones
- Admin Institucional: emisiones de su institución
- Técnico: lectura
- Auditor: lectura global

---

### FASE 4: Edge Function Mejorada (generate-documents)

**Mejoras:**

1. **Motor de interpolación de variables:**
   - Recibe `template_id`, `entidad_origen`, `entidad_id`
   - Fetch de plantilla + variables
   - Fetch de datos de entidad (expediente, contrato, licitación, etc.)
   - Mapeo variable ↔ dato
   - Validación: todas las variables requeridas están presentes

2. **Motor de generación:**
   - PDF: usar librería `@deno/pdf-lib` o similar
   - Word: usar `docx` library
   - Excel: usar `xlsx` library
   - Todas las templates en formato base (HTML para PDF, XML para Word, JSON para Excel)

3. **Almacenamiento:**
   - Guardar en Storage bajo ruta: `documents/{entidad_origen}/{entidad_id}/{template_tipo}_v{version}_{timestamp}.{formato}`
   - Calcular hash SHA256 del contenido
   - Registrar en `document_emissions`

4. **Respuesta:**
   ```json
   {
     "success": true,
     "emission_id": "uuid",
     "url_storage": "path",
     "hash_documento": "sha256",
     "fecha_emision": "2025-01-01T12:00:00Z",
     "metadata": { ... }
   }
   ```

---

### FASE 5: Integraciones en Módulos Existentes

#### A. AdjudicacionesPage.tsx (M6)
- Al adjudicar: generar automáticamente documento de **resolución de adjudicación**
- Al crear contrato: generar automáticamente documento de **contrato**
- Mostrar botón "Ver documento" si ya fue generado
- Mostrar spinner mientras se genera

#### B. EvaluacionesPage.tsx (M5)
- Al guardar evaluación de última oferta de una licitación: generar **acta de evaluación**
- Link a documento generado en listado de evaluaciones

#### C. ContratosList.tsx (M7)
- Al crear hito: opción de generar automáticamente **informe de hito**
- Al cambiar estado contrato: generar **certificado de estado**

#### D. LicitacionesList.tsx (M4)
- Al publicar licitación: generar **pliego de condiciones**
- Al cerrar licitación: generar **acta de cierre de licitación**

---

### FASE 6: Tipos de Documentos a Implementar (MVP)

1. **Pliego de Condiciones** (tipo: pliego)
   - Disparador: publicar licitación
   - Variables: objeto, presupuesto, fecha_cierre, requisitos
   - Formato: PDF + Word

2. **Acta de Evaluación** (tipo: acta)
   - Disparador: completar evaluación de licitación
   - Variables: ofertas_evaluadas, puntuaciones, observaciones
   - Formato: PDF + Excel

3. **Resolución de Adjudicación** (tipo: resolucion)
   - Disparador: adjudicar licitación
   - Variables: ganador, monto, fundamento
   - Formato: PDF

4. **Contrato** (tipo: contrato)
   - Disparador: crear contrato (post-adjudicación)
   - Variables: partes, objeto, monto, fechas, responsable
   - Formato: PDF + Word

---

### FASE 7: Documentación (docs/etapa5-automatizacion-documental.md)

Documento completo con:
- Arquitectura
- Tablas y RLS
- Edge Functions
- Flujos de trabajo
- Ejemplos de variables
- Guía de creación de nuevas plantillas
- Casos de uso

---

## Orden de Implementación

1. ✅ Fase 1: Migración 004
2. ✅ Fase 2: DocumentosPage.tsx
3. ✅ Fase 3: EmisionesDocumentalesPage.tsx
4. ✅ Fase 4: Mejorar Edge Function
5. ✅ Fase 5: Integraciones (paso a paso)
6. ✅ Fase 6: Tipos de documentos
7. ✅ Fase 7: Documentación final

---

## Criterios de Aceptación

- [ ] Migración 004 aplicada correctamente
- [ ] Páginas CRUD de documentos funcionan
- [ ] Edge Function genera documentos sin errores
- [ ] Documentos se guardan en Storage
- [ ] Auditoría registra todas las emisiones
- [ ] Integraciones disparan generación automática
- [ ] Documentos se pueden descargar
- [ ] UI consistente con Etapa 4
- [ ] Documentación completa

---

## Notas Técnicas

- Usar RLS para restringir acceso según rol e institución
- Versionado automático: vieja template → obsoleto, nueva → activo
- Documentos nunca se borran (solo se archivan)
- Hash para verificación de integridad
- Metadata para auditoría completa
- Sin firma electrónica en esta etapa (preparado para futura integración)

