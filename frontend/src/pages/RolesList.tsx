import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { Shield, Plus } from 'lucide-react'

interface Rol {
  id: string
  nombre_rol: string
  nivel_acceso: number
  descripcion?: string
  created_at: string
}

interface Permiso {
  id: string
  codigo_permiso: string
  descripcion?: string
  modulo?: string
}

interface RolConPermisos extends Rol {
  permisos?: Permiso[]
}

export function RolesList() {
  const { isAdminNacional } = useAuth()
  const [roles, setRoles] = useState<RolConPermisos[]>([])
  const [permisos, setPermisos] = useState<Permiso[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [expandedRol, setExpandedRol] = useState<string | null>(null)
  const [form, setForm] = useState({
    nombre_rol: '',
    nivel_acceso: 0,
    descripcion: '',
    permisos_ids: [] as string[],
  })

  const loadData = async () => {
    setLoading(true)
    try {
      // Load roles
      const { data: rolesData, error: rolesErr } = await supabase
        .schema('core')
        .from('roles_sistema')
        .select('*')
        .order('nivel_acceso')

      if (rolesErr) throw rolesErr

      // Load permisos
      const { data: permisosData, error: permisosErr } = await supabase
        .schema('core')
        .from('permisos')
        .select('*')
        .order('modulo, codigo_permiso')

      if (permisosErr) throw permisosErr

      // Load roles_permisos (join table)
      const { data: rolesPermisosData, error: rolesPermisosErr } = await supabase
        .schema('core')
        .from('roles_permisos')
        .select('rol_id, permisos(id, codigo_permiso, descripcion, modulo)')

      if (rolesPermisosErr) throw rolesPermisosErr

      // Map permisos to roles
      const rolesMap = new Map(rolesData?.map((r) => [r.id, { ...r, permisos: [] as Permiso[] }]))

      rolesPermisosData?.forEach((rp: any) => {
        const rol = rolesMap.get(rp.rol_id)
        if (rol && rp.permisos) {
          rol.permisos?.push(rp.permisos)
        }
      })

      setRoles(Array.from(rolesMap.values()))
      setPermisos(permisosData || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const resetForm = () => {
    setForm({
      nombre_rol: '',
      nivel_acceso: 0,
      descripcion: '',
      permisos_ids: [],
    })
    setEditingId(null)
  }

  const handleOpenEdit = (rol: RolConPermisos) => {
    setForm({
      nombre_rol: rol.nombre_rol,
      nivel_acceso: rol.nivel_acceso,
      descripcion: rol.descripcion || '',
      permisos_ids: rol.permisos?.map((p) => p.id) || [],
    })
    setEditingId(rol.id)
    setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.nombre_rol.trim()) {
      setError('Nombre del rol es obligatorio.')
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        // Update rol
        const { error: err } = await supabase
          .schema('core')
          .from('roles_sistema')
          .update({
            nombre_rol: form.nombre_rol.trim(),
            nivel_acceso: form.nivel_acceso,
            descripcion: form.descripcion.trim() || null,
          })
          .eq('id', editingId)

        if (err) throw err

        // Update permisos (delete old, insert new)
        const { error: delErr } = await supabase
          .schema('core')
          .from('roles_permisos')
          .delete()
          .eq('rol_id', editingId)

        if (delErr) throw delErr

        if (form.permisos_ids.length > 0) {
          const { error: insErr } = await supabase
            .schema('core')
            .from('roles_permisos')
            .insert(
              form.permisos_ids.map((pId) => ({
                rol_id: editingId,
                permiso_id: pId,
              }))
            )

          if (insErr) throw insErr
        }
      } else {
        // Create new rol
        const { data: newRol, error: createErr } = await supabase
          .schema('core')
          .from('roles_sistema')
          .insert({
            nombre_rol: form.nombre_rol.trim(),
            nivel_acceso: form.nivel_acceso,
            descripcion: form.descripcion.trim() || null,
          })
          .select()
          .single()

        if (createErr) throw createErr

        // Insert permisos
        if (form.permisos_ids.length > 0) {
          const { error: permErr } = await supabase
            .schema('core')
            .from('roles_permisos')
            .insert(
              form.permisos_ids.map((pId) => ({
                rol_id: newRol.id,
                permiso_id: pId,
              }))
            )

          if (permErr) throw permErr
        }
      }

      resetForm()
      setShowForm(false)
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleTogglePermiso = (permiso_id: string) => {
    setForm((f) => ({
      ...f,
      permisos_ids: f.permisos_ids.includes(permiso_id)
        ? f.permisos_ids.filter((id) => id !== permiso_id)
        : [...f.permisos_ids, permiso_id],
    }))
  }

  if (!isAdminNacional) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-institucional-dark">Roles</h2>
        <p className="text-gray-500">Solo el Admin Nacional puede gestionar roles del sistema.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-institucional-dark">Gestión de roles</h2>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => { if (!showForm) resetForm(); setShowForm(!showForm) }}>
          {showForm ? 'Cancelar' : 'Nuevo rol'}
        </Button>
      </div>

      {showForm && (
        <Card
          title={editingId ? 'Editar rol' : 'Nuevo rol'}
          subtitle={editingId ? 'Actualice los datos y permisos del rol' : 'Cree un nuevo rol con permisos asociados'}
        >
          <form onSubmit={handleSave} className="space-y-6">
            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="pnccp-label">Nombre del rol *</label>
                <input
                  type="text"
                  value={form.nombre_rol}
                  onChange={(e) => setForm((f) => ({ ...f, nombre_rol: e.target.value }))}
                  className="pnccp-input"
                  placeholder="Ej. Supervisor de Licitaciones"
                  required
                />
              </div>

              <div>
                <label className="pnccp-label">Nivel de acceso</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.nivel_acceso}
                  onChange={(e) => setForm((f) => ({ ...f, nivel_acceso: parseInt(e.target.value) || 0 }))}
                  className="pnccp-input"
                  placeholder="Ej. 50"
                />
              </div>
            </div>

            <div>
              <label className="pnccp-label">Descripción (opcional)</label>
              <textarea
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                className="pnccp-input"
                placeholder="Descripción de responsabilidades y alcance"
                rows={3}
              />
            </div>

            <div>
              <label className="pnccp-label">Permisos asociados</label>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {permisos.map((permiso) => (
                  <div key={permiso.id} className="flex items-start">
                    <input
                      type="checkbox"
                      id={`permiso-${permiso.id}`}
                      checked={form.permisos_ids.includes(permiso.id)}
                      onChange={() => handleTogglePermiso(permiso.id)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-institucional-primary focus:ring-institucional-primary"
                    />
                    <label htmlFor={`permiso-${permiso.id}`} className="ml-2 cursor-pointer">
                      <p className="text-sm font-medium text-gray-900">{permiso.codigo_permiso}</p>
                      {permiso.descripcion && (
                        <p className="text-xs text-gray-500">{permiso.descripcion}</p>
                      )}
                      {permiso.modulo && (
                        <p className="text-xs text-gray-400">{permiso.modulo}</p>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <Button type="submit" loading={saving}>
              {editingId ? 'Actualizar rol' : 'Crear rol'}
            </Button>
          </form>
        </Card>
      )}

      <Card title="Roles del sistema" subtitle="Administración de roles, niveles de acceso y permisos">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-institucional-primary border-t-transparent" />
          </div>
        ) : roles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Shield className="h-12 w-12 mb-3" />
            <p>No hay roles registrados.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {roles.map((rol) => (
              <div key={rol.id} className="border border-gray-200 rounded-lg">
                <button
                  onClick={() => setExpandedRol(expandedRol === rol.id ? null : rol.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
                >
                  <div className="flex-1 text-left">
                    <h3 className="font-medium text-gray-900">{rol.nombre_rol}</h3>
                    {rol.descripcion && (
                      <p className="text-sm text-gray-600 mt-1">{rol.descripcion}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge estado={rol.nivel_acceso > 50 ? 'alerta' : 'activo'}>
                      Nivel {rol.nivel_acceso}
                    </Badge>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenEdit(rol)
                      }}
                      className="text-institucional-primary hover:text-institucional-dark text-sm font-medium"
                    >
                      Editar
                    </button>
                  </div>
                </button>

                {expandedRol === rol.id && (
                  <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
                    {rol.permisos && rol.permisos.length > 0 ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {rol.permisos.map((perm) => (
                          <div key={perm.id} className="text-sm">
                            <p className="font-medium text-gray-900">{perm.codigo_permiso}</p>
                            {perm.descripcion && (
                              <p className="text-xs text-gray-600">{perm.descripcion}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Sin permisos asignados.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
