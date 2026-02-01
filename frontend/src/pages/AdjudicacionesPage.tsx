import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { Gavel, CheckCircle } from 'lucide-react'

interface Licitacion {
  id: string
  expediente_id: string
  estado: string
  fecha_cierre: string
  expedientes?: {
    codigo_expediente: string
    objeto_contrato: string
    presupuesto: number
  }
}

interface Oferta {
  id: string
  proveedor_id: string
  monto: number
  estado: string
  proveedores?: {
    id: string
    razon_social: string
  }
  evaluaciones?: {
    puntuacion_tecnica: number
    puntuacion_economica: number
    puntuacion_total: number
  }
}

interface LicitacionConOfertas extends Licitacion {
  ofertas?: Oferta[]
}

interface FormContrato {
  oferta_id: string
  responsable_id: string
  fecha_inicio: string
  fecha_fin: string
}

export function AdjudicacionesPage() {
  const { isAdminInstitucional, isAdminNacional, profile } = useAuth()
  const [licitaciones, setLicitaciones] = useState<LicitacionConOfertas[]>([])
  const [perfiles, setPerfiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [expandedLicitacion, setExpandedLicitacion] = useState<string | null>(null)
  const [adjudicandoLicitacion, setAdjudicandoLicitacion] = useState<string | null>(null)
  const [form, setForm] = useState<FormContrato>({
    oferta_id: '',
    responsable_id: profile?.id || '',
    fecha_inicio: '',
    fecha_fin: '',
  })

  const canAdjudicar = isAdminInstitucional || isAdminNacional

  const loadData = async () => {
    setLoading(true)
    try {
      // Load licitaciones in cerrada state
      const { data: licData, error: licErr } = await supabase
        .schema('procurement')
        .from('licitaciones')
        .select(`
          id, expediente_id, estado, fecha_cierre,
          expedientes(codigo_expediente, objeto_contrato, presupuesto)
        `)
        .eq('estado', 'cerrada')
        .order('fecha_cierre', { ascending: false })

      if (licErr) throw licErr

      // Load ofertas for each licitacion
      if (licData && licData.length > 0) {
        const { data: ofertasData, error: ofertasErr } = await supabase
          .schema('procurement')
          .from('ofertas')
          .select(`
            id, licitacion_id, proveedor_id, monto, estado,
            proveedores(id, razon_social),
            evaluaciones(puntuacion_tecnica, puntuacion_economica, puntuacion_total)
          `)
          .in('licitacion_id', licData.map((l) => l.id))

        if (ofertasErr) throw ofertasErr

        const ofertasMap = new Map<string, Oferta[]>()
        ofertasData?.forEach((oferta) => {
          if (!ofertasMap.has(oferta.licitacion_id)) {
            ofertasMap.set(oferta.licitacion_id, [])
          }
          ofertasMap.get(oferta.licitacion_id)!.push(oferta)
        })

        const licWithOfertas = licData.map((lic) => ({
          ...lic,
          ofertas: ofertasMap.get(lic.id) || [],
        }))

        setLicitaciones(licWithOfertas)
      } else {
        setLicitaciones([])
      }

      // Load perfiles (for responsable dropdown)
      const { data: perfData, error: perfErr } = await supabase
        .schema('core')
        .from('profiles')
        .select('id, nombre_completo')
        .eq('estado', 'activo')
        .order('nombre_completo')

      if (perfErr) throw perfErr
      setPerfiles(perfData || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOpenAdjudicacion = (licitacion: LicitacionConOfertas) => {
    setAdjudicandoLicitacion(licitacion.id)
    setForm({
      oferta_id: '',
      responsable_id: profile?.id || '',
      fecha_inicio: '',
      fecha_fin: '',
    })
  }

  const handleAdjudicar = async (e: React.FormEvent, licitacion: LicitacionConOfertas) => {
    e.preventDefault()
    setError('')

    if (!form.oferta_id) {
      setError('Debe seleccionar una oferta.')
      return
    }
    if (!form.responsable_id) {
      setError('Debe asignar un responsable.')
      return
    }
    if (!form.fecha_inicio || !form.fecha_fin) {
      setError('Las fechas son obligatorias.')
      return
    }

    const fechaInicio = new Date(form.fecha_inicio)
    const fechaFin = new Date(form.fecha_fin)
    if (fechaFin <= fechaInicio) {
      setError('Fecha de fin debe ser posterior a fecha de inicio.')
      return
    }

    setSaving(true)
    try {
      // Get oferta details
      const oferta = licitacion.ofertas?.find((o) => o.id === form.oferta_id)
      if (!oferta) throw new Error('Oferta no encontrada')

      // Update oferta state to adjudicada
      const { error: updateOfertaErr } = await supabase
        .schema('procurement')
        .from('ofertas')
        .update({ estado: 'adjudicada' })
        .eq('id', form.oferta_id)

      if (updateOfertaErr) throw updateOfertaErr

      // Update licitacion state to adjudicada
      const { error: updateLicErr } = await supabase
        .schema('procurement')
        .from('licitaciones')
        .update({ estado: 'adjudicada' })
        .eq('id', licitacion.id)

      if (updateLicErr) throw updateLicErr

      // Create contrato
      const { error: createContratErr } = await supabase
        .schema('core')
        .from('contratos')
        .insert({
          expediente_id: licitacion.expediente_id,
          proveedor_id: oferta.proveedor_id,
          monto_adjudicado: oferta.monto,
          fecha_inicio: form.fecha_inicio,
          fecha_fin: form.fecha_fin,
          estado: 'vigente',
          responsable_id: form.responsable_id,
        })

      if (createContratErr) throw createContratErr

      setAdjudicandoLicitacion(null)
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-institucional-dark">Adjudicaciones</h2>

      <Card title="Licitaciones cerradas" subtitle="Seleccione oferta ganadora y genere contrato">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-institucional-primary border-t-transparent" />
          </div>
        ) : licitaciones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Gavel className="h-12 w-12 mb-3" />
            <p>Sin licitaciones cerradas.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {licitaciones.map((lic) => (
              <div key={lic.id} className="border border-gray-200 rounded-lg">
                <button
                  onClick={() =>
                    setExpandedLicitacion(expandedLicitacion === lic.id ? null : lic.id)
                  }
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
                >
                  <div className="flex-1 text-left">
                    <h3 className="font-medium text-gray-900">
                      {(lic.expedientes as any)?.codigo_expediente}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {(lic.expedientes as any)?.objeto_contrato}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge estado="cerrado">{lic.estado}</Badge>
                    <span className="text-sm text-gray-600">
                      {lic.ofertas?.length || 0} ofertas
                    </span>
                  </div>
                </button>

                {expandedLicitacion === lic.id && (
                  <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
                    <div className="mb-4">
                      <h4 className="font-medium text-gray-900 mb-3">Ofertas evaluadas</h4>
                      {lic.ofertas && lic.ofertas.length > 0 ? (
                        <div className="space-y-2">
                          {lic.ofertas
                            .filter((o) => o.estado === 'abierta')
                            .map((oferta) => (
                              <div
                                key={oferta.id}
                                className="bg-white p-3 rounded border border-gray-200"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <p className="font-medium text-gray-900">
                                    {(oferta.proveedores as any)?.razon_social}
                                  </p>
                                  <p className="text-sm font-semibold">
                                    {oferta.monto.toLocaleString('es-GQ', {
                                      style: 'currency',
                                      currency: 'XAF',
                                    })}
                                  </p>
                                </div>
                                {(oferta.evaluaciones as any) && (
                                  <div className="grid gap-2 sm:grid-cols-3 text-xs">
                                    <div>
                                      <p className="text-gray-500">Técnico</p>
                                      <p className="font-semibold">
                                        {(oferta.evaluaciones as any).puntuacion_tecnica}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500">Económico</p>
                                      <p className="font-semibold">
                                        {(oferta.evaluaciones as any).puntuacion_economica}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500">Total</p>
                                      <p className="font-semibold">
                                        {(oferta.evaluaciones as any).puntuacion_total}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">Sin ofertas evaluadas.</p>
                      )}
                    </div>

                    {canAdjudicar && !adjudicandoLicitacion && (
                      <Button
                        icon={<CheckCircle className="h-4 w-4" />}
                        onClick={() => handleOpenAdjudicacion(lic)}
                      >
                        Adjudicar
                      </Button>
                    )}

                    {adjudicandoLicitacion === lic.id && (
                      <form onSubmit={(e) => handleAdjudicar(e, lic)} className="space-y-4">
                        {error && <p className="text-sm text-red-600">{error}</p>}

                        <div>
                          <label className="pnccp-label">Oferta ganadora *</label>
                          <select
                            value={form.oferta_id}
                            onChange={(e) => setForm((f) => ({ ...f, oferta_id: e.target.value }))}
                            className="pnccp-input"
                            required
                          >
                            <option value="">Seleccione oferta</option>
                            {lic.ofertas
                              ?.filter((o) => o.estado === 'abierta')
                              .map((oferta) => (
                                <option key={oferta.id} value={oferta.id}>
                                  {(oferta.proveedores as any)?.razon_social} -{' '}
                                  {oferta.monto.toLocaleString('es-GQ', {
                                    style: 'currency',
                                    currency: 'XAF',
                                  })}
                                </option>
                              ))}
                          </select>
                        </div>

                        <div>
                          <label className="pnccp-label">Responsable del contrato *</label>
                          <select
                            value={form.responsable_id}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, responsable_id: e.target.value }))
                            }
                            className="pnccp-input"
                            required
                          >
                            <option value="">Seleccione responsable</option>
                            {perfiles.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nombre_completo}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="pnccp-label">Fecha de inicio *</label>
                            <input
                              type="date"
                              value={form.fecha_inicio}
                              onChange={(e) =>
                                setForm((f) => ({ ...f, fecha_inicio: e.target.value }))
                              }
                              className="pnccp-input"
                              required
                            />
                          </div>

                          <div>
                            <label className="pnccp-label">Fecha de fin *</label>
                            <input
                              type="date"
                              value={form.fecha_fin}
                              onChange={(e) =>
                                setForm((f) => ({ ...f, fecha_fin: e.target.value }))
                              }
                              className="pnccp-input"
                              required
                            />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button type="submit" loading={saving}>
                            Generar contrato y adjudicar
                          </Button>
                          <button
                            type="button"
                            onClick={() => setAdjudicandoLicitacion(null)}
                            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
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
