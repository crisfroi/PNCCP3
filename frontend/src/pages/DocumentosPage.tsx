import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ChevronDown, ChevronUp, Plus, Edit2, Trash2, Eye } from 'lucide-react'

interface DocumentTemplate {
  id: string
  nombre_documento: string
  tipo: string
  categoria: string
  version: number
  estado: string
  ambito: string
  formato: string
  descripcion_usos?: string
  created_at: string
}

interface FormData {
  nombre_documento: string
  tipo: string
  categoria: string
  formato: string
  descripcion_usos: string
}

export default function DocumentosPage() {
  const { user, profile } = useAuth()
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState<FormData>({
    nombre_documento: '',
    tipo: '',
    categoria: '',
    formato: 'pdf',
    descripcion_usos: '',
  })

  // Verificar permisos de admin
  const isAdmin = profile?.rol?.nombre_rol === 'Admin Nacional' || profile?.rol?.nombre_rol === 'Admin Institucional'

  useEffect(() => {
    if (user) {
      loadTemplates()
    }
  }, [user])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      let query = supabase
        .schema('documents')
        .from('document_templates')
        .select('*')
        .order('created_at', { ascending: false })

      // Si es Admin Institucional, filtrar por su institución
      if (profile?.rol?.nombre_rol === 'Admin Institucional') {
        query = query.or(`ambito.eq.nacional,and(ambito.eq.institucional,institucion_id.eq.${profile.institucion_id})`)
      }

      const { data, error: fetchError } = await query

      if (fetchError) {
        setError(`Error al cargar plantillas: ${fetchError.message}`)
        return
      }

      setTemplates(data || [])
    } catch (err) {
      setError('Error inesperado al cargar plantillas')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!formData.nombre_documento.trim()) {
      setError('El nombre del documento es requerido')
      return
    }

    try {
      if (editingId) {
        // Actualizar plantilla existente
        const { error: updateError } = await supabase
          .schema('documents')
          .from('document_templates')
          .update({
            nombre_documento: formData.nombre_documento,
            tipo: formData.tipo,
            categoria: formData.categoria,
            formato: formData.formato,
            descripcion_usos: formData.descripcion_usos,
          })
          .eq('id', editingId)

        if (updateError) {
          setError(`Error al actualizar plantilla: ${updateError.message}`)
          return
        }

        setSuccess('Plantilla actualizada correctamente')
        setEditingId(null)
      } else {
        // Crear nueva plantilla
        const { error: insertError } = await supabase
          .schema('documents')
          .from('document_templates')
          .insert({
            nombre_documento: formData.nombre_documento,
            tipo: formData.tipo,
            categoria: formData.categoria,
            formato: formData.formato,
            descripcion_usos: formData.descripcion_usos,
            estado: 'borrador',
            ambito: 'nacional',
            institucion_id: profile?.rol?.nombre_rol === 'Admin Institucional' ? profile.institucion_id : null,
            estructura_json: {},
            version: 1,
          })

        if (insertError) {
          setError(`Error al crear plantilla: ${insertError.message}`)
          return
        }

        setSuccess('Plantilla creada correctamente')
      }

      setFormData({
        nombre_documento: '',
        tipo: '',
        categoria: '',
        formato: 'pdf',
        descripcion_usos: '',
      })
      setShowForm(false)
      loadTemplates()
    } catch (err) {
      setError('Error inesperado al guardar plantilla')
    }
  }

  const handleEdit = (template: DocumentTemplate) => {
    setFormData({
      nombre_documento: template.nombre_documento,
      tipo: template.tipo,
      categoria: template.categoria,
      formato: template.formato,
      descripcion_usos: template.descripcion_usos || '',
    })
    setEditingId(template.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta plantilla?')) {
      return
    }

    try {
      const { error: deleteError } = await supabase
        .schema('documents')
        .from('document_templates')
        .delete()
        .eq('id', id)

      if (deleteError) {
        setError(`Error al eliminar plantilla: ${deleteError.message}`)
        return
      }

      setSuccess('Plantilla eliminada correctamente')
      loadTemplates()
    } catch (err) {
      setError('Error inesperado al eliminar plantilla')
    }
  }

  const handleActivate = async (id: string) => {
    try {
      // Obtener información de la plantilla a activar
      const { data: template, error: fetchError } = await supabase
        .schema('documents')
        .from('document_templates')
        .select('categoria, ambito, institucion_id')
        .eq('id', id)
        .single()

      if (fetchError) {
        setError('Error al cargar información de plantilla')
        return
      }

      // Obsoletizar plantillas del mismo ámbito/categoría
      if (template.ambito === 'nacional') {
        await supabase
          .schema('documents')
          .from('document_templates')
          .update({ estado: 'obsoleto' })
          .eq('categoria', template.categoria)
          .eq('ambito', 'nacional')
          .neq('id', id)
          .eq('estado', 'activo')
      } else {
        await supabase
          .schema('documents')
          .from('document_templates')
          .update({ estado: 'obsoleto' })
          .eq('categoria', template.categoria)
          .eq('ambito', 'institucional')
          .eq('institucion_id', template.institucion_id)
          .neq('id', id)
          .eq('estado', 'activo')
      }

      // Activar plantilla seleccionada
      const { error: activateError } = await supabase
        .schema('documents')
        .from('document_templates')
        .update({ estado: 'activo', activa_desde: new Date().toISOString() })
        .eq('id', id)

      if (activateError) {
        setError('Error al activar plantilla')
        return
      }

      setSuccess('Plantilla activada correctamente')
      loadTemplates()
    } catch (err) {
      setError('Error inesperado al activar plantilla')
    }
  }

  const filteredTemplates = templates.filter(t => {
    const matchSearch = t.nombre_documento.toLowerCase().includes(searchTerm.toLowerCase())
    const matchCategory = !categoryFilter || t.categoria === categoryFilter
    const matchState = !stateFilter || t.estado === stateFilter
    return matchSearch && matchCategory && matchState
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
      'activo': 'bg-green-100 text-green-800',
      'borrador': 'bg-yellow-100 text-yellow-800',
      'obsoleto': 'bg-gray-100 text-gray-800',
    }
    return colors[state] || 'bg-gray-100 text-gray-800'
  }

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">No tienes permisos para acceder a esta sección</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Plantillas de Documentos</h1>
        {!showForm && (
          <Button onClick={() => {
            setEditingId(null)
            setFormData({ nombre_documento: '', tipo: '', categoria: '', formato: 'pdf', descripcion_usos: '' })
            setShowForm(true)
          }} className="flex items-center gap-2">
            <Plus size={18} /> Nueva Plantilla
          </Button>
        )}
      </div>

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

      {/* Formulario */}
      {showForm && (
        <Card className="mb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nombre del Documento *</label>
              <input
                type="text"
                name="nombre_documento"
                value={formData.nombre_documento}
                onChange={handleInputChange}
                placeholder="Ej: Pliego de Condiciones General"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
                <select
                  name="tipo"
                  value={formData.tipo}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar tipo</option>
                  <option value="pliego">Pliego de Condiciones</option>
                  <option value="acta">Acta de Evaluación</option>
                  <option value="resolucion">Resolución</option>
                  <option value="contrato">Contrato</option>
                  <option value="informe">Informe</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Categoría</label>
                <select
                  name="categoria"
                  value={formData.categoria}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar categoría</option>
                  <option value="pliego_tipo">Pliego de Condiciones</option>
                  <option value="acta_evaluacion">Acta de Evaluación</option>
                  <option value="resolucion">Resolución</option>
                  <option value="contrato">Contrato</option>
                  <option value="informe">Informe</option>
                  <option value="certificado">Certificado</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Formato</label>
                <select
                  name="formato"
                  value={formData.formato}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pdf">PDF</option>
                  <option value="docx">Word (DOCX)</option>
                  <option value="xlsx">Excel (XLSX)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Estatus</label>
                <input type="text" disabled value="Borrador" className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Descripción de Usos</label>
              <textarea
                name="descripcion_usos"
                value={formData.descripcion_usos}
                onChange={handleInputChange}
                placeholder="Describe para qué se utiliza esta plantilla"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
              />
            </div>

            <div className="flex gap-4">
              <Button type="submit" className="flex-1">
                {editingId ? 'Actualizar' : 'Crear'} Plantilla
              </Button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditingId(null)
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Filtros */}
      <div className="mb-6 flex gap-4 flex-wrap">
        <input
          type="text"
          placeholder="Buscar plantilla..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 min-w-200px px-4 py-2 border border-gray-300 rounded-lg"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg"
        >
          <option value="">Todas las categorías</option>
          <option value="pliego_tipo">Pliego de Condiciones</option>
          <option value="acta_evaluacion">Acta de Evaluación</option>
          <option value="resolucion">Resolución</option>
          <option value="contrato">Contrato</option>
          <option value="informe">Informe</option>
        </select>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg"
        >
          <option value="">Todos los estados</option>
          <option value="borrador">Borrador</option>
          <option value="activo">Activo</option>
          <option value="obsoleto">Obsoleto</option>
        </select>
      </div>

      {/* Listado */}
      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin">⏳</div>
          <p className="text-gray-600">Cargando plantillas...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card className="text-center py-8">
          <p className="text-gray-500">No hay plantillas disponibles</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTemplates.map(template => (
            <Card key={template.id} className="cursor-pointer hover:shadow-md transition">
              <div
                className="flex items-center justify-between p-4"
                onClick={() => setExpandedId(expandedId === template.id ? null : template.id)}
              >
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800">{template.nombre_documento}</h3>
                  <p className="text-sm text-gray-600">
                    {getCategoryLabel(template.categoria)} • v{template.version}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStateColor(template.estado)}`}>
                    {template.estado === 'activo' ? '✓ Activo' : template.estado === 'borrador' ? 'Borrador' : 'Obsoleto'}
                  </span>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {template.formato.toUpperCase()}
                  </span>
                  {expandedId === template.id ? (
                    <ChevronUp size={20} className="text-gray-400" />
                  ) : (
                    <ChevronDown size={20} className="text-gray-400" />
                  )}
                </div>
              </div>

              {expandedId === template.id && (
                <div className="px-4 pb-4 border-t border-gray-200 pt-4 space-y-3">
                  {template.descripcion_usos && (
                    <div>
                      <p className="text-sm text-gray-600"><strong>Descripción:</strong> {template.descripcion_usos}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    {template.estado !== 'activo' && (
                      <Button
                        onClick={() => handleActivate(template.id)}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        Activar
                      </Button>
                    )}
                    <button
                      onClick={() => handleEdit(template)}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                      <Edit2 size={16} /> Editar
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
                    >
                      <Trash2 size={16} /> Eliminar
                    </button>
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
