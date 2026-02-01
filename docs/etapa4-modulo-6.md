# ETAPA 4: Módulo 6 - Adjudicación y Contratación ✅

## Objetivo
Seleccionar oferta ganadora y generar contratos con responsables asignados.

## Archivos creados/modificados

### **`frontend/src/pages/AdjudicacionesPage.tsx`** (new)
Página centralizada para adjudicar licitaciones cerradas y generar contratos.

**Rutas:** `/adjudicaciones`

**Funcionalidades:**
- Listado de licitaciones en estado 'cerrada'
- Ver ofertas evaluadas (con puntajes técnico y económico)
- Seleccionar oferta ganadora
- Asignar responsable del contrato (perfil del usuario)
- Definir fechas de inicio y fin del contrato
- Generar contrato automáticamente con estado 'vigente'
- Actualizar estado de licitación a 'adjudicada'
- Actualizar estado de oferta seleccionada a 'adjudicada'
- Expandible por licitación para ver ofertas y formulario

**Campos del contrato generado:**
- expediente_id (FK desde licitación)
- proveedor_id (desde oferta seleccionada)
- monto_adjudicado (desde oferta)
- fecha_inicio (usuario define)
- fecha_fin (usuario define)
- responsable_id (usuario selecciona)
- estado (siempre 'vigente' al crear)
- url_contrato (NULL, para futura integración con documentos)

### **`frontend/src/App.tsx`** (modified)
- Ruta `/adjudicaciones` → AdjudicacionesPage

### **`frontend/src/components/layout/Sidebar.tsx`** (modified)
- Item de navegación "Adjudicaciones" visible para: Admin Nacional, Admin Institucional, Auditor

## Flujo de trabajo

```
1. Licitación en estado 'cerrada' (desde M4)
   ↓
2. Ofertas evaluadas (desde M5)
   ↓
3. Admin selecciona oferta ganadora en /adjudicaciones
   ↓
4. Define responsable y fechas
   ↓
5. Sistema crea contrato en estado 'vigente'
   ↓
6. Licitación → 'adjudicada'
   ↓
7. Oferta → 'adjudicada'
   ↓
8. Listo para ejecución (M7)
```

## Validaciones

- Solo licitaciones en estado 'cerrada' (filtrado automático)
- Solo ofertas en estado 'abierta' (filtrado en dropdown)
- Debe seleccionar oferta ganadora
- Debe asignar responsable activo
- Fecha fin > fecha inicio
- Fechas obligatorias

## Integración con Supabase

### Tabla: `core.contratos` (creado)
```sql
INSERT INTO core.contratos (
  expediente_id,
  proveedor_id,
  monto_adjudicado,
  fecha_inicio,
  fecha_fin,
  estado,
  responsable_id
)
```

### Estados de licitación
- 'cerrada' → 'adjudicada' (automático al adjudicar)

### Estados de oferta
- 'abierta' → 'adjudicada' (automático al seleccionar como ganadora)

## RLS y Seguridad

- Solo Admin Nacional y Admin Institucional pueden adjudicar
- Auditor puede ver (lectura)
- Responsable se asigna de perfiles activos
- Validación de fechas en frontend y backend

## UI Components reutilizados

- `Card`: Contenedor de información
- `Badge`: Estados
- `Button`: Acciones (adjudicar)
- Expandible: Similar a M4 y M5

## Transacciones

El sistema realiza 3 actualizaciones en secuencia:
1. Actualizar oferta → 'adjudicada'
2. Actualizar licitación → 'adjudicada'
3. Crear contrato con estado 'vigente'

Si alguna falla, se cancela todo (Supabase maneja transacciones internamente).

## Próximo paso

M7: Ejecución y Seguimiento Contractual
- Ver contratos vigentes
- Crear y seguir hitos
- Cambiar estado de contrato
