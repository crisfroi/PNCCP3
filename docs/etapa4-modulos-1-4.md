# ETAPA 4: Módulos 1-4 - Completos

## Resumen general
Se han implementado 4 de 8 módulos del sistema PNCCP en ETAPA 4. Se sigue el patrón de CRUD con control de acceso basado en roles.

---

## M1: Gestión Institucional ✅

### Objetivo
Administrar instituciones públicas, perfiles de usuario y roles del sistema.

### Archivos creados/modificados
- **`frontend/src/pages/PerfilesList.tsx`** (new): Gestión completa de perfiles
  - CRUD de perfiles (crear, editar, listar, cambiar estado)
  - Asignación de institución y rol a usuarios
  - Solo visible para Admin Nacional
  
- **`frontend/src/pages/RolesList.tsx`** (new): Gestión de roles y permisos
  - Listado expandible de roles con permisos asociados
  - CRUD de roles
  - Asignación de permisos a roles
  - Solo visible para Admin Nacional

- **`frontend/src/pages/InstitucionesList.tsx`** (enhanced): 
  - Agregado: Edición de instituciones existentes
  - Agregado: Toggle de estado (activa/inactiva)
  - Mantiene: Creación de instituciones (preexistente)

- **`frontend/src/App.tsx`**: 
  - Rutas `/perfiles` y `/roles` agregadas

- **`frontend/src/components/layout/Sidebar.tsx`**:
  - Items de navegación para Perfiles y Roles (visible Admin Nacional)

### Funcionalidades
- Crear, editar, listar instituciones
- Crear, editar, listar perfiles con asignación de rol e institución
- Crear, editar, listar roles con permisos asociados
- Control de estado (activo/suspendido/inhabilitado según tipo)
- RLS validado en Supabase

### Acceso
- Admin Nacional: acceso total
- Otros roles: solo lectura de instituciones

---

## M2: Registro Nacional de Proveedores (RNP) ✅

### Objetivo
Gestionar registro centralizado de proveedores, sus documentos y estados de habilitación.

### Archivos creados/modificados
- **`frontend/src/pages/ProveedoresList.tsx`** (enhanced):
  - CRUD completo de proveedores (crear, editar, listar, eliminar)
  - Gestión de documentos asociados (ver, eliminar)
  - Estados: activo, suspendido, inhabilitado
  - Tipos: empresa, autónomo, consorcio
  - Filtros por estado y búsqueda
  - Interfaz expandible por proveedor

### Funcionalidades
- Crear proveedores con datos básicos (razón social, NIF, país, tipo)
- Editar datos del proveedor
- Cambiar estado (activo → suspendido → inhabilitado → activo)
- Ver documentos asociados con estado (vigente, vencido, rechazado)
- Eliminar proveedores y documentos
- Validación de campos obligatorios

### Acceso
- Admin Nacional / Admin Institucional: acceso total
- Proveedor: acceso a `/proveedores/mi-perfil` (preexistente)
- Auditor: lectura

### Documentos
- Tabla `rnp.proveedor_documentos` integrada
- Muestra tipo_documento, fecha_vencimiento, estado
- Permite eliminación de documentos

---

## M3: Expedientes de Contratación ✅

### Objetivo
Crear y gestionar expedientes de contratación pública con ciclo de vida completo.

### Archivos (ya existían en ETAPA 3)
- **`frontend/src/pages/WizardNuevoExpediente.tsx`**: 
  - Wizard de 6 pasos para crear expedientes
  - Generación automática de códigos via Edge Function
  - Validación por paso

- **`frontend/src/pages/ExpedientesList.tsx`**:
  - Listado con filtros por estado y búsqueda
  - Integración con tipos de procedimiento y estados

- **`frontend/src/pages/ExpedienteDetail.tsx`**:
  - Visualización completa del expediente
  - Datos del procedimiento y presupuesto

### Funcionalidades (de ETAPA 3, validadas)
- Crear expediente mediante wizard (6 pasos)
- Generar código único automático (año + institución + tipo + secuencia)
- Filtrar expedientes por estado (borrador, en_tramite, licitacion, etc.)
- Ver detalles completos del expediente
- Transiciones de estado via sistema

### Acceso
- Admin Nacional / Admin Institucional: crear expedientes
- Técnico / Auditor: lectura y búsqueda
- Proveedor: búsqueda pública (licitaciones)

---

## M4: Licitación Electrónica ✅

### Objetivo
Crear y gestionar licitaciones electrónicas asociadas a expedientes.

### Archivos creados/modificados
- **`frontend/src/pages/LicitacionesList.tsx`** (rewritten):
  - CRUD completo de licitaciones
  - Estados: borrador → publicada → cerrada → adjudicada
  - Transiciones automáticas (Publicar, Cerrar)
  - Interfaz de listado con búsqueda y filtros

### Funcionalidades
- Crear licitación (asociada a expediente)
- Editar fechas y estado
- Publicar licitación (estado borrador → publicada, asigna fecha_publicacion)
- Cerrar licitación (estado publicada → cerrada)
- Eliminar licitaciones en borrador o cerrado
- Filtros por estado y búsqueda por expediente/objeto
- Cálculo automático de presupuesto desde expediente

### Acceso
- Admin Nacional / Admin Institucional: acceso total (crear, editar, publicar, cerrar)
- Técnico / Auditor: lectura
- Proveedor: búsqueda de licitaciones publicadas

### Estados y transiciones
```
borrador --[Publicar]--> publicada --[Cerrar]--> cerrada --[Adjudicar]--> adjudicada
```

### Integración
- FK a `core.expedientes`
- Fecha cierre requerida
- Fecha publicación se asigna al publicar
- Preparado para ofertas (M5)

---

## Patrón implementado

Todos los módulos siguen un patrón consistente:

### Frontend
1. Página CRUD (ej: `InstitucionesList.tsx`)
2. Estados para formulario (crear/editar)
3. Validación por campo
4. Carga de relaciones (joins)
5. Permisos según rol (`useAuth()`)
6. UI con Card, Badge, Button reutilizables

### Base de datos
- Queries con `schema('core'/'rnp'/'procurement')`
- Selecciones con joins (`.select(...)`)
- Índices existentes (creados en migrations)
- RLS policies en lugar (migrations/002_rls_policies.sql)

### UX/UI
- Formulario deslizable (showForm state)
- Listado expandible o tabla
- Badges de estado con colores
- Botones de acción (Editar, Eliminar, Cambiar estado)
- Validación inline de errores
- Spinner de carga

---

## Próximos pasos

### M5: Evaluación Técnica y Económica
- Gestión de ofertas (proveedor_id, licitacion_id, monto)
- Evaluaciones (puntuaciones técnica y económica)
- Cálculo de puntuación total

### M6: Adjudicación y Contratación
- Selección de ganador
- Generación de contrato
- Asignación de responsable

### M7: Ejecución y Seguimiento
- Hitos contractuales
- Seguimiento de cumplimiento
- Cambios de estado

### M8: Control, Auditoría y Transparencia
- Logs inmutables
- Reportes por rango de fechas
- Exportación de datos

---

## Notas técnicas

### RLS y Seguridad
- Todas las operaciones respetan RLS policies
- Admin Nacional tiene acceso global
- Admin Institucional limitado a su institución
- Proveedores solo ven sus datos

### Validación
- Frontend: validación de campos requeridos
- Backend: RLS policies enforced en Supabase
- Constraints: CHECK en tablas (ej: estado IN (...)

### Performance
- Índices en campos de filtro (estado, fecha, tipo)
- Queries con joins optimizadas
- Carga asíncrona con spinners

