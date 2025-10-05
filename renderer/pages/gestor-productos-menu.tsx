"use client";

import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { Edit, Power, Trash2, Eye, Plus } from "lucide-react";

interface Presentacion {
  id: number;
  nombre: string;
  unidad: 'kg' | 'bulto' | 'pieza';
  factor_a_base: number;
  precio_unitario: number;
  codigo_barras?: string;
  es_default: boolean;
  activo: boolean;
  producto: {
    id: number;
    nombre: string;
    categoria?: {
      id: number;
      nombre: string;
    };
  };
}

export default function GestorProductosMenuPage() {
  const [presentaciones, setPresentaciones] = useState<Presentacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<Presentacion | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  
  // Estado del formulario del modal
  const [modalForm, setModalForm] = useState({
    id: 0,
    nombre: "",
    unidad: "kg" as 'kg' | 'bulto' | 'pieza',
    factor_a_base: "",
    precio_unitario: "",
    codigo_barras: "",
    es_default: false,
    activo: true
  });

  // Cargar presentaciones
  async function fetchPresentaciones() {
    try {
      setLoading(true);
      const response = await fetch('/api/gestion-productos/presentaciones-listar');
      const data = await response.json();
      
      if (response.ok) {
        setPresentaciones(Array.isArray(data) ? data : []);
      } else {
        console.error('Error al cargar presentaciones:', data.error);
        setPresentaciones([]);
      }
    } catch (error) {
      console.error('Error al cargar presentaciones:', error);
      setPresentaciones([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPresentaciones();
  }, []);

  // Filtrar presentaciones según búsqueda
  const presentacionesFiltradas = presentaciones.filter(presentacion => 
    presentacion.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    presentacion.producto.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (presentacion.producto.categoria?.nombre || "").toLowerCase().includes(busqueda.toLowerCase())
  );

  // Función para activar/desactivar presentación
  async function toggleEstadoPresentacion(id: number) {
    const presentacion = presentaciones.find(p => p.id === id);
    if (!presentacion) return;
    
    const accion = presentacion.activo ? 'desactivar' : 'activar';
    const confirmar = await Swal.fire({
      title: `¿${accion.charAt(0).toUpperCase() + accion.slice(1)} presentación?`,
      text: `¿Está seguro de que desea ${accion} "${presentacion.nombre}"?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: `Sí, ${accion}`,
      cancelButtonText: 'Cancelar'
    });
    
    if (!confirmar.isConfirmed) return;
    
    try {
      const response = await fetch('/api/gestion-productos/presentaciones-toggle', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        await Swal.fire({
          icon: 'success',
          title: 'Estado actualizado',
          text: data.message,
          timer: 2000,
          showConfirmButton: false
        });
        fetchPresentaciones();
      } else {
        throw new Error(data.error || 'Error al cambiar estado');
      }
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error instanceof Error ? error.message : 'Error al cambiar estado de la presentación'
      });
    }
  }

  // Abrir modal para edición
  async function abrirModalEdicion(presentacionId: number) {
    try {
      setModalLoading(true);
      const response = await fetch(`/api/gestion-productos/presentaciones-detalle?id=${presentacionId}`);
      const data = await response.json();
      
      if (response.ok) {
        setModalData(data);
        setModalForm({
          id: data.id,
          nombre: data.nombre,
          unidad: data.unidad,
          factor_a_base: data.factor_a_base.toString(),
          precio_unitario: data.precio_unitario.toString(),
          codigo_barras: data.codigo_barras || "",
          es_default: data.es_default,
          activo: data.activo
        });
        setModalOpen(true);
      } else {
        throw new Error(data.error || 'Error al cargar presentación');
      }
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error instanceof Error ? error.message : 'Error al cargar los datos de la presentación'
      });
    } finally {
      setModalLoading(false);
    }
  }

  // Guardar cambios del modal
  async function guardarPresentacion() {
    // Validaciones
    if (!modalForm.nombre.trim()) {
      await Swal.fire('Error', 'El nombre es obligatorio', 'error');
      return;
    }
    
    const factor = parseFloat(modalForm.factor_a_base);
    if (!(factor > 0)) {
      await Swal.fire('Error', 'El factor a base debe ser mayor que 0', 'error');
      return;
    }
    
    const precio = parseFloat(modalForm.precio_unitario);
    if (!(precio >= 0)) {
      await Swal.fire('Error', 'El precio unitario debe ser 0 o mayor', 'error');
      return;
    }
    
    try {
      setModalLoading(true);
      const response = await fetch('/api/gestion-productos/presentaciones-editar', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: modalForm.id,
          nombre: modalForm.nombre.trim(),
          unidad: modalForm.unidad,
          factor_a_base: factor,
          precio_unitario: precio,
          codigo_barras: modalForm.codigo_barras.trim() || null,
          es_default: modalForm.es_default
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        await Swal.fire({
          icon: 'success',
          title: 'Presentación actualizada',
          text: data.message,
          timer: 2000,
          showConfirmButton: false
        });
        setModalOpen(false);
        fetchPresentaciones();
      } else {
        throw new Error(data.error || 'Error al actualizar presentación');
      }
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error instanceof Error ? error.message : 'Error al actualizar la presentación'
      });
    } finally {
      setModalLoading(false);
    }
  }

  // Eliminar presentación
  async function eliminarPresentacion(id: number) {
    const presentacion = presentaciones.find(p => p.id === id);
    if (!presentacion) return;
    
    const confirmar = await Swal.fire({
      title: '¿Eliminar presentación?',
      text: `¿Está seguro de que desea eliminar "${presentacion.nombre}"? Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#EF4444'
    });
    
    if (!confirmar.isConfirmed) return;
    
    try {
      const response = await fetch('/api/gestion-productos/presentaciones-eliminar', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        await Swal.fire({
          icon: 'success',
          title: 'Presentación eliminada',
          text: data.message,
          timer: 2000,
          showConfirmButton: false
        });
        fetchPresentaciones();
      } else {
        throw new Error(data.error || 'Error al eliminar presentación');
      }
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error instanceof Error ? error.message : 'Error al eliminar la presentación'
      });
    }
  }

  // Función para mostrar ayuda
  function mostrarAyuda(campo: string) {
    const ayudas: Record<string, string> = {
      presentacion:
        'Nombre descriptivo que identifica la presentación. Útil para distinguir variantes del mismo producto (ej: "Bulto 20kg", "Kg suelto", "Pieza"). Debe ser claro para que cajeros y usuarios identifiquen rápidamente la opción al vender o consultar inventario.',
      nombre: 'Nombre descriptivo de la presentación (ej: "Bulto 20kg", "Pieza individual").',
      unidad: 'Unidad de medida de esta presentación. Debe coincidir con el tipo de factor.',
      factor: 'Cuántas unidades base equivale esta presentación. Ej: si un bulto son 20 kg, el factor sería 20. Se utiliza para convertir la cantidad de la presentación a la unidad base del producto y para ajustar inventario y precios correctamente.',
      precio: 'Precio unitario de venta para esta presentación.',
      codigo: 'Código de barras opcional para identificación rápida.',
      default: 'Si está marcado, esta será la presentación seleccionada por defecto en las ventas. Sólo una presentación por producto debe ser marcada como por defecto para evitar ambigüedades al crear tickets.'
    };

    Swal.fire({
      icon: 'info',
      title: 'Ayuda',
      text: ayudas[campo] || 'No hay ayuda disponible para este campo.'
    });
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
        <h1 className="text-2xl font-bold text-[#038C65] mb-6">Gestor de Presentaciones de Productos</h1>

        {/* Barra de búsqueda */}
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre de presentación, producto o categoría..."
              className="flex-1 rounded-xl border px-4 py-2 text-black bg-white"
            />
            <div className="flex gap-3">
              <button
                onClick={() => window.location.href = '/alta-productos'}
                className="px-4 py-2 rounded-xl bg-[#0EA5A5] text-white font-semibold shadow hover:opacity-90"
                title="Ir a alta de productos"
              >
                + Nuevo producto
              </button>
              <button
                onClick={fetchPresentaciones}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-[#038C65] text-white font-semibold shadow hover:bg-[#027857] disabled:opacity-60"
              >
                {loading ? 'Cargando...' : 'Actualizar'}
              </button>
            </div>
          </div>
        </div>

        {/* Tabla de presentaciones */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-[#F2F0EB]">
                <tr>
                  <th className="px-4 py-3 text-left text-[#038C65] font-semibold">Producto</th>
                  <th className="px-4 py-3 text-left text-[#038C65] font-semibold">
                    Presentación
                    <button type="button" onClick={() => mostrarAyuda('presentacion')} className="ml-2 text-sm bg-[#0EA5A5] text-white px-2 py-0.5 rounded">?</button>
                  </th>
                  <th className="px-4 py-3 text-left text-[#038C65] font-semibold">Categoría</th>
                  <th className="px-4 py-3 text-left text-[#038C65] font-semibold">Unidad</th>
                  <th className="px-4 py-3 text-left text-[#038C65] font-semibold">
                    Factor Base
                    <button type="button" onClick={() => mostrarAyuda('factor')} className="ml-2 text-sm bg-[#0EA5A5] text-white px-2 py-0.5 rounded">?</button>
                  </th>
                  <th className="px-4 py-3 text-left text-[#038C65] font-semibold">Precio</th>
                  <th className="px-4 py-3 text-left text-[#038C65] font-semibold">Estado</th>
                  <th className="px-4 py-3 text-left text-[#038C65] font-semibold">
                    Default
                    <button type="button" onClick={() => mostrarAyuda('default')} className="ml-2 text-sm bg-[#0EA5A5] text-white px-2 py-0.5 rounded">?</button>
                  </th>
                  <th className="px-4 py-3 text-center text-[#038C65] font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                      Cargando presentaciones...
                    </td>
                  </tr>
                ) : presentacionesFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                      {busqueda ? 'No se encontraron presentaciones que coincidan con la búsqueda' : 'No hay presentaciones registradas'}
                    </td>
                  </tr>
                ) : (
                  presentacionesFiltradas.map((presentacion) => (
                    <tr key={presentacion.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3">{presentacion.producto.nombre}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{presentacion.nombre}</div>
                        {presentacion.codigo_barras && (
                          <div className="text-sm text-gray-500">Código: {presentacion.codigo_barras}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">{presentacion.producto.categoria?.nombre || 'Sin categoría'}</td>
                      <td className="px-4 py-3">
                        <span className="capitalize">{presentacion.unidad}</span>
                      </td>
                      <td className="px-4 py-3">{presentacion.factor_a_base}</td>
                      <td className="px-4 py-3">${presentacion.precio_unitario}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          presentacion.activo 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {presentacion.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {presentacion.es_default && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Por defecto
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-center">
                          {/* Botón editar */}
                          <button
                            onClick={() => abrirModalEdicion(presentacion.id)}
                            disabled={modalLoading}
                            className="p-2 rounded hover:bg-blue-100 text-blue-600"
                            title="Editar presentación"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          
                          {/* Botón activar/desactivar */}
                          <button
                            onClick={() => toggleEstadoPresentacion(presentacion.id)}
                            className={`p-2 rounded hover:bg-opacity-80 ${
                              presentacion.activo 
                                ? 'text-red-600 hover:bg-red-100' 
                                : 'text-green-600 hover:bg-green-100'
                            }`}
                            title={presentacion.activo ? 'Desactivar' : 'Activar'}
                          >
                            <Power className="h-4 w-4" />
                          </button>
                          
                          {/* Botón eliminar */}
                          {/* <button
                            onClick={() => eliminarPresentacion(presentacion.id)}
                            className="p-2 rounded hover:bg-red-100 text-red-600"
                            title="Eliminar presentación"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button> */}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal de edición */}
      {modalOpen && modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg p-6 m-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-[#038C65]">
                Editar Presentación: {modalData.nombre}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nombre */}
              <div>
                <label className="block font-medium mb-2">
                  Nombre 
                  <button 
                    type="button" 
                    onClick={() => mostrarAyuda('nombre')}
                    className="ml-2 text-sm bg-[#0EA5A5] text-white px-2 py-1 rounded"
                  >
                    ?
                  </button>
                </label>
                <input
                  type="text"
                  value={modalForm.nombre}
                  onChange={(e) => setModalForm(prev => ({ ...prev, nombre: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2"
                  placeholder="Nombre de la presentación"
                />
              </div>

              {/* Unidad */}
              <div>
                <label className="block font-medium mb-2">
                  Unidad 
                  <button 
                    type="button" 
                    onClick={() => mostrarAyuda('unidad')}
                    className="ml-2 text-sm bg-[#0EA5A5] text-white px-2 py-1 rounded"
                  >
                    ?
                  </button>
                </label>
                <select
                  value={modalForm.unidad}
                  onChange={(e) => setModalForm(prev => ({ ...prev, unidad: e.target.value as 'kg' | 'bulto' | 'pieza' }))}
                  className="w-full rounded-xl border px-3 py-2"
                >
                  <option value="kg">Kilogramo</option>
                  <option value="bulto">Bulto</option>
                  <option value="pieza">Pieza</option>
                </select>
              </div>

              {/* Factor a base */}
              <div>
                <label className="block font-medium mb-2">
                  Factor a base 
                  <button 
                    type="button" 
                    onClick={() => mostrarAyuda('factor')}
                    className="ml-2 text-sm bg-[#0EA5A5] text-white px-2 py-1 rounded"
                  >
                    ?
                  </button>
                </label>
                <input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={modalForm.factor_a_base}
                  onChange={(e) => setModalForm(prev => ({ ...prev, factor_a_base: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2"
                  placeholder="Factor de conversión"
                />
              </div>

              {/* Precio unitario */}
              <div>
                <label className="block font-medium mb-2">
                  Precio unitario 
                  <button 
                    type="button" 
                    onClick={() => mostrarAyuda('precio')}
                    className="ml-2 text-sm bg-[#0EA5A5] text-white px-2 py-1 rounded"
                  >
                    ?
                  </button>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={modalForm.precio_unitario}
                  onChange={(e) => setModalForm(prev => ({ ...prev, precio_unitario: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2"
                  placeholder="Precio de venta"
                />
              </div>

              {/* Código de barras */}
              <div className="md:col-span-2">
                <label className="block font-medium mb-2">
                  Código de barras 
                  <button 
                    type="button" 
                    onClick={() => mostrarAyuda('codigo')}
                    className="ml-2 text-sm bg-[#0EA5A5] text-white px-2 py-1 rounded"
                  >
                    ?
                  </button>
                </label>
                <input
                  type="text"
                  value={modalForm.codigo_barras}
                  onChange={(e) => setModalForm(prev => ({ ...prev, codigo_barras: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2"
                  placeholder="Código de barras (opcional)"
                />
              </div>

              {/* Presentación por defecto */}
              <div className="md:col-span-2 flex items-center gap-3">
                <input
                  id="es_default"
                  type="checkbox"
                  checked={modalForm.es_default}
                  onChange={(e) => setModalForm(prev => ({ ...prev, es_default: e.target.checked }))}
                />
                <label htmlFor="es_default" className="font-medium">
                  Marcar como presentación por defecto 
                  <button 
                    type="button" 
                    onClick={() => mostrarAyuda('default')}
                    className="ml-2 text-sm bg-[#0EA5A5] text-white px-2 py-1 rounded"
                  >
                    ?
                  </button>
                </label>
              </div>
            </div>

            {/* Botones del modal */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setModalOpen(false)}
                disabled={modalLoading}
                className="px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={guardarPresentacion}
                disabled={modalLoading}
                className="px-4 py-2 rounded-xl bg-[#038C65] text-white hover:bg-[#027857] disabled:opacity-60"
              >
                {modalLoading ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
