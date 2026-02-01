import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { Gavel, Search, Plus, Edit2, CheckCircle, Trash2, FileText, Loader } from 'lucide-react'

const ESTADOS = ['borrador', 'publicada', 'cerrada', 'adjudicada'] as const
const ESTADOS_FILTRO = [
  { value: '', label: 'Todos los estados' },
  { value: 'borrador', label: 'Borrador' },
  { value: 'publicada', label: 'Publicada' },
  { value: 'cerrada', label: 'Cerrada' },
  { value: 'adjudicada', label: 'Adjudicada' },
]

interface Licitacion {
  id: string
  expediente_id: string
  fecha_publicacion?: string
  fecha_cierre: string
  estado: 'borrador' | 'publicada' | 'cerrada' | 'adjudicada'
  pliego_emission_id?: string
  created_at: string
  updated_at: string
  expedientes?: {
    codigo_expediente: string
    objeto_contrato: string
    presupuesto: number
  }
}

interface Expediente {
  id: string
  codigo_expediente: string
  objeto_contrato: string
  presupuesto: number
}

export function LicitacionesList() {
  const { isAdminInstitucional, isAdminNacional } = useAuth()
  const [licitaciones, setLicitaciones] = useState<Licitacion[]>([])
  const [expedientes, setExpedientes] = useState<Expediente[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [generandoPliegos, setGenerandoPliegos] = useState<Record<string, boolean>>({})
  const [form, setForm] = useState({
    expediente_id: '',
    fecha_cierre: '',
    estado: 'borrador' as const,
    fecha_publicacion: '',
  })

  const canEdit = isAdminInstitucional || isAdminNacional

  const loadData = async () => {
    setLoading(true)
    try {
      // Load licitaciones
      let q = supabase
        .schema('procurement')
        .from('licitaciones')
        .select(`
          id, expediente_id, fecha_publicacion, fecha_cierre, estado, created_at, updated_at,
          expedientes(id, codigo_expediente, objeto_contrato, presupuesto)
        `)
        .order('fecha_cierre', { ascending: false })

      if (filtroEstado) q = q.eq('estado', filtroEstado)

      const { data: licData, error: licErr } = await q
      if (licErr) throw licErr

      // Load expedientes (for form dropdown)
      const { data: expData, error: expErr } = await supabase
        .schema('core')
        .from('expedientes')
        .select('id, codigo_expediente, objeto_contrato, presupuesto')
        .order('codigo_expediente')

      if (expErr) throw expErr

      setLicitaciones(licData || [])
      setExpedientes(expData || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [filtroEstado])

  const listFiltrada = useMemo(() => {
    if (!busqueda.trim()) return licitaciones
    const b = busqueda.trim().toLowerCase()
    return licitaciones.filter((l) => {
      const codigo = (l.expedientes as any)?.codigo_expediente ?? ''
      const objeto = (l.expedientes as any)?.objeto_contrato ?? ''
      return codigo.toLowerCase().includes(b) || objeto.toLowerCase().includes(b)
    })
  }, [licitaciones, busqueda])

  const resetForm = () => {
    setForm({
      expediente_id: '',
      fecha_cierre: '',
      estado: 'borrador',
      fecha_publicacion: '',
    })
    setEditingId(null)
  }

  const handleOpenEdit = (licitacion: Licitacion) => {
    setForm({
      expediente_id: licitacion.expediente_id,
      fecha_cierre: licitacion.fecha_cierre ? licitacion.fecha_cierre.split('T')[0] : '',
      estado: licitacion.estado,
      fecha_publicacion: licitacion.fecha_publicacion ? licitacion.fecha_publicacion.split('T')[0] : '',
    })
    setEditingId(licitacion.id)
    setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.expediente_id) {
      setError('Expediente es obligatorio.')
      return
    }
    if (!form.fecha_cierre) {
      setError('Fecha de cierre es obligatoria.')
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        const { error: err } = await supabase
          .schema('procurement')
          .from('licitaciones')
          .update({
            expediente_id: form.expediente_id,
            fecha_cierre: new Date(form.fecha_cierre).toISOString(),
            estado: form.estado,
            fecha_publicacion: form.fecha_publicacion ? new Date(form.fecha_publicacion).toISOString() : null,
          })
          .eq('id', editingId)

        if (err) throw err
      } else {
        const { error: err } = await supabase
          .schema('procurement')
          .from('licitaciones')
          .insert({
            expediente_id: form.expediente_id,
            fecha_cierre: new Date(form.fecha_cierre).toISOString(),
            estado: 'borrador',
            fecha_publicacion: null,
          })

        if (err) throw err
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

  const handlePublicar = async (licitacion: Licitacion) => {
    setSaving(true)
    try {
      const { error: err } = await supabase
        .schema('procurement')
        .from('licitaciones')
        .update({
          estado: 'publicada',
          fecha_publicacion: new Date().toISOString(),
        })
        .eq('id', licitacion.id)

      if (err) throw err
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCerrar = async (licitacion: Licitacion) => {
    setSaving(true)
    try {
      const { error: err } = await supabase
        .schema('procurement')
        .from('licitaciones')
        .update({ estado: 'cerrada' })
        .eq('id', licitacion.id)

      if (err) throw err
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (licitacionId: string) => {
    if (!confirm('¿Está seguro de eliminar esta licitación?')) return

    setSaving(true)
    try {
      const { error: err } = await supabase
        .schema('procurement')
        .from('licitaciones')
        .delete()
        .eq('id', licitacionId)

      if (err) throw err
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const estadoBadge: Record<string, string> = {
    borrador: 'borrador',
    publicada: 'publicada',
    cerrada: 'cerrado',
    adjudicada: 'activo',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-institucional-dark">Licitaciones</h2>
        {canEdit && (
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              if (!showForm) resetForm()
              setShowForm(!showForm)
            }}
          >
            {showForm ? 'Cancelar' : 'Nueva licitación'}
          </Button>
        )}
      </div>

      {canEdit && showForm && (
        <Card
          title={editingId ? 'Editar licitación' : 'Nueva licitación'}
          subtitle={editingId ? 'Actualice los datos de la licitación' : 'Cree una nueva licitación para un expediente'}
        >
          <form onSubmit={handleSave} className="space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}

            <div>
              <label className="pnccp-label">Expediente *</label>
              <select
                value={form.expediente_id}
                onChange={(e) => setForm((f) => ({ ...f, expediente_id: e.target.value }))}
                className="pnccp-input"
                required
              >
                <option value="">Seleccione expediente</option>
                {expedientes.map((exp) => (
                  <option key={exp.id} value={exp.id}>
                    {exp.codigo_expediente} - {exp.objeto_contrato}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="pnccp-label">Fecha de cierre *</label>
                <input
                  type="date"
                  value={form.fecha_cierre}
                  onChange={(e) => setForm((f) => ({ ...f, fecha_cierre: e.target.value }))}
                  className="pnccp-input"
                  required
                />
              </div>

              {editingId && (
                <div>
                  <label className="pnccp-label">Fecha de publicación</label>
                  <input
                    type="date"
                    value={form.fecha_publicacion}
                    onChange={(e) => setForm((f) => ({ ...f, fecha_publicacion: e.target.value }))}
                    className="pnccp-input"
                  />
                </div>
              )}
            </div>

            {editingId && (
              <div>
                <label className="pnccp-label">Estado</label>
                <select
                  value={form.estado}
                  onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value as any }))}
                  className="pnccp-input"
                >
                  {ESTADOS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button type="submit" loading={saving}>
              {editingId ? 'Actualizar licitación' : 'Crear licitación'}
            </Button>
          </form>
        </Card>
      )}

      <Card title="Licitaciones electrónicas" subtitle="Publicadas, en curso y cerradas">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="pnccp-input max-w-[200px]"
          >
            {ESTADOS_FILTRO.map((o) => (
              <option key={o.value || 'todos'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por expediente u objeto..."
              className="pnccp-input pl-9"
            />
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-institucional-primary border-t-transparent" />
          </div>
        ) : listFiltrada.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Gavel className="h-12 w-12 mb-3" />
            <p>{licitaciones.length === 0 ? 'No hay licitaciones.' : 'Ningún resultado con los filtros aplicados.'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {listFiltrada.map((lic) => (
              <div key={lic.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">
                      {(lic.expedientes as any)?.codigo_expediente}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {(lic.expedientes as any)?.objeto_contrato}
                    </p>
                    <div className="mt-2 flex gap-4 text-xs text-gray-500">
                      {lic.fecha_publicacion && (
                        <span>Publicada: {new Date(lic.fecha_publicacion).toLocaleDateString('es-GQ')}</span>
                      )}
                      <span>Cierre: {new Date(lic.fecha_cierre).toLocaleDateString('es-GQ')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge estado={estadoBadge[lic.estado]}>{lic.estado}</Badge>
                    {canEdit && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleOpenEdit(lic)}
                          className="text-institucional-primary hover:text-institucional-dark"
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {lic.estado === 'borrador' && (
                          <button
                            onClick={() => handlePublicar(lic)}
                            className="text-green-600 hover:text-green-800"
                            title="Publicar"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                        {lic.estado === 'publicada' && (
                          <button
                            onClick={() => handleCerrar(lic)}
                            className="text-orange-600 hover:text-orange-800"
                            title="Cerrar"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                        {(lic.estado === 'borrador' || lic.estado === 'cerrada') && (
                          <button
                            onClick={() => handleDelete(lic)}
                            className="text-red-600 hover:text-red-800"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
