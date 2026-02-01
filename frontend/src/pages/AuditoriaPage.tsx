import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { Shield, Download, ChevronDown } from 'lucide-react'

const OPERACIONES_FILTRO = [
  { value: '', label: 'Todas las operaciones' },
  { value: 'INSERT', label: 'INSERT' },
  { value: 'UPDATE', label: 'UPDATE' },
  { value: 'DELETE', label: 'DELETE' },
]

interface LogEntry {
  id: string
  tabla_afectada: string
  operacion: 'INSERT' | 'UPDATE' | 'DELETE'
  registro_id: string
  usuario_id: string
  institucion_id?: string
  payload_anterior?: any
  payload_nuevo?: any
  created_at: string
  usuarios?: { nombre_completo: string; email: string }
  instituciones?: { nombre_oficial: string }
}

export function AuditoriaPage() {
  const { isAuditor, isAdminNacional } = useAuth()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroOperacion, setFiltroOperacion] = useState('')
  const [filtroTabla, setFiltroTabla] = useState('')
  const [filtroFechaInicio, setFiltroFechaInicio] = useState('')
  const [filtroFechaFin, setFiltroFechaFin] = useState('')
  const [expandedLog, setExpandedLog] = useState<string | null>(null)

  const loadLogs = async () => {
    setLoading(true)
    try {
      let q = supabase
        .schema('audit')
        .from('logs')
        .select(`
          id, tabla_afectada, operacion, registro_id, usuario_id, institucion_id, 
          payload_anterior, payload_nuevo, created_at,
          usuarios:core.profiles(nombre_completo, email_institucional),
          instituciones:core.instituciones(nombre_oficial)
        `)
        .order('created_at', { ascending: false })
        .limit(500)

      if (filtroOperacion) q = q.eq('operacion', filtroOperacion)
      if (filtroTabla.trim()) q = q.ilike('tabla_afectada', `%${filtroTabla.trim()}%`)
      if (filtroFechaInicio) q = q.gte('created_at', new Date(filtroFechaInicio).toISOString())
      if (filtroFechaFin) q = q.lte('created_at', new Date(filtroFechaFin).toISOString())

      const { data, error } = await q
      if (error) throw error
      setLogs(data || [])
    } catch (err: any) {
      console.error(err)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuditor || isAdminNacional) {
      loadLogs()
    }
  }, [isAuditor, isAdminNacional, filtroOperacion, filtroTabla, filtroFechaInicio, filtroFechaFin])

  const handleExportCSV = () => {
    const headers = ['ID', 'Tabla', 'Operación', 'Registro ID', 'Usuario', 'Institución', 'Fecha']
    const rows = logs.map((log) => [
      log.id,
      log.tabla_afectada,
      log.operacion,
      log.registro_id,
      (log.usuarios as any)?.nombre_completo || '—',
      (log.instituciones as any)?.nombre_oficial || '—',
      new Date(log.created_at).toLocaleString('es-GQ'),
    ])

    let csv = headers.join(',') + '\n'
    rows.forEach((row) => {
      csv += row.map((cell) => `"${cell}"`).join(',') + '\n'
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `auditoria-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const handleExportJSON = () => {
    const json = JSON.stringify(logs, null, 2)
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `auditoria-${new Date().toISOString().split('T')[0]}.json`
    link.click()
  }

  if (!isAuditor && !isAdminNacional) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-institucional-dark">Auditoría</h2>
        <p className="text-gray-500">Solo Auditores y Admin Nacional pueden consultar los logs.</p>
      </div>
    )
  }

  const operacionBadge: Record<string, string> = {
    INSERT: 'activo',
    UPDATE: 'pendiente',
    DELETE: 'alerta',
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-institucional-dark">Auditoría y trazabilidad</h2>

      <Card title="Logs del sistema" subtitle="Registro inmutable de operaciones - {logs.length} registros">
        <div className="mb-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={filtroOperacion}
              onChange={(e) => setFiltroOperacion(e.target.value)}
              className="pnccp-input max-w-[200px]"
            >
              {OPERACIONES_FILTRO.map((o) => (
                <option key={o.value || 'todas'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={filtroTabla}
              onChange={(e) => setFiltroTabla(e.target.value)}
              placeholder="Filtrar por tabla (ej. expedientes, licitaciones)"
              className="pnccp-input max-w-[300px]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={filtroFechaInicio}
              onChange={(e) => setFiltroFechaInicio(e.target.value)}
              className="pnccp-input max-w-[150px]"
              title="Fecha inicio"
            />
            <span className="text-gray-500">→</span>
            <input
              type="date"
              value={filtroFechaFin}
              onChange={(e) => setFiltroFechaFin(e.target.value)}
              className="pnccp-input max-w-[150px]"
              title="Fecha fin"
            />
          </div>

          <div className="flex gap-2">
            <Button icon={<Download className="h-4 w-4" />} onClick={handleExportCSV} size="sm">
              Exportar CSV
            </Button>
            <Button icon={<Download className="h-4 w-4" />} onClick={handleExportJSON} size="sm">
              Exportar JSON
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-institucional-primary border-t-transparent" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Shield className="h-12 w-12 mb-3" />
            <p>No hay registros de auditoría con los filtros aplicados.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="border border-gray-200 rounded hover:bg-gray-50 transition"
              >
                <button
                  onClick={() =>
                    setExpandedLog(expandedLog === log.id ? null : log.id)
                  }
                  className="w-full px-4 py-3 flex items-center justify-between text-left"
                >
                  <div className="flex-1 grid gap-2 grid-cols-3 sm:grid-cols-5">
                    <div>
                      <Badge estado={operacionBadge[log.operacion]}>
                        {log.operacion}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {log.tabla_afectada}
                      </p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-sm text-gray-600">
                        {(log.usuarios as any)?.nombre_completo || '—'}
                      </p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-xs text-gray-500">
                        {(log.instituciones as any)?.nombre_oficial || '—'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">
                        {new Date(log.created_at).toLocaleString('es-GQ')}
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-gray-400 transition ${
                      expandedLog === log.id ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {expandedLog === log.id && (
                  <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 space-y-3 text-sm">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="font-medium text-gray-900">Usuario</p>
                        <p className="text-gray-600">
                          {(log.usuarios as any)?.nombre_completo}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(log.usuarios as any)?.email_institucional}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Institución</p>
                        <p className="text-gray-600">
                          {(log.instituciones as any)?.nombre_oficial || '—'}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="font-medium text-gray-900 mb-1">Registro ID</p>
                      <p className="font-mono text-xs bg-white p-2 rounded border border-gray-200 break-all">
                        {log.registro_id}
                      </p>
                    </div>

                    {(log.payload_anterior || log.payload_nuevo) && (
                      <div>
                        <p className="font-medium text-gray-900 mb-2">Cambios</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {log.payload_anterior && (
                            <div className="bg-red-50 border border-red-200 rounded p-2">
                              <p className="text-xs font-medium text-red-900 mb-1">
                                Anterior
                              </p>
                              <pre className="text-xs overflow-auto max-h-[150px] text-red-800">
                                {JSON.stringify(log.payload_anterior, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.payload_nuevo && (
                            <div className="bg-green-50 border border-green-200 rounded p-2">
                              <p className="text-xs font-medium text-green-900 mb-1">
                                Nuevo
                              </p>
                              <pre className="text-xs overflow-auto max-h-[150px] text-green-800">
                                {JSON.stringify(log.payload_nuevo, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
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
