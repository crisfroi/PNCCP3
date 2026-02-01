import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { Users, Plus, Edit2, FileText, CheckCircle, Trash2 } from 'lucide-react'

const TIPOS = ['empresa', 'autonomo', 'consorcio'] as const
const PAISES = ['Guinea Ecuatorial', 'España', 'Francia', 'Portugal', 'Otros'] as const

interface Proveedor {
  id: string
  razon_social: string
  tipo: string
  nif?: string
  pais: string
  estado: 'activo' | 'suspendido' | 'inhabilitado'
  fecha_registro: string
  user_id?: string
  created_at: string
  updated_at: string
  documentos?: ProveedorDocumento[]
}

interface ProveedorDocumento {
  id: string
  proveedor_id: string
  tipo_documento: string
  url_storage?: string
  fecha_vencimiento?: string
  estado: 'vigente' | 'vencido' | 'rechazado'
  created_at: string
}

export function ProveedoresList() {
  const { rol, isAdminNacional, isAdminInstitucional } = useAuth()
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [expandedProveedor, setExpandedProveedor] = useState<string | null>(null)
  const [form, setForm] = useState({
    razon_social: '',
    tipo: 'empresa' as const,
    nif: '',
    pais: 'Guinea Ecuatorial' as const,
    estado: 'activo' as const,
  })

  const canEdit = isAdminNacional || isAdminInstitucional

  const loadProveedores = async () => {
    setLoading(true)
    try {
      const { data, error: err } = await supabase
        .schema('rnp')
        .from('proveedores')
        .select(`
          id, razon_social, tipo, nif, pais, estado, fecha_registro, user_id, created_at, updated_at
        `)
        .order('razon_social')

      if (err) throw err

      // Load documents for each proveedor
      if (data && data.length > 0) {
        const { data: docsData, error: docsErr } = await supabase
          .schema('rnp')
          .from('proveedor_documentos')
          .select('*')
          .in('proveedor_id', data.map((p) => p.id))

        if (docsErr) throw docsErr

        const docsMap = new Map<string, ProveedorDocumento[]>()
        docsData?.forEach((doc) => {
          if (!docsMap.has(doc.proveedor_id)) {
            docsMap.set(doc.proveedor_id, [])
          }
          docsMap.get(doc.proveedor_id)!.push(doc)
        })

        const proveedoresWithDocs = data.map((p) => ({
          ...p,
          documentos: docsMap.get(p.id) || [],
        }))

        setProveedores(proveedoresWithDocs)
      } else {
        setProveedores([])
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProveedores()
  }, [])

  const resetForm = () => {
    setForm({
      razon_social: '',
      tipo: 'empresa',
      nif: '',
      pais: 'Guinea Ecuatorial',
      estado: 'activo',
    })
    setEditingId(null)
  }

  const handleOpenEdit = (proveedor: Proveedor) => {
    setForm({
      razon_social: proveedor.razon_social,
      tipo: proveedor.tipo as any,
      nif: proveedor.nif || '',
      pais: proveedor.pais as any,
      estado: proveedor.estado,
    })
    setEditingId(proveedor.id)
    setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.razon_social.trim()) {
      setError('Razón social es obligatoria.')
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        const { error: err } = await supabase
          .schema('rnp')
          .from('proveedores')
          .update({
            razon_social: form.razon_social.trim(),
            tipo: form.tipo,
            nif: form.nif.trim() || null,
            pais: form.pais,
            estado: form.estado,
          })
          .eq('id', editingId)

        if (err) throw err
      } else {
        const { error: err } = await supabase
          .schema('rnp')
          .from('proveedores')
          .insert({
            razon_social: form.razon_social.trim(),
            tipo: form.tipo,
            nif: form.nif.trim() || null,
            pais: form.pais,
            estado: 'activo',
          })

        if (err) throw err
      }

      resetForm()
      setShowForm(false)
      await loadProveedores()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleEstado = async (proveedor: Proveedor) => {
    setSaving(true)
    try {
      const estadoMap = {
        activo: 'suspendido',
        suspendido: 'inhabilitado',
        inhabilitado: 'activo',
      }
      const newEstado = estadoMap[proveedor.estado as keyof typeof estadoMap]

      const { error: err } = await supabase
        .schema('rnp')
        .from('proveedores')
        .update({ estado: newEstado })
        .eq('id', proveedor.id)

      if (err) throw err
      await loadProveedores()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteProveedor = async (proveedorId: string) => {
    if (!confirm('¿Está seguro de eliminar este proveedor?')) return

    setSaving(true)
    try {
      const { error: err } = await supabase
        .schema('rnp')
        .from('proveedores')
        .delete()
        .eq('id', proveedorId)

      if (err) throw err
      await loadProveedores()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteDocumento = async (documentoId: string) => {
    if (!confirm('¿Está seguro de eliminar este documento?')) return

    try {
      const { error: err } = await supabase
        .schema('rnp')
        .from('proveedor_documentos')
        .delete()
        .eq('id', documentoId)

      if (err) throw err
      await loadProveedores()
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-institucional-dark">
          Registro Nacional de Proveedores (RNP)
        </h2>
        {canEdit && (
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              if (!showForm) resetForm()
              setShowForm(!showForm)
            }}
          >
            {showForm ? 'Cancelar' : 'Nuevo proveedor'}
          </Button>
        )}
      </div>

      {canEdit && showForm && (
        <Card
          title={editingId ? 'Editar proveedor' : 'Nuevo proveedor'}
          subtitle={editingId ? 'Actualice datos del proveedor' : 'Registre un nuevo proveedor'}
        >
          <form onSubmit={handleSave} className="space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}

            <div>
              <label className="pnccp-label">Razón social *</label>
              <input
                type="text"
                value={form.razon_social}
                onChange={(e) => setForm((f) => ({ ...f, razon_social: e.target.value }))}
                className="pnccp-input"
                placeholder="Ej. Empresa XYZ S.A."
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="pnccp-label">Tipo *</label>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as any }))}
                  className="pnccp-input"
                  required
                >
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="pnccp-label">NIF (opcional)</label>
                <input
                  type="text"
                  value={form.nif}
                  onChange={(e) => setForm((f) => ({ ...f, nif: e.target.value }))}
                  className="pnccp-input"
                  placeholder="Ej. 1234567890"
                />
              </div>

              <div>
                <label className="pnccp-label">País *</label>
                <select
                  value={form.pais}
                  onChange={(e) => setForm((f) => ({ ...f, pais: e.target.value as any }))}
                  className="pnccp-input"
                  required
                >
                  {PAISES.map((p) => (
                    <option key={p} value={p}>
                      {p}
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
                  <option value="inhabilitado">Inhabilitado</option>
                </select>
              </div>
            )}

            <Button type="submit" loading={saving}>
              {editingId ? 'Actualizar proveedor' : 'Crear proveedor'}
            </Button>
          </form>
        </Card>
      )}

      <Card title="Proveedores del Estado" subtitle="Empresas, autónomos y consorcios habilitados">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-institucional-primary border-t-transparent" />
          </div>
        ) : proveedores.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Users className="h-12 w-12 mb-3" />
            <p>No hay proveedores registrados.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {proveedores.map((proveedor) => (
              <div key={proveedor.id} className="border border-gray-200 rounded-lg">
                <button
                  onClick={() =>
                    setExpandedProveedor(expandedProveedor === proveedor.id ? null : proveedor.id)
                  }
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
                >
                  <div className="flex-1 text-left">
                    <h3 className="font-medium text-gray-900">{proveedor.razon_social}</h3>
                    <p className="text-sm text-gray-600">
                      {proveedor.tipo} • {proveedor.pais} {proveedor.nif && `• NIF: ${proveedor.nif}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      estado={
                        proveedor.estado === 'activo'
                          ? 'activo'
                          : proveedor.estado === 'suspendido'
                            ? 'alerta'
                            : 'neutro'
                      }
                    >
                      {proveedor.estado}
                    </Badge>
                    {canEdit && (
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenEdit(proveedor)
                          }}
                          className="text-institucional-primary hover:text-institucional-dark"
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleEstado(proveedor)
                          }}
                          className="text-blue-600 hover:text-blue-800"
                          title="Cambiar estado"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteProveedor(proveedor.id)
                          }}
                          className="text-red-600 hover:text-red-800"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </button>

                {expandedProveedor === proveedor.id && (
                  <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
                    <div className="mb-4">
                      <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Documentos ({proveedor.documentos?.length || 0})
                      </h4>
                      {proveedor.documentos && proveedor.documentos.length > 0 ? (
                        <div className="space-y-2">
                          {proveedor.documentos.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between bg-white p-2 rounded border border-gray-200"
                            >
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">{doc.tipo_documento}</p>
                                <p className="text-xs text-gray-500">
                                  Vencimiento: {doc.fecha_vencimiento ? new Date(doc.fecha_vencimiento).toLocaleDateString('es-GQ') : 'Sin vencimiento'}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  estado={
                                    doc.estado === 'vigente'
                                      ? 'activo'
                                      : doc.estado === 'vencido'
                                        ? 'alerta'
                                        : 'neutro'
                                  }
                                >
                                  {doc.estado}
                                </Badge>
                                {canEdit && (
                                  <button
                                    onClick={() => handleDeleteDocumento(doc.id)}
                                    className="text-red-600 hover:text-red-800"
                                    title="Eliminar"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">Sin documentos.</p>
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
