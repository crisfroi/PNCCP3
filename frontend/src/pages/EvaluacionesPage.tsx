import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { ClipboardList, Plus } from 'lucide-react'

interface Oferta {
  id: string
  licitacion_id: string
  proveedor_id: string
  monto: number
  estado: 'presentada' | 'abierta' | 'descartada' | 'adjudicada'
  fecha_envio: string
  proveedores?: {
    razon_social: string
  }
  licitaciones?: {
    estado: string
    fecha_cierre: string
    expedientes?: {
      codigo_expediente: string
      objeto_contrato: string
    }
  }
  evaluaciones?: {
    id: string
    puntuacion_tecnica?: number
    puntuacion_economica?: number
    puntuacion_total?: number
    observaciones?: string
  }
}

interface FormEvaluacion {
  puntuacion_tecnica: string
  puntuacion_economica: string
  observaciones: string
}

export function EvaluacionesPage() {
  const { isTecnico, isAdminNacional, isAdminInstitucional } = useAuth()
  const [ofertas, setOfertas] = useState<Oferta[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [expandedOferta, setExpandedOferta] = useState<string | null>(null)
  const [evaluandoOferta, setEvaluandoOferta] = useState<string | null>(null)
  const [form, setForm] = useState<FormEvaluacion>({
    puntuacion_tecnica: '',
    puntuacion_economica: '',
    observaciones: '',
  })
  const [filtroEstado, setFiltroEstado] = useState('presentada')

  const canEvaluar = isTecnico || isAdminNacional || isAdminInstitucional

  const loadOfertas = async () => {
    setLoading(true)
    try {
      let q = supabase
        .schema('procurement')
        .from('ofertas')
        .select(`
          id, licitacion_id, proveedor_id, monto, estado, fecha_envio,
          proveedores(razon_social),
          licitaciones(estado, fecha_cierre, expedientes(codigo_expediente, objeto_contrato)),
          evaluaciones(id, puntuacion_tecnica, puntuacion_economica, puntuacion_total, observaciones)
        `)

      if (filtroEstado) q = q.eq('estado', filtroEstado)

      q = q.order('fecha_envio', { ascending: false })

      const { data, error: err } = await q

      if (err) throw err
      setOfertas(data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOfertas()
  }, [filtroEstado])

  const handleOpenEvaluacion = (oferta: Oferta) => {
    const eval_ = (oferta.evaluaciones as any) || {}
    setForm({
      puntuacion_tecnica: eval_.puntuacion_tecnica?.toString() || '',
      puntuacion_economica: eval_.puntuacion_economica?.toString() || '',
      observaciones: eval_.observaciones || '',
    })
    setEvaluandoOferta(oferta.id)
  }

  const handleSaveEvaluacion = async (e: React.FormEvent, ofertaId: string) => {
    e.preventDefault()
    setError('')

    const pTecnica = parseFloat(form.puntuacion_tecnica) || 0
    const pEconomica = parseFloat(form.puntuacion_economica) || 0
    const pTotal = pTecnica + pEconomica

    if (pTecnica < 0 || pEconomica < 0 || pTotal === 0) {
      setError('Los puntajes deben ser >= 0 y la suma > 0.')
      return
    }

    setSaving(true)
    try {
      // Check if evaluation exists
      const { data: existingEval, error: existingErr } = await supabase
        .schema('procurement')
        .from('evaluaciones')
        .select('id')
        .eq('oferta_id', ofertaId)
        .single()

      if (existingErr && existingErr.code !== 'PGRST116') {
        throw existingErr
      }

      const oferta = ofertas.find((o) => o.id === ofertaId)!
      const evaluador_id = (await supabase.auth.getSession()).data.session?.user.id

      if (existingEval) {
        // Update existing evaluation
        const { error: err } = await supabase
          .schema('procurement')
          .from('evaluaciones')
          .update({
            puntuacion_tecnica: pTecnica,
            puntuacion_economica: pEconomica,
            puntuacion_total: pTotal,
            observaciones: form.observaciones.trim() || null,
          })
          .eq('id', existingEval.id)

        if (err) throw err
      } else {
        // Create new evaluation
        const { error: err } = await supabase
          .schema('procurement')
          .from('evaluaciones')
          .insert({
            oferta_id: ofertaId,
            puntuacion_tecnica: pTecnica,
            puntuacion_economica: pEconomica,
            puntuacion_total: pTotal,
            observaciones: form.observaciones.trim() || null,
            evaluador_id,
          })

        if (err) throw err
      }

      // Mark offer as abierta (opened)
      const { error: stateErr } = await supabase
        .schema('procurement')
        .from('ofertas')
        .update({ estado: 'abierta' })
        .eq('id', ofertaId)

      if (stateErr) throw stateErr

      setEvaluandoOferta(null)
      await loadOfertas()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const estadoBadge: Record<string, string> = {
    presentada: 'pendiente',
    abierta: 'activo',
    descartada: 'neutro',
    adjudicada: 'activo',
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-institucional-dark">Evaluaciones de ofertas</h2>

      <Card title="Ofertas para evaluar" subtitle="Evaluación técnica y económica">
        <div className="mb-4">
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="pnccp-input max-w-[200px]"
          >
            <option value="presentada">Sin evaluar (presentada)</option>
            <option value="abierta">Evaluadas (abierta)</option>
            <option value="">Todas</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-institucional-primary border-t-transparent" />
          </div>
        ) : ofertas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <ClipboardList className="h-12 w-12 mb-3" />
            <p>Sin ofertas para mostrar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {ofertas.map((oferta) => (
              <div key={oferta.id} className="border border-gray-200 rounded-lg">
                <button
                  onClick={() =>
                    setExpandedOferta(expandedOferta === oferta.id ? null : oferta.id)
                  }
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
                >
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">
                        {(oferta.proveedores as any)?.razon_social}
                      </h3>
                      <span className="text-sm text-gray-600">
                        {(oferta.licitaciones as any)?.expedientes?.codigo_expediente}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Monto: {oferta.monto.toLocaleString('es-GQ', { style: 'currency', currency: 'XAF' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge estado={estadoBadge[oferta.estado]}>{oferta.estado}</Badge>
                  </div>
                </button>

                {expandedOferta === oferta.id && (
                  <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
                    <div className="mb-4">
                      <p className="text-xs font-medium uppercase text-gray-500">Objeto</p>
                      <p className="mt-1 text-sm">
                        {(oferta.licitaciones as any)?.expedientes?.objeto_contrato}
                      </p>
                    </div>

                    {!evaluandoOferta && (
                      <>
                        {(oferta.evaluaciones as any) ? (
                          <div className="grid gap-4 sm:grid-cols-3 mb-4">
                            <div className="bg-white p-3 rounded">
                              <p className="text-xs font-medium uppercase text-gray-500">Puntaje técnico</p>
                              <p className="mt-1 text-lg font-semibold">
                                {(oferta.evaluaciones as any).puntuacion_tecnica}
                              </p>
                            </div>
                            <div className="bg-white p-3 rounded">
                              <p className="text-xs font-medium uppercase text-gray-500">Puntaje económico</p>
                              <p className="mt-1 text-lg font-semibold">
                                {(oferta.evaluaciones as any).puntuacion_economica}
                              </p>
                            </div>
                            <div className="bg-white p-3 rounded">
                              <p className="text-xs font-medium uppercase text-gray-500">Puntaje total</p>
                              <p className="mt-1 text-lg font-semibold">
                                {(oferta.evaluaciones as any).puntuacion_total}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                            <p className="text-sm text-yellow-800">Sin evaluación</p>
                          </div>
                        )}

                        {canEvaluar && (
                          <Button
                            size="sm"
                            onClick={() => handleOpenEvaluacion(oferta)}
                            className="w-full"
                          >
                            {(oferta.evaluaciones as any) ? 'Editar evaluación' : 'Crear evaluación'}
                          </Button>
                        )}
                      </>
                    )}

                    {evaluandoOferta === oferta.id && (
                      <form
                        onSubmit={(e) => handleSaveEvaluacion(e, oferta.id)}
                        className="space-y-4 bg-white p-4 rounded border border-gray-200"
                      >
                        {error && <p className="text-sm text-red-600">{error}</p>}

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="pnccp-label">Puntaje técnico (0-100) *</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={form.puntuacion_tecnica}
                              onChange={(e) =>
                                setForm((f) => ({ ...f, puntuacion_tecnica: e.target.value }))
                              }
                              className="pnccp-input"
                              required
                            />
                          </div>

                          <div>
                            <label className="pnccp-label">Puntaje económico (0-100) *</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={form.puntuacion_economica}
                              onChange={(e) =>
                                setForm((f) => ({ ...f, puntuacion_economica: e.target.value }))
                              }
                              className="pnccp-input"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="pnccp-label">Observaciones (opcional)</label>
                          <textarea
                            value={form.observaciones}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, observaciones: e.target.value }))
                            }
                            className="pnccp-input"
                            placeholder="Ej. Oferta conforme a especificaciones..."
                            rows={3}
                          />
                        </div>

                        <div className="flex gap-2">
                          <Button type="submit" loading={saving}>
                            Guardar evaluación
                          </Button>
                          <button
                            type="button"
                            onClick={() => setEvaluandoOferta(null)}
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
