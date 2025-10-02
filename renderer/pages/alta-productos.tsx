"use client";

import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { PlusCircle, Trash2 } from "lucide-react";

export default function AltaProductosPage() {
  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    categoria_id: "",
    unidad_base: "kg",
    stock_actual: "0",
    stock_minimo: "0",
    codigo_barras: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [tablaLoading, setTablaLoading] = useState(false);

  function generarCodigo(nombre) {
    if (!nombre) return "";
    const base = nombre.replace(/\s+/g, ""); // quitamos espacios
    const random = Math.floor(100000000 + Math.random() * 900000000); // 9 dígitos
    return `${base}${random}`;
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
      let url = "/api/productRegister/productos-listar"; // tu endpoint existente
      if (nombre) url += `?nombre=${encodeURIComponent(nombre)}`;
      const res = await fetch(url);
      const data = await res.json();
      setProductos(Array.isArray(data) ? data : []);
    } catch {
      setProductos([]);
    } finally {
      setTablaLoading(false);
    }
  }

  async function fetchCategorias() {
    try {
      const res = await fetch("/api/productRegister/categorias-listar"); // opcional; usa el tuyo si es distinto
      const data = await res.json();
      setCategorias(Array.isArray(data) ? data : []);
    } catch {
      setCategorias([]);
    }
  }

  useEffect(() => {
    fetchProductos();
    fetchCategorias();
  }, []);

  function handleBusqueda(e) {
    const q = e.target.value;
    setBusqueda(q);
    fetchProductos(q);
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

    const res = await fetch("/api/productRegister/productos-eliminar", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      Swal.fire("Eliminado", "El producto ha sido eliminado.", "success");
      fetchProductos(busqueda);
    } else {
      const data = await res.json().catch(() => ({}));
      Swal.fire({
        title: "Error",
        text: data.error || "No se pudo eliminar el producto.",
        icon: "error",
      });
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
      const res = await fetch("/api/productRegister/productos-alta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const ct = res.headers.get("content-type") || "";
      const data = ct.includes("application/json") ? await res.json() : { error: await res.text() };
      if (!res.ok) throw new Error(data?.error || "Error al registrar producto");

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
      });
      fetchProductos(busqueda);

      // Abrimos modal para crear presentaciones del nuevo producto:
      await abrirModalPresentaciones(data.id);
    } catch (err) {
      setError(err.message || "Error al registrar producto");
    } finally {
      setLoading(false);
    }
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
        const nombre = document.getElementById("swal-cat-nombre")?.value?.trim();
        const descripcion = document.getElementById("swal-cat-desc")?.value?.trim();
        if (!nombre) {
          Swal.showValidationMessage("El nombre es obligatorio");
          return;
        }
        return { nombre, descripcion: descripcion || "" };
      },
    });

    if (!formValues) return; // cancelado

    try {
      const res = await fetch("/api/alta-productos/categorias-alta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValues),
      });

      const contentType = res.headers.get("content-type") || "";
      const payload = contentType.includes("application/json")
        ? await res.json()
        : { error: await res.text() };

      if (!res.ok) throw new Error(payload?.error || `Error HTTP ${res.status}`);

      // refrescamos y seleccionamos la nueva categoría
      await fetchCategorias();
      setForm((prev) => ({ ...prev, categoria_id: String(payload.id) }));

      Swal.fire({
        icon: "success",
        title: "Categoría creada",
        text: `Se creó "${payload.nombre}" correctamente.`,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.message || "No se pudo crear la categoría",
      });
    }
  }

  // === Modal de presentaciones ===
  async function abrirModalPresentaciones(productoId) {
    let prodId = Number(productoId) || 0;

    // Traemos info del producto (opcional; solo para mostrar nombre)
    let productoInfo = null;
    if (prodId) {
      try {
        const res = await fetch(`/api/alta-productos/productos-detalle?id=${prodId}`);
        if (res.ok) productoInfo = await res.json();
      } catch { }
    }

    let seguir = true;

    while (seguir) {
      const { value: formValues } = await Swal.fire({
        title: `Nueva presentación ${productoInfo ? `para "${productoInfo.nombre}"` : ""}`,
        html: `
          <input id="p-nombre" class="swal2-input" placeholder="Nombre (ej: Bulto 20kg)">
          <select id="p-unidad" class="swal2-input">
            <option value="kg">Kilogramo</option>
            <option value="bulto">Bulto</option>
            <option value="pieza">Pieza</option>
          </select>
          <input id="p-factor" type="number" min="0.0001" step="0.0001" class="swal2-input" placeholder="Factor a base (ej: 20 si Bulto=20kg)">
          <input id="p-precio" type="number" min="0" step="0.01" class="swal2-input" placeholder="Precio unitario">
          <input id="p-codigo" class="swal2-input" placeholder="Código de barras (opcional)">
          <label style="display:flex;gap:8px;align-items:center;justify-content:center;margin-top:4px;">
            <input id="p-default" type="checkbox">
            <span>Marcar como presentación por defecto</span>
          </label>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: "Guardar presentación",
        cancelButtonText: "Cancelar",
        preConfirm: () => {
          const nombre = document.getElementById("p-nombre")?.value?.trim();
          const unidad = document.getElementById("p-unidad")?.value;
          const factor = Number((document.getElementById("p-factor")?.value || "0").trim());
          const precio = Number((document.getElementById("p-precio")?.value || "0").trim());
          const codigo = document.getElementById("p-codigo")?.value?.trim();
          const es_default = document.getElementById("p-default")?.checked;

          if (!nombre) {
            Swal.showValidationMessage("El nombre es obligatorio");
            return;
          }
          if (!unidad) {
            Swal.showValidationMessage("La unidad es obligatoria");
            return;
          }
          if (!(factor > 0)) {
            Swal.showValidationMessage("El factor a base debe ser mayor que 0");
            return;
          }
          if (!(precio >= 0)) {
            Swal.showValidationMessage("El precio unitario debe ser 0 o mayor");
            return;
          }

          return {
            nombre,
            unidad,
            factor_a_base: factor,
            precio_unitario: precio,
            codigo_barras: codigo || null,
            es_default,
          };
        },
      });

      if (!formValues) break; // cancelado

      try {
        const res = await fetch("/api/alta-productos/presentaciones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // batch por si luego quieres enviar varias
          body: JSON.stringify([{ producto_id: prodId, ...formValues }]),
        });

        const ct = res.headers.get("content-type") || "";
        const payload = ct.includes("application/json") ? await res.json() : { error: await res.text() };
        if (!res.ok) throw new Error(payload?.error || `Error HTTP ${res.status}`);

        await Swal.fire({
          icon: "success",
          title: "Presentación registrada",
          text: `Se guardó "${formValues.nombre}" correctamente.`,
        });

        const resp = await Swal.fire({
          icon: "question",
          title: "¿Agregar otra presentación?",
          showCancelButton: true,
          confirmButtonText: "Sí",
          cancelButtonText: "No",
        });
        seguir = resp.isConfirmed;
      } catch (err) {
        await Swal.fire({
          icon: "error",
          title: "Error",
          text: err.message || "No se pudo crear la presentación",
        });
        const retry = await Swal.fire({
          icon: "question",
          title: "¿Intentar de nuevo?",
          showCancelButton: true,
          confirmButtonText: "Reintentar",
          cancelButtonText: "Cancelar",
        });
        seguir = retry.isConfirmed;
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#091B26] p-6">
      <button
        onClick={() => window.location.href = "/menuPrincipal"}
        className="mb-4 px-4 py-2 rounded-xl bg-[#038C65] text-white font-semibold shadow hover:bg-[#027857]"
      >
        ← Volver al menú principal
      </button>
      <div className="mx-auto max-w-7xl">
        <h1 className="text-2xl font-bold text-[#038C65] mb-6">Alta de productos</h1>

        {/* Dos columnas: izquierda formulario, derecha tabla */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Columna izquierda: Formulario */}
          <div className="bg-white rounded-xl shadow p-8">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block text-sm font-medium text-[#038C65] mb-1" htmlFor="nombre">
                Nombre
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
                Descripción
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
                Categoría
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
                Unidad base
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
                Stock actual
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
                Stock mínimo
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

              <label
                className="block text-sm font-medium text-[#038C65] mb-1"
                htmlFor="codigo_barras"
              >
                Código de barras
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
                  {loading ? "Guardando..." : "Registrar producto"}
                </button>
              </div>

              {error && <div className="text-red-600 mt-2">{error}</div>}
            </form>
          </div>

          {/* Columna derecha: Tabla */}
          <div className="bg-white rounded-xl shadow p-8">
            <h2 className="text-xl font-bold text-[#038C65] mb-4">Lista de productos</h2>

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
                  ) : (
                    productos.map((prod) => (
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
          </div>
        </div>
        {/* /grid */}
      </div>
    </div>
  );
}
