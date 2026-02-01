import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ChevronDown, ChevronUp, Download, Archive, Eye } from 'lucide-react'

interface DocumentEmission {
  id: string
  template_id: string
  template: {
    nombre_documento: string
    tipo: string
    categoria: string
    version: number
    formato: string
  }
  entidad_origen: string
  entidad_id: string
  version_utilizada: number
  hash_documento: string
  url_storage: string
  usuario_generador: string
  usuario: {
    nombre_completo: string
  }
  estado_emision: string
  fecha_emision: string
  metadata?: Record<string, any>
}

export default function EmisionesDocumentalesPage() {
  const { user, profile } = useAuth()
  const [emissions, setEmissions] = useState<DocumentEmission[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const isAdmin = profile?.rol?.nombre_rol === 'Admin Nacional' || profile?.rol?.nombre_rol === 'Admin Institucional'

  useEffect(() => {
    if (user) {
      loadEmissions()
    }
  }, [user])

  const loadEmissions = async () => {
    try {
      setLoading(true)
      let query = supabase
        .schema('documents')
        .from('document_emissions')
        .select(`
          id,
          template_id,
          entidad_origen,
          entidad_id,
          version_utilizada,
          hash_documento,
          url_storage,
          usuario_generador,
          estado_emision,
          fecha_emision,
          metadata,
          template:template_id (
            nombre_documento,
            tipo,
            categoria,
            version,
            formato
          ),
          usuario:usuario_generador (
            nombre_completo
          )
        `)
        .order('fecha_emision', { ascending: false })

      // Si no es Admin Nacional, filtrar por institución
      if (!isAdmin || profile?.rol?.nombre_rol === 'Admin Institucional') {
        // Solo ver emisiones de su institución
        // Esto se aplicaría via RLS en la BD
      }

      const { data, error: fetchError } = await query

      if (fetchError) {
        setError(`Error al cargar emisiones: ${fetchError.message}`)
        return
      }

      setEmissions(data || [])
    } catch (err) {
      setError('Error inesperado al cargar emisiones')
    } finally {
      setLoading(false)
    }
  }

  const handleArchive = async (id: string) => {
    try {
      const { error: updateError } = await supabase
        .schema('documents')
        .from('document_emissions')
        .update({ estado_emision: 'archivado' })
        .eq('id', id)

      if (updateError) {
        setError(`Error al archivar emisión: ${updateError.message}`)
        return
      }

      setSuccess('Emisión archivada correctamente')
      loadEmissions()
    } catch (err) {
      setError('Error inesperado al archivar emisión')
    }
  }

  const filteredEmissions = emissions.filter(e => {
    const matchSearch = e.template?.nombre_documento?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchType = !typeFilter || e.template?.tipo === typeFilter
    const matchState = !stateFilter || e.estado_emision === stateFilter
    const matchDateFrom = !dateFrom || new Date(e.fecha_emision) >= new Date(dateFrom)
    const matchDateTo = !dateTo || new Date(e.fecha_emision) <= new Date(dateTo)
    return matchSearch && matchType && matchState && matchDateFrom && matchDateTo
  })

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      'pliego_tipo': 'Pliego de Condiciones',
      'acta_evaluacion': 'Acta de Evaluación',
      'resolucion': 'Resolución',
      'contrato': 'Contrato',
      'informe': 'Informe',
      'certificado': 'Certificado',
    }
    return labels[category] || category
  }

  const getStateColor = (state: string) => {
    const colors: Record<string, string> = {
      'generado': 'bg-blue-100 text-blue-800',
      'enviado': 'bg-green-100 text-green-800',
      'archivado': 'bg-gray-100 text-gray-800',
      'revocado': 'bg-red-100 text-red-800',
    }
    return colors[state] || 'bg-gray-100 text-gray-800'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Emisiones Documentales</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-lg">
          {success}
        </div>
      )}

      {/* Filtros */}
      <Card className="mb-6 p-4">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Buscar documento</label>
              <input
                type="text"
                placeholder="Nombre del documento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Todos los tipos</option>
                <option value="pliego">Pliego</option>
                <option value="acta">Acta</option>
                <option value="resolucion">Resolución</option>
                <option value="contrato">Contrato</option>
                <option value="informe">Informe</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Todos los estados</option>
                <option value="generado">Generado</option>
                <option value="enviado">Enviado</option>
                <option value="archivado">Archivado</option>
                <option value="revocado">Revocado</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Desde</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
      </Card>

      {/* Listado */}
      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin">⏳</div>
          <p className="text-gray-600">Cargando emisiones...</p>
        </div>
      ) : filteredEmissions.length === 0 ? (
        <Card className="text-center py-8">
          <p className="text-gray-500">No hay emisiones disponibles</p>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 mb-4">
            Total: <strong>{filteredEmissions.length}</strong> emisión(es)
          </p>
          {filteredEmissions.map(emission => (
            <Card key={emission.id} className="cursor-pointer hover:shadow-md transition">
              <div
                className="flex items-center justify-between p-4"
                onClick={() => setExpandedId(expandedId === emission.id ? null : emission.id)}
              >
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800">{emission.template?.nombre_documento}</h3>
                  <p className="text-sm text-gray-600">
                    {getCategoryLabel(emission.template?.categoria)} • v{emission.template?.version}
                  </p>
                  <p className="text-xs text-gray-500">
                    Generado por: {emission.usuario?.nombre_completo} • {formatDate(emission.fecha_emision)}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStateColor(emission.estado_emision)}`}>
                    {emission.estado_emision.charAt(0).toUpperCase() + emission.estado_emision.slice(1)}
                  </span>
                  <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                    {emission.template?.formato.toUpperCase()}
                  </span>
                  {expandedId === emission.id ? (
                    <ChevronUp size={20} className="text-gray-400" />
                  ) : (
                    <ChevronDown size={20} className="text-gray-400" />
                  )}
                </div>
              </div>

              {expandedId === emission.id && (
                <div className="px-4 pb-4 border-t border-gray-200 pt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600"><strong>Entidad:</strong> {emission.entidad_origen}</p>
                    </div>
                    <div>
                      <p className="text-gray-600"><strong>Hash:</strong> <code className="bg-gray-100 px-2 py-1 rounded text-xs">{emission.hash_documento?.substring(0, 16)}...</code></p>
                    </div>
                  </div>

                  {emission.metadata && Object.keys(emission.metadata).length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Metadata:</p>
                      <div className="bg-gray-50 p-3 rounded text-xs">
                        <pre className="text-gray-700 whitespace-pre-wrap break-words">
                          {JSON.stringify(emission.metadata, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                      title="Descargar documento"
                    >
                      <Download size={16} /> Descargar
                    </button>
                    <button
                      className="flex-1 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center justify-center gap-2"
                      title="Ver documento"
                    >
                      <Eye size={16} /> Ver
                    </button>
                    {emission.estado_emision !== 'archivado' && (
                      <button
                        onClick={() => handleArchive(emission.id)}
                        className="flex-1 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center justify-center gap-2"
                      >
                        <Archive size={16} /> Archivar
                      </button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
