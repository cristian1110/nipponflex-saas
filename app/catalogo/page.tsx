'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

interface Producto {
  id: number
  nombre: string
  descripcion: string
  categoria: string | null
  precio: number
  precio_antes: number | null
  moneda: string
  stock: number | null
  sku: string | null
  imagen_url: string | null
  video_url: string | null
  imagenes_adicionales: string[]
  beneficios: string | null
  sinonimos: string
  palabras_clave: string
  activo: boolean
}

const MONEDAS = ['USD', 'EUR', 'MXN', 'COP', 'ARS', 'PEN', 'CLP']

export default function CatalogoPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<string[]>([])
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<Producto | null>(null)
  const [saving, setSaving] = useState(false)
  const [generandoSinonimos, setGenerandoSinonimos] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    categoria: '',
    precio: '',
    precio_antes: '',
    moneda: 'USD',
    stock: '',
    sku: '',
    imagen_url: '',
    video_url: '',
    beneficios: '',
    palabras_clave: '',
  })

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/login'); return }
      setUser(await res.json())
      await loadProductos()
    } catch { router.push('/login') }
    setLoading(false)
  }

  const loadProductos = async () => {
    try {
      let url = '/api/productos'
      const params = new URLSearchParams()
      if (filtroCategoria) params.append('categoria', filtroCategoria)
      if (busqueda) params.append('q', busqueda)
      if (params.toString()) url += '?' + params.toString()

      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setProductos(data.productos || [])
        setCategorias(data.categorias || [])
      }
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    if (user) loadProductos()
  }, [filtroCategoria, busqueda])

  const resetForm = () => {
    setForm({
      nombre: '', descripcion: '', categoria: '', precio: '', precio_antes: '',
      moneda: 'USD', stock: '', sku: '', imagen_url: '', video_url: '',
      beneficios: '', palabras_clave: '',
    })
    setEditando(null)
  }

  const abrirCrear = () => {
    resetForm()
    setShowModal(true)
    setMessage(null)
  }

  const abrirEditar = (producto: Producto) => {
    setEditando(producto)
    setForm({
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      categoria: producto.categoria || '',
      precio: producto.precio?.toString() || '',
      precio_antes: producto.precio_antes?.toString() || '',
      moneda: producto.moneda || 'USD',
      stock: producto.stock?.toString() || '',
      sku: producto.sku || '',
      imagen_url: producto.imagen_url || '',
      video_url: producto.video_url || '',
      beneficios: producto.beneficios || '',
      palabras_clave: producto.palabras_clave || '',
    })
    setShowModal(true)
    setMessage(null)
  }

  const guardarProducto = async () => {
    if (!form.nombre) {
      setMessage({ type: 'error', text: 'El nombre es requerido' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const body: any = {
        nombre: form.nombre,
        descripcion: form.descripcion || null,
        categoria: form.categoria || null,
        precio: form.precio ? parseFloat(form.precio) : null,
        precio_antes: form.precio_antes ? parseFloat(form.precio_antes) : null,
        moneda: form.moneda,
        stock: form.stock ? parseInt(form.stock) : null,
        sku: form.sku || null,
        imagen_url: form.imagen_url || null,
        video_url: form.video_url || null,
        beneficios: form.beneficios || null,
        palabras_clave: form.palabras_clave || null,
      }

      if (editando) {
        body.id = editando.id
      }

      const res = await fetch('/api/productos', {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: editando ? 'Producto actualizado' : 'Producto creado con sinónimos generados' })
        setShowModal(false)
        resetForm()
        loadProductos()
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al guardar' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Error de conexión' })
    }
    setSaving(false)
  }

  const regenerarSinonimos = async () => {
    if (!editando) return

    setGenerandoSinonimos(true)
    try {
      const res = await fetch('/api/productos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editando.id,
          regenerar_sinonimos: true
        })
      })

      if (res.ok) {
        const data = await res.json()
        setEditando({ ...editando, sinonimos: data.sinonimos })
        setMessage({ type: 'success', text: 'Sinónimos regenerados' })
        loadProductos()
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Error regenerando sinónimos' })
    }
    setGenerandoSinonimos(false)
  }

  const eliminarProducto = async (id: number) => {
    if (!confirm('¿Eliminar este producto?')) return

    try {
      const res = await fetch(`/api/productos?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        loadProductos()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const formatPrecio = (precio: number, moneda: string) => {
    return new Intl.NumberFormat('es', {
      style: 'currency',
      currency: moneda || 'USD'
    }).format(precio)
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-[var(--bg-primary)] items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-6 py-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">📦 Catálogo de Productos</h1>
              <p className="text-sm text-[var(--text-secondary)]">{productos.length} productos • Los sinónimos se generan automáticamente</p>
            </div>
            <button
              onClick={abrirCrear}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              + Nuevo Producto
            </button>
          </div>

          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Buscar productos..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="flex-1 px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
            />
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
            >
              <option value="">Todas las categorías</option>
              {categorias.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {/* Tips */}
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-sm text-blue-400 font-medium mb-2">💡 Cómo funciona el Catálogo:</p>
            <ul className="text-xs text-blue-300 space-y-1 list-disc list-inside">
              <li><strong>Sinónimos automáticos:</strong> Al crear un producto, la IA genera sinónimos (ej: "pulsera" → "manilla, brazalete")</li>
              <li><strong>Imágenes:</strong> Usa links de Google Drive (click derecho → Obtener enlace → Cualquier persona)</li>
              <li><strong>Videos:</strong> También de Google Drive o YouTube</li>
              <li><strong>El agente:</strong> Encontrará productos aunque el cliente use palabras diferentes</li>
            </ul>
          </div>

          {productos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64">
              <div className="text-6xl mb-4">📦</div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Sin productos</h2>
              <p className="text-[var(--text-secondary)] mb-4">Agrega productos para que el agente los muestre</p>
              <button onClick={abrirCrear} className="px-6 py-3 bg-emerald-600 text-white rounded-lg">
                + Agregar Producto
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {productos.map(producto => (
                <div
                  key={producto.id}
                  className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden hover:border-emerald-500 transition-colors"
                >
                  {/* Imagen */}
                  {producto.imagen_url ? (
                    <div className="h-40 bg-[var(--bg-tertiary)] relative">
                      <img
                        src={producto.imagen_url}
                        alt={producto.nombre}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                      {producto.video_url && (
                        <span className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">🎬 Video</span>
                      )}
                    </div>
                  ) : (
                    <div className="h-40 bg-[var(--bg-tertiary)] flex items-center justify-center">
                      <span className="text-4xl">📦</span>
                    </div>
                  )}

                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-[var(--text-primary)]">{producto.nombre}</h3>
                        {producto.categoria && (
                          <span className="text-xs text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">
                            {producto.categoria}
                          </span>
                        )}
                      </div>
                      {producto.precio > 0 && (
                        <div className="text-right">
                          <p className="font-bold text-emerald-400">{formatPrecio(producto.precio, producto.moneda)}</p>
                          {producto.precio_antes && (
                            <p className="text-xs text-[var(--text-tertiary)] line-through">
                              {formatPrecio(producto.precio_antes, producto.moneda)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {producto.descripcion && (
                      <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-2">{producto.descripcion}</p>
                    )}

                    {/* Sinónimos */}
                    {producto.sinonimos && (
                      <div className="mb-3">
                        <p className="text-xs text-[var(--text-tertiary)] mb-1">Sinónimos (auto):</p>
                        <p className="text-xs text-purple-400 line-clamp-1">{producto.sinonimos}</p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => abrirEditar(producto)}
                        className="flex-1 px-3 py-1.5 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded text-sm hover:bg-[var(--bg-primary)]"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => eliminarProducto(producto.id)}
                        className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded text-sm hover:bg-red-500/30"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Crear/Editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-secondary)] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                {editando ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-2xl text-[var(--text-secondary)]">&times;</button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[70vh] space-y-4">
              {message && (
                <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {message.text}
                </div>
              )}

              {/* Nombre */}
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Nombre *</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej: Pulsera Magnética Energética"
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                />
                <p className="text-xs text-[var(--text-tertiary)] mt-1">Los sinónimos se generarán automáticamente</p>
              </div>

              {/* Categoría y SKU */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">Categoría</label>
                  <input
                    type="text"
                    value={form.categoria}
                    onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                    placeholder="Ej: Accesorios"
                    list="categorias-list"
                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                  />
                  <datalist id="categorias-list">
                    {categorias.map(cat => <option key={cat} value={cat} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">SKU</label>
                  <input
                    type="text"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    placeholder="Ej: PUL-001"
                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                  />
                </div>
              </div>

              {/* Precios */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">Precio</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.precio}
                    onChange={(e) => setForm({ ...form, precio: e.target.value })}
                    placeholder="50.00"
                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">Precio anterior</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.precio_antes}
                    onChange={(e) => setForm({ ...form, precio_antes: e.target.value })}
                    placeholder="70.00"
                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">Moneda</label>
                  <select
                    value={form.moneda}
                    onChange={(e) => setForm({ ...form, moneda: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                  >
                    {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Descripción</label>
                <textarea
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  rows={3}
                  placeholder="Describe el producto..."
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                />
              </div>

              {/* Beneficios */}
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Beneficios</label>
                <textarea
                  value={form.beneficios}
                  onChange={(e) => setForm({ ...form, beneficios: e.target.value })}
                  rows={2}
                  placeholder="Ej: Mejora la circulación, alivia dolores..."
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                />
              </div>

              {/* Imagen y Video */}
              <div className="p-4 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)]">
                <h4 className="font-medium text-[var(--text-primary)] mb-3">🖼️ Multimedia (Google Drive)</h4>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-[var(--text-secondary)] mb-1">URL de Imagen</label>
                    <input
                      type="url"
                      value={form.imagen_url}
                      onChange={(e) => setForm({ ...form, imagen_url: e.target.value })}
                      placeholder="https://drive.google.com/uc?id=..."
                      className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-[var(--text-secondary)] mb-1">URL de Video</label>
                    <input
                      type="url"
                      value={form.video_url}
                      onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                      placeholder="https://drive.google.com/uc?id=..."
                      className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] text-sm"
                    />
                  </div>

                  <div className="text-xs text-[var(--text-tertiary)]">
                    <p>📌 <strong>Cómo obtener el link de Google Drive:</strong></p>
                    <ol className="list-decimal list-inside mt-1 space-y-0.5">
                      <li>Sube el archivo a Google Drive</li>
                      <li>Click derecho → "Obtener enlace"</li>
                      <li>Cambia a "Cualquier persona con el enlace"</li>
                      <li>Copia el ID del link y usa: https://drive.google.com/uc?id=TU_ID</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Palabras clave adicionales */}
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Palabras clave adicionales</label>
                <input
                  type="text"
                  value={form.palabras_clave}
                  onChange={(e) => setForm({ ...form, palabras_clave: e.target.value })}
                  placeholder="terapia, salud, bienestar (separadas por coma)"
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                />
              </div>

              {/* Sinónimos (solo editar) */}
              {editando && editando.sinonimos && (
                <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-purple-400">🤖 Sinónimos generados por IA</h4>
                    <button
                      onClick={regenerarSinonimos}
                      disabled={generandoSinonimos}
                      className="px-3 py-1 bg-purple-600 text-white rounded text-xs disabled:opacity-50"
                    >
                      {generandoSinonimos ? 'Regenerando...' : '🔄 Regenerar'}
                    </button>
                  </div>
                  <p className="text-sm text-purple-300">{editando.sinonimos}</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[var(--border-color)] flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={guardarProducto}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50"
              >
                {saving ? 'Guardando...' : editando ? 'Guardar' : 'Crear Producto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
