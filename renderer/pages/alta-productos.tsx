"use client";

import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";

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
  const [error, setError] = useState<string | null>(null);

  // Tipamos un poquito para evitar quejas de TS
  const [categorias, setCategorias] = useState<{ id: number; nombre: string }[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [tablaLoading, setTablaLoading] = useState(false);

  async function fetchProductos(nombre = "") {
    setTablaLoading(true);
    let url = "/api/productRegister/productos-listar";
    if (nombre) url += `?nombre=${encodeURIComponent(nombre)}`;
    const res = await fetch(url);
    const data = await res.json();
    setProductos(data);
    setTablaLoading(false);
  }

  useEffect(() => {
    fetchProductos();
  }, []);

  function handleBusqueda(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setBusqueda(q);
    fetchProductos(q);
  }

  async function eliminarProducto(id: number) {
    const confirm = await Swal.fire({
      title: "¿Eliminar producto?",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (confirm.isConfirmed) {
      const res = await fetch("/api/productRegister/productos-eliminar", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        Swal.fire("Eliminado", "El producto ha sido eliminado.", "success");
        fetchProductos(busqueda);
      } else {
        const data = await res.json();
        Swal.fire({
          title: "Error",
          text: data.error || "No se pudo eliminar el producto.",
          icon: "error",
        });
      }
    }
  }

  useEffect(() => {
    async function fetchCategorias() {
      try {
        const res = await fetch("/api/productRegister/categorias-listar");
        const data = await res.json();
        setCategorias(data);
      } catch {
        setCategorias([]);
      }
    }
    fetchCategorias();
  }, []);

  function handleInput(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/productRegister/productos-alta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Error al registrar producto");
    } else {
      Swal.fire({
        title: "¡Producto registrado!",
        text: "El producto ha sido dado de alta correctamente.",
        icon: "success",
        confirmButtonText: "OK",
      }).then(() => {
        setForm({
          nombre: "",
          descripcion: "",
          categoria_id: "",
          unidad_base: "kg",
          stock_actual: "0",
          stock_minimo: "0",
          codigo_barras: "",
        });
        // opcional: refrescar la tabla tras registrar
        fetchProductos(busqueda);
      });
    }
  }

  return (
    <div className="min-h-screen bg-[#F2F0EB] p-6">
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
                onChange={handleInput}
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

              <label className="block text-sm font-medium text-[#038C65] mb-1" htmlFor="codigo_barras">
                Código de barras
              </label>
              <input
                id="codigo_barras"
                name="codigo_barras"
                value={form.codigo_barras}
                onChange={handleInput}
                placeholder="Código de barras (opcional)"
                className="w-full rounded-xl border px-3 py-2 text-black bg-white mb-2"
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#038C65] text-white font-semibold px-4 py-2 mt-2 shadow hover:bg-[#027857]"
              >
                {loading ? "Guardando..." : "Registrar producto"}
              </button>
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
                    <th className="px-3 py-2">Descripción</th>
                    <th className="px-3 py-2">Categoría</th>
                    <th className="px-3 py-2">Unidad</th>
                    <th className="px-3 py-2">Stock</th>
                    <th className="px-3 py-2">Stock mínimo</th>
                    <th className="px-3 py-2">Código de barras</th>
                    <th className="px-3 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tablaLoading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-4">
                        Cargando...
                      </td>
                    </tr>
                  ) : productos.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-4">
                        No hay productos
                      </td>
                    </tr>
                  ) : (
                    productos.map((prod: any) => (
                      <tr key={prod.id} className="border-b">
                        <td className="px-3 py-2">{prod.nombre}</td>
                        <td className="px-3 py-2">{prod.descripcion}</td>
                        <td className="px-3 py-2">
                          {prod.categoria?.nombre || prod.categoria_id}
                        </td>
                        <td className="px-3 py-2">{prod.unidad_base}</td>
                        <td className="px-3 py-2">{prod.stock_actual}</td>
                        <td className="px-3 py-2">{prod.stock_minimo}</td>
                        <td className="px-3 py-2">{prod.codigo_barras}</td>
                        <td className="px-3 py-2">
                          <button
                            className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-700"
                            onClick={() => eliminarProducto(prod.id)}
                          >
                            Eliminar
                          </button>
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
