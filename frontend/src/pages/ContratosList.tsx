import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { FileCheck, Plus, CheckCircle, Loader } from 'lucide-react'

interface Hito {
  id: string
  descripcion: string
  fecha_prevista: string
  fecha_real?: string
  estado: 'pendiente' | 'cumplido' | 'atrasado' | 'cancelado'
}

interface Contrato {
  id: string
  monto_adjudicado: number
  fecha_inicio: string
  fecha_fin: string
  estado: 'vigente' | 'modificado' | 'terminado' | 'rescindido'
  created_at: string
  expedientes?: { codigo_expediente: string }
  proveedores?: { razon_social: string }
  hitos_contrato?: Hito[]
}

export function ContratosList() {
  const { isAdminInstitucional, isAdminNacional } = useAuth()
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedContrato, setExpandedContrato] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [crearHito, setCrearHito] = useState<string | null>(null)
  const [formHito, setFormHito] = useState({ descripcion: '', fecha_prevista: '' })
  const [generandoCertificado, setGenerandoCertificado] = useState<Record<string, boolean>>({})

  const canEdit = isAdminInstitucional || isAdminNacional

  const loadContratos = async () => {
    setLoading(true)
    try {
      const { data, error: err } = await supabase
        .schema('core')
        .from('contratos')
        .select(`
          id, monto_adjudicado, fecha_inicio, fecha_fin, estado, created_at,
          expedientes(codigo_expediente),
          proveedores:rnp.proveedores(razon_social),
          hitos_contrato(id, descripcion, fecha_prevista, fecha_real, estado)
        `)
        .order('created_at', { ascending: false })

      if (err) throw err
      setContratos(data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadContratos()
  }, [])

  const handleAddHito = async (e: React.FormEvent, contratoId: string) => {
    e.preventDefault()
    setError('')
    if (!formHito.descripcion.trim() || !formHito.fecha_prevista) {
      setError('Descripción y fecha son obligatorias.')
      return
    }

    setSaving(true)
    try {
      const { error: err } = await supabase
        .schema('execution')
        .from('hitos_contrato')
        .insert({
          contrato_id: contratoId,
          descripcion: formHito.descripcion.trim(),
          fecha_prevista: formHito.fecha_prevista,
          estado: 'pendiente',
        })

      if (err) throw err
      setFormHito({ descripcion: '', fecha_prevista: '' })
      setCrearHito(null)
      await loadContratos()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleChangeEstadoContrato = async (
    contratoId: string,
    nuevoEstado: 'vigente' | 'modificado' | 'terminado' | 'rescindido'
  ) => {
    setSaving(true)
    try {
      const { error: err } = await supabase
        .schema('core')
        .from('contratos')
        .update({ estado: nuevoEstado })
        .eq('id', contratoId)

      if (err) throw err
      await loadContratos()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCompleteHito = async (hitoId: string) => {
    setSaving(true)
    try {
      const { error: err } = await supabase
        .schema('execution')
        .from('hitos_contrato')
        .update({ estado: 'cumplido', fecha_real: new Date().toISOString().split('T')[0] })
        .eq('id', hitoId)

      if (err) throw err
      await loadContratos()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const estadoBadge: Record<string, string> = {
    vigente: 'activo',
    modificado: 'pendiente',
    terminado: 'cerrado',
    rescindido: 'alerta',
  }

  const hitoBadge: Record<string, string> = {
    pendiente: 'pendiente',
    cumplido: 'activo',
    atrasado: 'alerta',
    cancelado: 'neutro',
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-institucional-dark">Contratos</h2>
      <Card title="Contratos adjudicados" subtitle="Vigentes, modificados y terminados">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-institucional-primary border-t-transparent" />
          </div>
        ) : contratos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <FileCheck className="h-12 w-12 mb-3" />
            <p>No hay contratos.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contratos.map((contrato) => (
              <div key={contrato.id} className="border border-gray-200 rounded-lg">
                <button
                  onClick={() =>
                    setExpandedContrato(expandedContrato === contrato.id ? null : contrato.id)
                  }
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
                >
                  <div className="flex-1 text-left">
                    <h3 className="font-medium text-gray-900">
                      {(contrato.expedientes as any)?.codigo_expediente} -{' '}
                      {(contrato.proveedores as any)?.razon_social}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {contrato.monto_adjudicado.toLocaleString('es-GQ', {
                        style: 'currency',
                        currency: 'XAF',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge estado={estadoBadge[contrato.estado]}>{contrato.estado}</Badge>
                    <span className="text-sm text-gray-600">
                      {(contrato.hitos_contrato as any)?.length || 0} hitos
                    </span>
                  </div>
                </button>

                {expandedContrato === contrato.id && (
                  <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 space-y-4">
                    <div>
                      <p className="text-xs font-medium uppercase text-gray-500">Fechas</p>
                      <p className="mt-1 text-sm">
                        {new Date(contrato.fecha_inicio).toLocaleDateString('es-GQ')} →{' '}
                        {new Date(contrato.fecha_fin).toLocaleDateString('es-GQ')}
                      </p>
                    </div>

                    {canEdit && (
                      <div>
                        <label className="text-xs font-medium uppercase text-gray-500">
                          Cambiar estado
                        </label>
                        <div className="mt-2 flex gap-2 flex-wrap">
                          {['vigente', 'modificado', 'terminado', 'rescindido'].map((estado) => (
                            <button
                              key={estado}
                              onClick={() =>
                                handleChangeEstadoContrato(
                                  contrato.id,
                                  estado as 'vigente' | 'modificado' | 'terminado' | 'rescindido'
                                )
                              }
                              className="text-xs px-2 py-1 rounded bg-white border border-gray-200 hover:bg-gray-100"
                            >
                              {estado}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">Hitos ({(contrato.hitos_contrato as any)?.length || 0})</h4>
                        {canEdit && (
                          <button
                            onClick={() =>
                              setCrearHito(crearHito === contrato.id ? null : contrato.id)
                            }
                            className="text-sm text-institucional-primary hover:text-institucional-dark"
                          >
                            + Agregar
                          </button>
                        )}
                      </div>

                      {crearHito === contrato.id && (
                        <form onSubmit={(e) => handleAddHito(e, contrato.id)} className="mb-3 bg-white p-3 rounded border border-gray-200 space-y-2">
                          <input
                            type="text"
                            value={formHito.descripcion}
                            onChange={(e) =>
                              setFormHito((f) => ({ ...f, descripcion: e.target.value }))
                            }
                            placeholder="Descripción del hito"
                            className="pnccp-input text-sm"
                            required
                          />
                          <input
                            type="date"
                            value={formHito.fecha_prevista}
                            onChange={(e) =>
                              setFormHito((f) => ({ ...f, fecha_prevista: e.target.value }))
                            }
                            className="pnccp-input text-sm"
                            required
                          />
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={saving}
                              className="text-xs px-2 py-1 rounded bg-institucional-primary text-white hover:bg-institucional-dark disabled:opacity-50"
                            >
                              Crear
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCrearHito(null)
                                setFormHito({ descripcion: '', fecha_prevista: '' })
                              }}
                              className="text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300"
                            >
                              Cancelar
                            </button>
                          </div>
                        </form>
                      )}

                      {(contrato.hitos_contrato as any)?.length ? (
                        <div className="space-y-2">
                          {(contrato.hitos_contrato as Hito[]).map((hito) => (
                            <div
                              key={hito.id}
                              className="bg-white p-2 rounded border border-gray-200 flex items-center justify-between"
                            >
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">{hito.descripcion}</p>
                                <p className="text-xs text-gray-600">
                                  Previsto: {new Date(hito.fecha_prevista).toLocaleDateString('es-GQ')}
                                  {hito.fecha_real && ` | Real: ${new Date(hito.fecha_real).toLocaleDateString('es-GQ')}`}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Badge estado={hitoBadge[hito.estado]} className="text-xs">
                                  {hito.estado}
                                </Badge>
                                {canEdit && hito.estado === 'pendiente' && (
                                  <button
                                    onClick={() => handleCompleteHito(hito.id)}
                                    className="text-green-600 hover:text-green-800"
                                    title="Marcar cumplido"
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">Sin hitos.</p>
                      )}
                    </div>
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
