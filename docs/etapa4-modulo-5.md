# ETAPA 4: Módulo 5 - Evaluación Técnica y Económica ✅

## Objetivo
Gestionar ofertas presentadas en licitaciones y evaluarlas con puntajes técnicos y económicos.

## Archivos creados/modificados

### **`frontend/src/pages/OfeertasLicitacionDetail.tsx`** (new)
Página para ver ofertas de una licitación específica y crear nuevas ofertas.

**Rutas:** `/licitaciones/:id/ofertas`

**Funcionalidades:**
- Ver listado de ofertas para una licitación
- Crear nueva oferta (proveedor_id, monto)
- Ver estado de cada oferta (presentada, abierta, descartada, adjudicada)
- Mostrar evaluaciones si existen (puntajes técnico, económico, total)
- Expandible por oferta para ver detalles
- Eliminar ofertas (antes de evaluación)
- Restricción: solo crear ofertas si licitación está en estado 'abierta' o 'adjudicada'

**Campos:**
- Proveedor (FK a rnp.proveedores)
- Monto (XAF)
- Estado (presentada por defecto)
- Fecha de envío (automática)
- Evaluaciones relacionadas (si existen)

### **`frontend/src/pages/EvaluacionesPage.tsx`** (new)
Página centralizada para evaluar ofertas (para técnicos y evaluadores).

**Rutas:** `/evaluaciones`

**Funcionalidades:**
- Listado de ofertas por evaluar (estado = 'presentada')
- Crear/editar evaluaciones
- Ingresar puntajes (técnico: 0-100, económico: 0-100)
- Calcular puntaje total (suma de ambos)
- Agregar observaciones (opcional)
- Cambiar estado de oferta a 'abierta' al evaluar
- Filtro por estado (sin evaluar, evaluadas, todas)
- Expandible por oferta para ver detalles

**Campos de evaluación:**
- Puntuación técnica (0-100)
- Puntuación económica (0-100)
- Puntuación total (suma automática)
- Observaciones (texto opcional)
- Evaluador (perfil del usuario)
- Fecha de evaluación (automática)

### **`frontend/src/App.tsx`** (modified)
- Ruta `/licitaciones/:id/ofertas` → OfeertasLicitacionDetail
- Ruta `/evaluaciones` → EvaluacionesPage

### **`frontend/src/components/layout/Sidebar.tsx`** (modified)
- Item de navegación "Evaluaciones" visible para: Admin Nacional, Admin Institucional, Técnico, Auditor

## Flujo de trabajo

```
1. Licitación publicada
   ↓
2. Proveedor presenta oferta (en /licitaciones/:id/ofertas)
   ↓
3. Oferta creada en estado 'presentada'
   ↓
4. Técnico evalúa en /evaluaciones (ingresa puntajes)
   ↓
5. Oferta pasa a estado 'abierta'
   ↓
6. Listo para adjudicación (M6)
```

## Estados de oferta

| Estado | Descripción | Transición |
|--------|-------------|-----------|
| `presentada` | Recién creada, sin evaluar | → `abierta` (al evaluar) |
| `abierta` | Evaluada, en consideración | → `adjudicada` o `descartada` |
| `descartada` | No cumple requisitos | Terminal |
| `adjudicada` | Seleccionada como ganadora | Terminal → contrato (M6) |

## Integración con Supabase

### Tabla: `procurement.ofertas`
```sql
- id UUID PK
- licitacion_id UUID FK
- proveedor_id UUID FK
- monto NUMERIC(18,2)
- hash_oferta TEXT
- fecha_envio TIMESTAMPTZ
- estado TEXT (presentada|abierta|descartada|adjudicada)
- UNIQUE(licitacion_id, proveedor_id)
```

### Tabla: `procurement.evaluaciones`
```sql
- id UUID PK
- oferta_id UUID FK (UNIQUE)
- puntuacion_tecnica NUMERIC(10,2)
- puntuacion_economica NUMERIC(10,2)
- puntuacion_total NUMERIC(10,2)
- observaciones TEXT
- evaluador_id UUID FK (core.profiles)
- fecha_evaluacion TIMESTAMPTZ
```

## RLS y Seguridad

- Técnicos pueden crear/editar evaluaciones
- Proveedores pueden ver sus ofertas (en /licitaciones/:id/ofertas)
- Admin puede ver todas las evaluaciones
- Auditor puede ver evaluaciones (lectura)

## UI Components reutilizados

- `Card`: Contenedor de información
- `Badge`: Estados y puntajes
- `Button`: Acciones (evaluar, eliminar)
- Expandible: Similar a M4 (licitaciones expandibles)

## Cálculos automáticos

- **Puntuación total**: suma de técnica + económica
- **Validación**: ambos puntajes ≥ 0, suma > 0
- **Estado transición**: oferta → abierta al guardar evaluación

## Notas técnicas

- Evaluaciones son 1:1 con ofertas (unique(oferta_id))
- Puntajes decimales permitidos (máx 2 decimales)
- Observaciones son opcionales
- Evaluador se registra automáticamente (session user)
- Sin borrado de evaluaciones (cambios son edit)

## Próximo paso

M6: Adjudicación y Contratación
- Seleccionar oferta ganadora
- Generar contrato
- Asignar responsable y fechas
