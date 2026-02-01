import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { ArrowLeft, Plus, Edit2, Trash2, FileText } from 'lucide-react'

interface Licitacion {
  id: string
  expediente_id: string
  fecha_publicacion?: string
  fecha_cierre: string
  estado: string
  expedientes?: {
    codigo_expediente: string
    objeto_contrato: string
    presupuesto: number
  }
}

interface Oferta {
  id: string
  licitacion_id: string
  proveedor_id: string
  monto: number
  hash_oferta?: string
  fecha_envio: string
  estado: 'presentada' | 'abierta' | 'descartada' | 'adjudicada'
  proveedores?: {
    razon_social: string
  }
  evaluaciones?: {
    puntuacion_tecnica?: number
    puntuacion_economica?: number
    puntuacion_total?: number
    observaciones?: string
  }
}

interface Proveedor {
  id: string
  razon_social: string
}

export function OfeertasLicitacionDetail() {
  const { id } = useParams<{ id: string }>()
  const { isProveedor } = useAuth()
  const [licitacion, setLicitacion] = useState<Licitacion | null>(null)
  const [ofertas, setOfertas] = useState<Oferta[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [expandedOferta, setExpandedOferta] = useState<string | null>(null)
  const [form, setForm] = useState({
    proveedor_id: '',
    monto: '',
  })

  const loadData = async () => {
    setLoading(true)
    try {
      // Load licitacion
      const { data: licData, error: licErr } = await supabase
        .schema('procurement')
        .from('licitaciones')
        .select(`
          id, expediente_id, fecha_publicacion, fecha_cierre, estado,
          expedientes(codigo_expediente, objeto_contrato, presupuesto)
        `)
        .eq('id', id)
        .single()

      if (licErr) throw licErr
      setLicitacion(licData)

      // Load ofertas with evaluations
      const { data: ofertasData, error: ofertasErr } = await supabase
        .schema('procurement')
        .from('ofertas')
        .select(`
          id, licitacion_id, proveedor_id, monto, hash_oferta, fecha_envio, estado,
          proveedores(razon_social),
          evaluaciones(puntuacion_tecnica, puntuacion_economica, puntuacion_total, observaciones)
        `)
        .eq('licitacion_id', id)
        .order('fecha_envio', { ascending: false })

      if (ofertasErr) throw ofertasErr
      setOfertas(ofertasData || [])

      // Load proveedores for dropdown
      const { data: provData, error: provErr } = await supabase
        .schema('rnp')
        .from('proveedores')
        .select('id, razon_social')
        .eq('estado', 'activo')
        .order('razon_social')

      if (provErr) throw provErr
      setProveedores(provData || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) loadData()
  }, [id])

  const resetForm = () => {
    setForm({ proveedor_id: '', monto: '' })
  }

  const handleAddOferta = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.proveedor_id) {
      setError('Proveedor es obligatorio.')
      return
    }
    if (!form.monto || parseFloat(form.monto) <= 0) {
      setError('Monto debe ser mayor a 0.')
      return
    }

    setSaving(true)
    try {
      const { error: err } = await supabase
        .schema('procurement')
        .from('ofertas')
        .insert({
          licitacion_id: id,
          proveedor_id: form.proveedor_id,
          monto: parseFloat(form.monto),
          estado: 'presentada',
        })

      if (err) throw err
      resetForm()
      setShowForm(false)
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteOferta = async (ofertaId: string) => {
    if (!confirm('¿Está seguro de eliminar esta oferta?')) return

    setSaving(true)
    try {
      const { error: err } = await supabase
        .schema('procurement')
        .from('ofertas')
        .delete()
        .eq('id', ofertaId)

      if (err) throw err
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleChangeEstadoOferta = async (ofertaId: string, nuevoEstado: string) => {
    setSaving(true)
    try {
      const { error: err } = await supabase
        .schema('procurement')
        .from('ofertas')
        .update({ estado: nuevoEstado })
        .eq('id', ofertaId)

      if (err) throw err
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-institucional-primary border-t-transparent" />
      </div>
    )
  }

  if (!licitacion) {
    return (
      <div className="space-y-4">
        <Link to="/licitaciones" className="inline-flex items-center gap-2 text-sm text-institucional-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Volver a licitaciones
        </Link>
        <p className="text-gray-500">Licitación no encontrada.</p>
      </div>
    )
  }

  const estadoBadge: Record<string, string> = {
    presentada: 'pendiente',
    abierta: 'activo',
    descartada: 'neutro',
    adjudicada: 'activo',
  }

  const ofertasAbiertasOAdjudicadas = ['abierta', 'adjudicada'].includes(licitacion.estado)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link to="/licitaciones" className="inline-flex items-center gap-2 text-sm text-institucional-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Licitaciones
        </Link>
      </div>

      <Card
        title={`Ofertas - ${(licitacion.expedientes as any)?.codigo_expediente}`}
        subtitle={(licitacion.expedientes as any)?.objeto_contrato}
      >
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Estado</p>
            <Badge estado={licitacion.estado === 'cerrada' ? 'cerrado' : 'activo'}>
              {licitacion.estado}
            </Badge>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Fecha de cierre</p>
            <p className="mt-1">{new Date(licitacion.fecha_cierre).toLocaleDateString('es-GQ')}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Presupuesto</p>
            <p className="mt-1 text-lg font-semibold">
              {((licitacion.expedientes as any)?.presupuesto || 0).toLocaleString('es-GQ', {
                style: 'currency',
                currency: 'XAF',
              })}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Total ofertas</p>
            <p className="mt-1 text-lg font-semibold">{ofertas.length}</p>
          </div>
        </div>
      </Card>

      {ofertasAbiertasOAdjudicadas && (
        <div className="flex gap-2">
          {!showForm && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowForm(true)}>
              Agregar oferta
            </Button>
          )}
        </div>
      )}

      {showForm && (
        <Card title="Crear nueva oferta" subtitle="Agregue una nueva oferta para esta licitación">
          <form onSubmit={handleAddOferta} className="space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}

            <div>
              <label className="pnccp-label">Proveedor *</label>
              <select
                value={form.proveedor_id}
                onChange={(e) => setForm((f) => ({ ...f, proveedor_id: e.target.value }))}
                className="pnccp-input"
                required
              >
                <option value="">Seleccione proveedor</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.razon_social}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="pnccp-label">Monto ofertado (XAF) *</label>
              <input
                type="number"
                step="0.01"
                value={form.monto}
                onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))}
                className="pnccp-input"
                placeholder="Ej. 50000.00"
                required
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" loading={saving}>
                Crear oferta
              </Button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  resetForm()
                  setError('')
                }}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card title="Ofertas recibidas" subtitle={`Total: ${ofertas.length}`}>
        {ofertas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <FileText className="h-12 w-12 mb-3" />
            <p>Sin ofertas.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {ofertas.map((oferta) => (
              <div key={oferta.id} className="border border-gray-200 rounded-lg">
                <button
                  onClick={() => setExpandedOferta(expandedOferta === oferta.id ? null : oferta.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
                >
                  <div className="flex-1 text-left">
                    <h3 className="font-medium text-gray-900">
                      {(oferta.proveedores as any)?.razon_social}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Monto: {oferta.monto.toLocaleString('es-GQ', { style: 'currency', currency: 'XAF' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge estado={estadoBadge[oferta.estado]}>{oferta.estado}</Badge>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteOferta(oferta.id)
                        }}
                        className="text-red-600 hover:text-red-800"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </button>

                {expandedOferta === oferta.id && (
                  <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
                    <div className="grid gap-4 sm:grid-cols-2 mb-4">
                      <div>
                        <p className="text-xs font-medium uppercase text-gray-500">Fecha de envío</p>
                        <p className="mt-1">{new Date(oferta.fecha_envio).toLocaleDateString('es-GQ')}</p>
                      </div>
                    </div>

                    {oferta.evaluaciones && (
                      <div className="border-t border-gray-200 pt-4">
                        <h4 className="font-medium text-gray-900 mb-3">Evaluación</h4>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div className="bg-white p-3 rounded">
                            <p className="text-xs font-medium uppercase text-gray-500">Puntaje técnico</p>
                            <p className="mt-1 text-lg font-semibold">
                              {(oferta.evaluaciones as any).puntuacion_tecnica ?? '—'}
                            </p>
                          </div>
                          <div className="bg-white p-3 rounded">
                            <p className="text-xs font-medium uppercase text-gray-500">Puntaje económico</p>
                            <p className="mt-1 text-lg font-semibold">
                              {(oferta.evaluaciones as any).puntuacion_economica ?? '—'}
                            </p>
                          </div>
                          <div className="bg-white p-3 rounded">
                            <p className="text-xs font-medium uppercase text-gray-500">Puntaje total</p>
                            <p className="mt-1 text-lg font-semibold">
                              {(oferta.evaluaciones as any).puntuacion_total ?? '—'}
                            </p>
                          </div>
                        </div>
                        {(oferta.evaluaciones as any).observaciones && (
                          <div className="mt-3 bg-white p-3 rounded">
                            <p className="text-xs font-medium uppercase text-gray-500">Observaciones</p>
                            <p className="mt-1 text-sm">{(oferta.evaluaciones as any).observaciones}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {ofertasAbiertasOAdjudicadas && !oferta.evaluaciones && (
                      <div className="border-t border-gray-200 pt-4">
                        <p className="text-sm text-gray-600">Sin evaluación</p>
                      </div>
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
