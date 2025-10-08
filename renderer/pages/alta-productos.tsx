"use client";

import React, { useState, useEffect } from "react";
import apiFetch from '../lib/api';
import Swal from "sweetalert2";
import { PlusCircle, Trash2 } from "lucide-react";

export default function AltaProductosPage() {
  const [form, setForm] = useState<any>({
    nombre: "",
    descripcion: "",
    categoria_id: "",
    unidad_base: "kg",
    stock_actual: "0",
    stock_minimo: "0",
    codigo_barras: "",
    precio_compra: "0.00",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const ITEMS_POR_PAGINA = 20;
  const [tablaLoading, setTablaLoading] = useState(false);
  // Modal de presentaciones (React)
  const [presentacionModalOpen, setPresentacionModalOpen] = useState(false);
  const [presentacionProductoId, setPresentacionProductoId] = useState<number | null>(null);
  const [presentacionProductoInfo, setPresentacionProductoInfo] = useState<any>(null);
  const [presentacionForm, setPresentacionForm] = useState({
    nombre: "",
    unidad: "kg",
    factor_a_base: "",
    precio_unitario: "",
    codigo_barras: "",
    es_default: false,
  });
  const [presentacionLoading, setPresentacionLoading] = useState(false);

  function generarCodigo(nombre) {
    if (!nombre) return "";
    const base = nombre.replace(/\s+/g, ""); // quitamos espacios
    const random = Math.floor(100000000 + Math.random() * 900000000); // 9 dígitos
    return `${base}${random}`;
  }

  function showFieldHelp(field: string) {
    const helps: Record<string, string> = {
      nombre: 'Nombre principal del producto. Debe ser claro y único para identificar el artículo en listas y ventas.',
      descripcion: 'Descripción breve del producto: ingredientes, presentación, o cualquier nota relevante.',
      categoria: 'Categoría a la que pertenece el producto (ej: Bebidas, Granos). Facilita la organización y filtros.',
      unidad_base: 'Unidad base usada para stock y ajustes (kg, bulto, pieza). Las presentaciones se convierten a esta unidad con el factor.',
      stock_actual: 'Cantidad actual en inventario (en unidad base). Se actualizará con ventas y ajustes.',
      stock_minimo: 'Nivel mínimo aconsejado; usado para alertas de reabastecimiento.',
      codigo_barras: 'Código de barras generado por defecto;'
    };
    Swal.fire({ icon: 'info', title: 'Ayuda', text: helps[field] || '' });
  }


  function handleInputtwo(e) {
    const { name, value } = e.target;

    if (name === "nombre") {
      setForm((prev) => ({
        ...prev,
        nombre: value,
        codigo_barras: prev.codigo_barras || generarCodigo(value),
      }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  }




  async function fetchProductos(nombre = "") {
    try {
      setTablaLoading(true);
        // Llamamos al endpoint sin query y filtramos en cliente
        const res = await apiFetch('/api/productRegister/productos-listar');
        setProductos(Array.isArray(res.data) ? res.data : []);
    } catch {
      setProductos([]);
    } finally {
      setTablaLoading(false);
    }
  }

  async function fetchCategorias() {
    try {
      const res = await apiFetch('/api/productRegister/categorias-listar'); // opcional; usa el tuyo si es distinto
      setCategorias(Array.isArray(res.data) ? res.data : []);
    } catch {
      setCategorias([]);
    }
  }

  useEffect(() => {
    fetchProductos();
    fetchCategorias();
  }, []);

  // Productos filtrados en cliente por la búsqueda (case-insensitive)
  const productosFiltrados = productos.filter((p: any) => {
    if (!busqueda) return true;
    return (p.nombre || '').toLowerCase().includes(busqueda.toLowerCase());
  });

  const totalPaginas = Math.max(1, Math.ceil(productosFiltrados.length / ITEMS_POR_PAGINA));
  const productosPagina = productosFiltrados.slice((pagina - 1) * ITEMS_POR_PAGINA, pagina * ITEMS_POR_PAGINA);

  function handleBusqueda(e) {
    const q = e.target.value;
    setBusqueda(q);
    setPagina(1);
    // No re-fetch: filtramos en cliente usando el array 'productos'
  }

  async function eliminarProducto(id) {
    const confirm = await Swal.fire({
      title: "¿Eliminar producto?",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;

    const res = await apiFetch('/api/productRegister/productos-eliminar', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    if (res.ok) {
      Swal.fire("Eliminado", "El producto ha sido eliminado.", "success");
      fetchProductos(busqueda);
    } else {
      Swal.fire({ title: 'Error', text: res.error || 'No se pudo eliminar el producto.', icon: 'error' });
    }
  }

  function handleInput(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint = form.id ? '/api/productRegister/productos-editar' : '/api/productRegister/productos-alta';
      const method = form.id ? 'PUT' : 'POST';
      const res = await apiFetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error(res.error || 'Error al registrar producto');

      await Swal.fire({
        title: "¡Producto registrado!",
        text: "El producto ha sido dado de alta correctamente.",
        icon: "success",
        confirmButtonText: "OK",
      });

      // Reset y refresco
      setForm({
        nombre: "",
        descripcion: "",
        categoria_id: "",
        unidad_base: "kg",
        stock_actual: "0",
        stock_minimo: "0",
        codigo_barras: "",
        precio_compra: "0.00",
      });
      fetchProductos(busqueda);

      // Abrimos modal para crear presentaciones del nuevo producto:
  await abrirModalPresentaciones((res.data as any)?.id);
    } catch (err) {
      setError(err.message || "Error al registrar producto");
    } finally {
      setLoading(false);
    }
  }

  // Llenar formulario para editar
  function editarProducto(prod: any) {
    setForm({
      id: prod.id,
      nombre: prod.nombre || '',
      descripcion: prod.descripcion || '',
      categoria_id: String(prod.categoria_id || ''),
      unidad_base: prod.unidad_base || 'kg',
      stock_actual: String(prod.stock_actual || '0'),
      stock_minimo: String(prod.stock_minimo || '0'),
      codigo_barras: prod.codigo_barras || '',
      precio_compra: String(prod.precio_compra ?? prod.precioCompra ?? '0.00'),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // === Crear categoría (Pages Router: /api/alta-productos/categorias-alta) ===
  async function crearCategoria() {
    const { value: formValues } = await Swal.fire({
      title: "Nueva categoría",
      html: `
        <input id="swal-cat-nombre" class="swal2-input" placeholder="Nombre" />
        <textarea id="swal-cat-desc" class="swal2-textarea" placeholder="Descripción"></textarea>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Guardar",
      cancelButtonText: "Cancelar",
      preConfirm: () => {
        const nombre = (document.getElementById("swal-cat-nombre") as HTMLInputElement | null)?.value?.trim();
        const descripcion = (document.getElementById("swal-cat-desc") as HTMLTextAreaElement | null)?.value?.trim();
        if (!nombre) {
          Swal.showValidationMessage("El nombre es obligatorio");
          return;
        }
        return { nombre, descripcion: descripcion || "" };
      },
    });

    if (!formValues) return; // cancelado

    try {
      const res = await apiFetch('/api/alta-productos/categorias-alta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formValues) });
      if (!res.ok) throw new Error(res.error || `Error creando categoría`);
      // refrescamos y seleccionamos la nueva categoría
      await fetchCategorias();
      setForm((prev) => ({ ...prev, categoria_id: String((res.data as any)?.id) }));
      Swal.fire({ icon: 'success', title: 'Categoría creada', text: `Se creó "${(res.data as any)?.nombre}" correctamente.` });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.message || "No se pudo crear la categoría",
      });
    }
  }

  // === Modal de presentaciones ===
  function abrirModalPresentaciones(productoId: number) {
    const id = Number(productoId) || 0;
    setPresentacionProductoId(id);
    setPresentacionForm({ nombre: "", unidad: "kg", factor_a_base: "", precio_unitario: "", codigo_barras: "", es_default: false });
    setPresentacionProductoInfo(null);
      if (id) {
      apiFetch(`/api/alta-productos/productos-detalle?id=${id}`)
        .then((r) => r.ok ? r.data : null)
        .then((json) => setPresentacionProductoInfo(json))
        .catch(() => setPresentacionProductoInfo(null));
    }
    setPresentacionModalOpen(true);
  }

  function showPresentacionHelp(field: string) {
    const infoMap: Record<string, string> = {
      nombre: 'Nombre descriptivo de la presentación (ej: "Bulto 20kg"). Útil para identificar la presentación en ventas y listados.',
      unidad: 'Unidad de medida de esta presentación. Afecta cómo se interpreta el factor a la unidad base.',
      factor: 'Cuántas unidades base equivale esta presentación. Ej: si un bulto son 20 kg, el factor sería 20. si son piezas, poner 1.',
      precio: 'Precio unitario de la presentación. Se usa como precio por defecto al vender con esta presentación.',
      codigo: 'Código de barras opcional para la presentación. Útil para lector de códigos y búsqueda rápida.',
      es_default: 'Si está marcado, esta presentación será la seleccionada por defecto al crear ventas o mostrar el producto.',
    };
    Swal.fire({ icon: 'info', title: 'Ayuda', text: infoMap[field] || '' });
  }

  async function submitPresentacion() {
    // validations
    const nombre = (presentacionForm.nombre || '').trim();
    const unidad = presentacionForm.unidad;
    const factor = Number(presentacionForm.factor_a_base || 0);
    const precio = Number(presentacionForm.precio_unitario || 0);
    if (!nombre) return Swal.fire('Error', 'El nombre es obligatorio', 'error');
    if (!unidad) return Swal.fire('Error', 'La unidad es obligatoria', 'error');
    if (!(factor > 0)) return Swal.fire('Error', 'El factor a base debe ser mayor que 0', 'error');
    if (!(precio >= 0)) return Swal.fire('Error', 'El precio unitario debe ser 0 o mayor', 'error');
    if (!presentacionProductoId) return Swal.fire('Error', 'Producto inválido', 'error');

    setPresentacionLoading(true);
    try {
      const payloadBody = [{ producto_id: presentacionProductoId, nombre, unidad, factor_a_base: factor, precio_unitario: precio, codigo_barras: presentacionForm.codigo_barras || null, es_default: Boolean(presentacionForm.es_default) }];
  const res = await apiFetch('/api/alta-productos/presentaciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payloadBody) });
  if (!res.ok) throw new Error(res.error || 'Error al crear presentaciones');
      await Swal.fire('Presentación registrada', `Se guardó "${nombre}" correctamente.`, 'success');
      // preguntar si agregar otra
      const resp = await Swal.fire({ icon: 'question', title: '¿Agregar otra presentación?', showCancelButton: true, confirmButtonText: 'Sí', cancelButtonText: 'No' });
      if (resp.isConfirmed) {
        // reset form for another
        setPresentacionForm({ nombre: '', unidad: 'kg', factor_a_base: '', precio_unitario: '', codigo_barras: '', es_default: false });
      } else {
        setPresentacionModalOpen(false);
      }
    } catch (err: any) {
      await Swal.fire('Error', err?.message || 'No se pudo crear la presentación', 'error');
    } finally {
      setPresentacionLoading(false);
      fetchProductos(busqueda);
    }
  }

  return (
    <div className="min-h-screen bg-[#091B26] p-6">
      <button
        onClick={() => window.location.href = "/gestor-productos-menu"}
        className="mb-4 px-4 py-2 rounded-xl bg-[#038C65] text-white font-semibold shadow hover:bg-[#027857]"
      >
        ← Volver al gestor de productos
      </button>
      <div className="mx-auto max-w-7xl">
        <h1 className="text-2xl font-bold text-[#038C65] mb-6">Alta de productos</h1>

        {/* Dos columnas: izquierda formulario, derecha tabla */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Columna izquierda: Formulario */}
          <div className="bg-white rounded-xl shadow p-8">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block text-sm font-medium text-[#038C65] mb-1" htmlFor="nombre">
                Nombre <button type="button" onClick={() => showFieldHelp('nombre')} className="ml-2 text-sm bg-[#0EA5A5] text-white px-2 py-0.5 rounded">?</button>
              </label>
              <input
                id="nombre"
                name="nombre"
                value={form.nombre}
                onChange={handleInputtwo}
                placeholder="Nombre del producto"
                required
                className="w-full rounded-xl border px-3 py-2 text-black bg-white mb-2"
              />

              <label className="block text-sm font-medium text-[#038C65] mb-1" htmlFor="descripcion">
                Descripción <button type="button" onClick={() => showFieldHelp('descripcion')} className="ml-2 text-sm bg-[#0EA5A5] text-white px-2 py-0.5 rounded">?</button>
              </label>
              <textarea
                id="descripcion"
                name="descripcion"
                value={form.descripcion}
                onChange={handleInput}
                placeholder="Descripción"
                required
                className="w-full rounded-xl border px-3 py-2 text-black bg-white mb-2"
              />

              <label className="block text-sm font-medium text-[#038C65] mb-1" htmlFor="categoria_id">
                Categoría <button type="button" onClick={() => showFieldHelp('categoria')} className="ml-2 text-sm bg-[#0EA5A5] text-white px-2 py-0.5 rounded">?</button>
              </label>
              <div className="flex gap-2">
                <select
                  id="categoria_id"
                  name="categoria_id"
                  value={form.categoria_id}
                  onChange={handleInput}
                  required
                  className="w-full rounded-xl border px-3 py-2 text-black bg-white mb-2"
                >
                  <option value="">Selecciona una categoría</option>
                  {categorias.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nombre}
                    </option>
                  ))}
                </select>

                {/* Botón rápido para crear categoría */}
                <button
                  type="button"
                  onClick={crearCategoria}
                  className="whitespace-nowrap rounded-xl bg-[#0EA5A5] text-white font-semibold px-4 py-2 h-[42px] mt-[-0.25rem] shadow hover:opacity-90"
                  title="Crear nueva categoría"
                >
                  + Nueva
                </button>
              </div>

              <label className="block text-sm font-medium text-[#038C65] mb-1" htmlFor="unidad_base">
                Unidad base <button type="button" onClick={() => showFieldHelp('unidad_base')} className="ml-2 text-sm bg-[#0EA5A5] text-white px-2 py-0.5 rounded">?</button>
              </label>
              <select
                id="unidad_base"
                name="unidad_base"
                value={form.unidad_base}
                onChange={handleInput}
                className="w-full rounded-xl border px-3 py-2 text-black bg-white mb-2"
              >
                <option value="kg">Kilogramo</option>
                <option value="bulto">Bulto</option>
                <option value="pieza">Pieza</option>
              </select>

              <label className="block text-sm font-medium text-[#038C65] mb-1" htmlFor="stock_actual">
                Stock actual <button type="button" onClick={() => showFieldHelp('stock_actual')} className="ml-2 text-sm bg-[#0EA5A5] text-white px-2 py-0.5 rounded">?</button>
              </label>
              <input
                id="stock_actual"
                name="stock_actual"
                type="number"
                value={form.stock_actual}
                onChange={handleInput}
                placeholder="Stock actual"
                min="0"
                required
                className="w-full rounded-xl border px-3 py-2 text-black bg-white mb-2"
              />

              <label className="block text-sm font-medium text-[#038C65] mb-1" htmlFor="stock_minimo">
                Stock mínimo <button type="button" onClick={() => showFieldHelp('stock_minimo')} className="ml-2 text-sm bg-[#0EA5A5] text-white px-2 py-0.5 rounded">?</button>
              </label>
              <input
                id="stock_minimo"
                name="stock_minimo"
                type="number"
                value={form.stock_minimo}
                onChange={handleInput}
                placeholder="Stock mínimo"
                min="0"
                required
                className="w-full rounded-xl border px-3 py-2 text-black bg-white mb-2"
              />

              <label className="block text-sm font-medium text-[#038C65] mb-1" htmlFor="precio_compra">
                Precio de compra <button type="button" onClick={() => showFieldHelp('precio')} className="ml-2 text-sm bg-[#0EA5A5] text-white px-2 py-0.5 rounded">?</button>
              </label>
              <input
                id="precio_compra"
                name="precio_compra"
                type="number"
                step="0.01"
                value={form.precio_compra}
                onChange={handleInput}
                placeholder="Precio al que se compra"
                min="0"
                required
                className="w-full rounded-xl border px-3 py-2 text-black bg-white mb-2"
              />

              <label
                className="block text-sm font-medium text-[#038C65] mb-1"
                htmlFor="codigo_barras"
              >
                Código de barras <button type="button" onClick={() => showFieldHelp('codigo_barras')} className="ml-2 text-sm bg-[#0EA5A5] text-white px-2 py-0.5 rounded">?</button>
              </label>
              <input
                id="codigo_barras"
                name="codigo_barras"
                value={form.codigo_barras}
                readOnly
                className="w-full rounded-xl border px-3 py-2 text-black bg-gray-100 mb-2 cursor-not-allowed"
              />

              {/* Botones al final del formulario, uno junto al otro */}
              <div className="flex flex-col sm:flex-row gap-3 sm:justify-end pt-2">

                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-[#038C65] text-white font-semibold px-5 py-2 shadow hover:bg-[#027857] disabled:opacity-60"
                >
                  {loading ? "Guardando..." : (form.id ? 'Guardar cambios' : 'Registrar producto')}
                </button>
              </div>

              {error && <div className="text-red-600 mt-2">{error}</div>}
            </form>
          </div>

          {/* Columna derecha: Tabla */}
          <div className="bg-white rounded-xl shadow p-8">
            <h2 className="text-xl font-bold text-[#038C65] mb-4">Lista de productos</h2>
            <p className="text-sm text-gray-600 mb-4">En esta sección podrás ver todos los productos registrados en el sistema y agregar presentaciones para venta.</p>

            <input
              type="text"
              value={busqueda}
              onChange={handleBusqueda}
              placeholder="Buscar por nombre"
              className="w-full rounded-xl border px-3 py-2 text-black bg-white mb-4"
            />

            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border rounded-xl">
                <thead>
                  <tr className="bg-[#F2F0EB] text-[#038C65]">
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">Categoría</th>
                    <th className="px-3 py-2">Stock</th>
                    <th className="px-3 py-2">Unidad</th>
                    <th className="px-3 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tablaLoading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-4">
                        Cargando...
                      </td>
                    </tr>
                  ) : productos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-4">
                        No hay productos
                      </td>
                    </tr>
                  ) : productosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-4">
                        {busqueda ? 'No se encontraron productos que coincidan con la búsqueda' : 'No hay productos'}
                      </td>
                    </tr>
                  ) : (
                    productosPagina.map((prod) => (
                      <tr key={prod.id} className="border-b">
                        <td className="px-3 py-2">{prod.nombre}</td>
                        <td className="px-3 py-2">{prod.categoria?.nombre || prod.categoria_id}</td>
                        <td className="px-3 py-2">{prod.stock_actual}</td>
                        <td className="px-3 py-2">{prod.unidad_base}</td>
                        <td className="px-3 py-2 flex gap-2">
                          {/* Botón presentaciones */}
                          <button
                            className="bg-[#059669] p-2 rounded hover:bg-[#047857]"
                            onClick={() => abrirModalPresentaciones(prod.id)}
                            title="Agregar presentaciones"
                          >
                            <PlusCircle className="h-5 w-5 text-white" />
                          </button>

                          {/* Botón editar */}
                          <button
                            className="bg-blue-500 p-2 rounded hover:bg-blue-600"
                            onClick={() => editarProducto(prod)}
                            title="Editar producto"
                          >
                            ✏️
                          </button>

                          {/* Botón eliminar */}
                          {/* <button
                            className="bg-[#EF4444] p-2 rounded hover:bg-[#B91C1C]"
                            onClick={() => eliminarProducto(prod.id)}
                            title="Eliminar producto"
                          >
                            <Trash2 className="h-5 w-5 text-white" />
                          </button>  */}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
              {/* Paginación */}
              <div className="mt-3 flex items-center justify-between">
                <div className="text-sm text-gray-600">Página {pagina} de {totalPaginas} — {productosFiltrados.length} productos</div>
                <div className="flex gap-2">
                  <button disabled={pagina <= 1} onClick={() => setPagina(p => Math.max(1, p - 1))} className="px-3 py-1 rounded bg-gray-100">Anterior</button>
                  <button disabled={pagina >= totalPaginas} onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} className="px-3 py-1 rounded bg-gray-100">Siguiente</button>
                </div>
              </div>
          </div>
        </div>

        {/* /grid */}
      </div>

      {/* Modal React para presentaciones */}
      {presentacionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[#038C65]">Nueva presentación {presentacionProductoInfo ? `para "${presentacionProductoInfo.nombre}"` : ''}</h3>
              <div className="flex gap-2">
                <button className="px-3 py-1 rounded bg-gray-200" onClick={() => setPresentacionModalOpen(false)}>Cerrar</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium">Nombre <button type="button" onClick={() => showPresentacionHelp('nombre')} className="ml-2 text-sm bg-[#0EA5A5] text-white px-2 rounded">?</button></label>
                <input value={presentacionForm.nombre} onChange={(e) => setPresentacionForm(prev => ({ ...prev, nombre: e.target.value }))} className="w-full rounded-xl border px-3 py-2" />
              </div>
              <div>
                <label className="block font-medium">Unidad <button type="button" onClick={() => showPresentacionHelp('unidad')} className="ml-2 text-sm bg-[#0EA5A5] text-white px-2 rounded">?</button></label>
                <select value={presentacionForm.unidad} onChange={(e) => setPresentacionForm(prev => ({ ...prev, unidad: e.target.value }))} className="w-full rounded-xl border px-3 py-2">
                  <option value="kg">Kilogramo</option>
                  <option value="bulto">Bulto</option>
                  <option value="pieza">Pieza</option>
                </select>
              </div>

              <div>
                <label className="block font-medium">Factor a base <button type="button" onClick={() => showPresentacionHelp('factor')} className="ml-2 text-sm bg-[#0EA5A5] text-white px-2 rounded">?</button></label>
                <input type="number" min="0.0001" step="0.0001" value={presentacionForm.factor_a_base} onChange={(e) => setPresentacionForm(prev => ({ ...prev, factor_a_base: e.target.value }))} className="w-full rounded-xl border px-3 py-2" />
              </div>

              <div>
                <label className="block font-medium">Precio unitario <button type="button" onClick={() => showPresentacionHelp('precio')} className="ml-2 text-sm bg-[#0EA5A5] text-white px-2 rounded">?</button></label>
                <input type="number" min="0" step="0.01" value={presentacionForm.precio_unitario} onChange={(e) => setPresentacionForm(prev => ({ ...prev, precio_unitario: e.target.value }))} className="w-full rounded-xl border px-3 py-2" />
              </div>

              <div className="md:col-span-2">
                <label className="block font-medium">Código de barras <button type="button" onClick={() => showPresentacionHelp('codigo')} className="ml-2 text-sm bg-[#0EA5A5] text-white px-2 rounded">?</button></label>
                <input value={presentacionForm.codigo_barras} onChange={(e) => setPresentacionForm(prev => ({ ...prev, codigo_barras: e.target.value }))} className="w-full rounded-xl border px-3 py-2" />
              </div>

              <div className="md:col-span-2 flex items-center gap-3">
                <input id="es_default" type="checkbox" checked={Boolean(presentacionForm.es_default)} onChange={(e) => setPresentacionForm(prev => ({ ...prev, es_default: e.target.checked }))} />
                <label htmlFor="es_default" className="font-medium">Marcar como presentación por defecto <button type="button" onClick={() => showPresentacionHelp('es_default')} className="ml-2 text-sm bg-[#0EA5A5] text-white px-2 rounded">?</button></label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button disabled={presentacionLoading} onClick={() => setPresentacionModalOpen(false)} className="px-4 py-2 rounded-xl bg-gray-200">Cancelar</button>
              <button disabled={presentacionLoading} onClick={submitPresentacion} className="px-4 py-2 rounded-xl bg-[#038C65] text-white">{presentacionLoading ? 'Guardando...' : 'Guardar presentación'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
