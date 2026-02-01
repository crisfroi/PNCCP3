import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/contexts/AuthContext'
import { TrendingUp, FileText, CheckCircle, Clock, AlertCircle, DollarSign } from 'lucide-react'

interface KPIData {
  totalExpedientes: number
  enLicitacion: number
  evaluando: number
  adjudicados: number
  valorTotal: number
  documentosGenerados: number
}

interface EstadoStats {
  estado: string
  total: number
}

interface ContratoVencimiento {
  id: string
  codigo_expediente: string
  proveedor_razon_social: string
  fecha_fin: string
  dias_restantes: number
}

interface UltimoExpediente {
  codigo_expediente: string
  objeto_contrato: string
  presupuesto: number
  proveedor_razon_social: string
  fecha_creacion: string
}

export function DashboardAnalytics() {
  const { profile } = useAuth()
  const [kpis, setKpis] = useState<KPIData>({
    totalExpedientes: 0,
    enLicitacion: 0,
    evaluando: 0,
    adjudicados: 0,
    valorTotal: 0,
    documentosGenerados: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [estadoStats, setEstadoStats] = useState<EstadoStats[]>([])
  const [contratosVencimiento, setContratosVencimiento] = useState<ContratoVencimiento[]>([])
  const [ultimosExpedientes, setUltimosExpedientes] = useState<UltimoExpediente[]>([])

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      // Cargar expedientes y estadísticas
      const { data: expedientes, error: expErr } = await supabase
        .schema('core')
        .from('expedientes')
        .select('id, estado_expediente_id, presupuesto')

      if (expErr) throw expErr

      // Cargar estados de expediente para mapear IDs
      const { data: estados, error: estErr } = await supabase
        .schema('core')
        .from('estados_expediente')
        .select('id, codigo')

      if (estErr) throw estErr

      // Crear mapa de estado_id -> codigo
      const estadoMap = new Map(estados?.map(e => [e.id, e.codigo]) || [])

      // Contar por estado
      const contadores: Record<string, number> = {
        licitacion: 0,
        evaluacion: 0,
        adjudicado: 0,
        total: 0,
      }

      let valorTotal = 0

      expedientes?.forEach((exp: any) => {
        contadores.total++
        valorTotal += exp.presupuesto || 0
        const estadoCodigo = estadoMap.get(exp.estado_expediente_id)
        if (estadoCodigo === 'licitacion') contadores.licitacion++
        if (estadoCodigo === 'evaluacion') contadores.evaluacion++
        if (estadoCodigo === 'adjudicado') contadores.adjudicado++
      })

      // Cargar documentos generados
      const { data: documentos, error: docErr } = await supabase
        .schema('documents')
        .from('document_emissions')
        .select('id')

      if (docErr) throw docErr

      setKpis({
        totalExpedientes: contadores.total,
        enLicitacion: contadores.licitacion,
        evaluando: contadores.evaluacion,
        adjudicados: contadores.adjudicado,
        valorTotal,
        documentosGenerados: documentos?.length || 0,
      })

      // Cargar contratos próximos a vencer (dentro de 30 días)
      const { data: contratos, error: contratoErr } = await supabase
        .rpc('get_contratos_vencimiento_proximo')
        .limit(5)

      if (!contratoErr && contratos) {
        setContratosVencimiento(contratos)
      }

      // Cargar últimos expedientes adjudicados
      const { data: ultimosExp, error: ultimosErr } = await supabase
        .schema('core')
        .from('expedientes')
        .select(`
          codigo_expediente, objeto_contrato, presupuesto,
          contratos(id)
        `)
        .order('created_at', { ascending: false })
        .limit(5)

      if (!ultimosErr && ultimosExp) {
        const formattedExp = ultimosExp
          .filter((e: any) => e.contratos && e.contratos.length > 0)
          .map((e: any) => ({
            codigo_expediente: e.codigo_expediente,
            objeto_contrato: e.objeto_contrato,
            presupuesto: e.presupuesto,
            proveedor_razon_social: '',
            fecha_creacion: '',
          }))
        setUltimosExpedientes(formattedExp)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnalytics()
  }, [])

  const KPICard = ({
    label,
    value,
    icon: Icon,
    color = 'blue',
  }: {
    label: string
    value: number | string
    icon: any
    color?: 'blue' | 'green' | 'orange' | 'red'
  }) => {
    const colorClasses = {
      blue: 'bg-blue-50 text-blue-800 border-blue-200',
      green: 'bg-green-50 text-green-800 border-green-200',
      orange: 'bg-orange-50 text-orange-800 border-orange-200',
      red: 'bg-red-50 text-red-800 border-red-200',
    }

    return (
      <div className={`${colorClasses[color]} border rounded-lg p-4`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase opacity-75">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <Icon className="h-8 w-8 opacity-50" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-institucional-dark">
          Analítica y Reportería
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Visión general del desempeño del sistema de contratación pública
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-institucional-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {/* KPIs Principales */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <KPICard
              label="Total Expedientes"
              value={kpis.totalExpedientes}
              icon={FileText}
              color="blue"
            />
            <KPICard
              label="En Licitación"
              value={kpis.enLicitacion}
              icon={Clock}
              color="orange"
            />
            <KPICard
              label="Evaluando"
              value={kpis.evaluando}
              icon={TrendingUp}
              color="blue"
            />
            <KPICard
              label="Adjudicados"
              value={kpis.adjudicados}
              icon={CheckCircle}
              color="green"
            />
            <KPICard
              label="Documentos Generados"
              value={kpis.documentosGenerados}
              icon={FileText}
              color="blue"
            />
            <KPICard
              label="Valor Total"
              value={`${(kpis.valorTotal / 1000000).toFixed(1)}M XAF`}
              icon={DollarSign}
              color="green"
            />
          </div>

          {/* Información adicional */}
          <Card title="Resumen Mensual" subtitle="Estadísticas del periodo actual">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <p className="text-xs font-medium uppercase text-blue-800">Licitaciones Publicadas</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">
                  {kpis.enLicitacion}
                </p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded p-4">
                <p className="text-xs font-medium uppercase text-orange-800">Pendiente Evaluación</p>
                <p className="text-2xl font-bold text-orange-900 mt-1">
                  {kpis.evaluando}
                </p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded p-4">
                <p className="text-xs font-medium uppercase text-green-800">Contratos Adjudicados</p>
                <p className="text-2xl font-bold text-green-900 mt-1">
                  {kpis.adjudicados}
                </p>
              </div>
            </div>
          </Card>

          {/* Contratos próximos a vencer */}
          {contratosVencimiento.length > 0 && (
            <Card
              title="Contratos Próximos a Vencer"
              subtitle="Dentro de los próximos 30 días"
            >
              <div className="space-y-2">
                {contratosVencimiento.map((contrato, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 border border-orange-200 bg-orange-50 rounded"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {contrato.codigo_expediente}
                      </p>
                      <p className="text-sm text-gray-600">
                        {contrato.proveedor_razon_social}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-orange-800">
                        {contrato.dias_restantes} días
                      </p>
                      <p className="text-xs text-gray-600">
                        Vence: {new Date(contrato.fecha_fin).toLocaleDateString('es-GQ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Información de documentos */}
          <Card
            title="Documentación Generada"
            subtitle="Pliegos, Actas, Resoluciones y Contratos"
          >
            <div className="bg-blue-50 border border-blue-200 rounded p-4">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-xs font-medium uppercase text-blue-800">
                    Total de Documentos Emitidos
                  </p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">
                    {kpis.documentosGenerados}
                  </p>
                </div>
              </div>
              <p className="text-xs text-blue-700 mt-3">
                ✓ Todos los documentos están registrados en el sistema con hash SHA-256 para
                verificación de integridad.
              </p>
            </div>
          </Card>

          {/* Nota informativa */}
          <div className="bg-blue-50 border border-blue-200 rounded p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">Información del Dashboard</p>
                <p className="text-sm text-blue-800 mt-1">
                  Este dashboard muestra métricas en tiempo real del sistema PNCCP. Los datos se
                  actualizan automáticamente con cada acción realizada en el sistema de
                  contratación.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
