import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { Users, Plus, Edit2, CheckCircle } from 'lucide-react'

interface Profile {
  id: string
  nombre_completo: string
  cargo?: string
  email_institucional?: string
  telefono?: string
  institucion_id?: string
  rol_sistema_id?: string
  estado: 'activo' | 'suspendido'
  fecha_creacion: string
  updated_at: string
  roles_sistema?: { nombre_rol: string }
  instituciones?: { nombre_oficial: string }
}

interface Institucion {
  id: string
  nombre_oficial: string
}

interface Rol {
  id: string
  nombre_rol: string
}

export function PerfilesList() {
  const { isAdminNacional } = useAuth()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [instituciones, setInstituciones] = useState<Institucion[]>([])
  const [roles, setRoles] = useState<Rol[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    nombre_completo: '',
    cargo: '',
    email_institucional: '',
    telefono: '',
    institucion_id: '',
    rol_sistema_id: '',
    estado: 'activo' as const,
  })

  const loadData = async () => {
    setLoading(true)
    try {
      // Load profiles with relations
      const { data: profilesData, error: profilesErr } = await supabase
        .schema('core')
        .from('profiles')
        .select(`
          id, nombre_completo, cargo, email_institucional, telefono,
          institucion_id, rol_sistema_id, estado, fecha_creacion, updated_at,
          roles_sistema (nombre_rol),
          instituciones (nombre_oficial)
        `)
        .order('nombre_completo')

      if (profilesErr) throw profilesErr

      // Load instituciones for dropdown
      const { data: institucionesData, error: institucionesErr } = await supabase
        .schema('core')
        .from('instituciones')
        .select('id, nombre_oficial')
        .eq('estado', 'activa')
        .order('nombre_oficial')

      if (institucionesErr) throw institucionesErr

      // Load roles for dropdown
      const { data: rolesData, error: rolesErr } = await supabase
        .schema('core')
        .from('roles_sistema')
        .select('id, nombre_rol')
        .order('nombre_rol')

      if (rolesErr) throw rolesErr

      setProfiles(profilesData || [])
      setInstituciones(institucionesData || [])
      setRoles(rolesData || [])
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
      nombre_completo: '',
      cargo: '',
      email_institucional: '',
      telefono: '',
      institucion_id: '',
      rol_sistema_id: '',
      estado: 'activo',
    })
    setEditingId(null)
  }

  const handleOpenEdit = (profile: Profile) => {
    setForm({
      nombre_completo: profile.nombre_completo,
      cargo: profile.cargo || '',
      email_institucional: profile.email_institucional || '',
      telefono: profile.telefono || '',
      institucion_id: profile.institucion_id || '',
      rol_sistema_id: profile.rol_sistema_id || '',
      estado: profile.estado,
    })
    setEditingId(profile.id)
    setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.nombre_completo.trim()) {
      setError('Nombre completo es obligatorio.')
      return
    }
    if (!form.rol_sistema_id) {
      setError('Rol es obligatorio.')
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        // Update existing profile
        const { error: err } = await supabase
          .schema('core')
          .from('profiles')
          .update({
            nombre_completo: form.nombre_completo.trim(),
            cargo: form.cargo.trim() || null,
            email_institucional: form.email_institucional.trim() || null,
            telefono: form.telefono.trim() || null,
            institucion_id: form.institucion_id || null,
            rol_sistema_id: form.rol_sistema_id,
            estado: form.estado,
          })
          .eq('id', editingId)

        if (err) throw err
      } else {
        // Note: Creating profiles requires auth setup (user must exist first)
        // This is a limitation we'll address in next phase
        setError('La creación de perfiles requiere usuario previo en Supabase Auth')
        setSaving(false)
        return
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

  const handleToggleEstado = async (profile: Profile) => {
    setSaving(true)
    try {
      const newEstado = profile.estado === 'activo' ? 'suspendido' : 'activo'
      const { error: err } = await supabase
        .schema('core')
        .from('profiles')
        .update({ estado: newEstado })
        .eq('id', profile.id)

      if (err) throw err
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!isAdminNacional) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-institucional-dark">Perfiles</h2>
        <p className="text-gray-500">Solo el Admin Nacional puede gestionar perfiles de usuario.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-institucional-dark">Gestión de perfiles</h2>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => { if (!showForm) resetForm(); setShowForm(!showForm) }}>
          {showForm ? 'Cancelar' : 'Nuevo perfil'}
        </Button>
      </div>

      {showForm && (
        <Card
          title={editingId ? 'Editar perfil' : 'Nuevo perfil'}
          subtitle={editingId ? 'Actualice los datos del perfil' : 'Asigne rol e institución a un usuario existente'}
        >
          <form onSubmit={handleSave} className="space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}

            <div>
              <label className="pnccp-label">Nombre completo *</label>
              <input
                type="text"
                value={form.nombre_completo}
                onChange={(e) => setForm((f) => ({ ...f, nombre_completo: e.target.value }))}
                className="pnccp-input"
                placeholder="Ej. Juan Pérez García"
                required
              />
            </div>

            <div>
              <label className="pnccp-label">Cargo (opcional)</label>
              <input
                type="text"
                value={form.cargo}
                onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}
                className="pnccp-input"
                placeholder="Ej. Director de Compras"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="pnccp-label">Email institucional (opcional)</label>
                <input
                  type="email"
                  value={form.email_institucional}
                  onChange={(e) => setForm((f) => ({ ...f, email_institucional: e.target.value }))}
                  className="pnccp-input"
                  placeholder="usuario@institucion.gq"
                />
              </div>

              <div>
                <label className="pnccp-label">Teléfono (opcional)</label>
                <input
                  type="tel"
                  value={form.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                  className="pnccp-input"
                  placeholder="Ej. +240 333 111 222"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="pnccp-label">Institución *</label>
                <select
                  value={form.institucion_id}
                  onChange={(e) => setForm((f) => ({ ...f, institucion_id: e.target.value }))}
                  className="pnccp-input"
                  required
                >
                  <option value="">Seleccione institución</option>
                  {instituciones.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nombre_oficial}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="pnccp-label">Rol *</label>
                <select
                  value={form.rol_sistema_id}
                  onChange={(e) => setForm((f) => ({ ...f, rol_sistema_id: e.target.value }))}
                  className="pnccp-input"
                  required
                >
                  <option value="">Seleccione rol</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre_rol}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {editingId && (
              <div>
                <label className="pnccp-label">Estado</label>
                <select
                  value={form.estado}
                  onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value as any }))}
                  className="pnccp-input"
                >
                  <option value="activo">Activo</option>
                  <option value="suspendido">Suspendido</option>
                </select>
              </div>
            )}

            <Button type="submit" loading={saving}>
              {editingId ? 'Actualizar perfil' : 'Crear perfil'}
            </Button>
          </form>
        </Card>
      )}

      <Card title="Perfiles de usuario" subtitle="Administración de usuarios del sistema por rol e institución">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-institucional-primary border-t-transparent" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Users className="h-12 w-12 mb-3" />
            <p>No hay perfiles registrados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Rol</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Institución</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {profiles.map((profile) => (
                  <tr key={profile.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{profile.nombre_completo}</p>
                        <p className="text-xs text-gray-500">{profile.cargo || '—'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {(profile as any).roles_sistema?.nombre_rol || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {(profile as any).instituciones?.nombre_oficial || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge estado={profile.estado === 'activo' ? 'activo' : 'neutro'}>
                        {profile.estado}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenEdit(profile)}
                          className="text-institucional-primary hover:text-institucional-dark"
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleEstado(profile)}
                          className={profile.estado === 'activo' ? 'text-orange-500 hover:text-orange-700' : 'text-green-600 hover:text-green-800'}
                          title={profile.estado === 'activo' ? 'Suspender' : 'Activar'}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
