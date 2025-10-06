"use client";

import React, { useEffect, useState } from 'react';
import apiFetch from '../lib/api';
import Swal from 'sweetalert2';
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

export default function InventarioPage() {
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const ITEMS_POR_PAGINA = 20;

  async function fetchProductos() {
    try {
      setLoading(true);
      const res = await apiFetch('/api/inventario/productos-listar');
      setProductos(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setProductos([]);
    } finally {
      setLoading(false);
    }
  }

  // Escapa texto para HTML
  function escapeHtml(unsafe: any) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  // Formatea números a 3 decimales (si no es número válido devuelve '0.000')
  function formatNumber(value: any) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0.000';
    return n.toFixed(3);
  }

  // Imprime un ticket de 80mm con listado de productos y sus stocks (arqueo)
  function imprimirArqueo() {
    try {
      // Usar filtrado en cliente si existe búsqueda, si no usar todos los productos
      const lista = productosFiltrados && productosFiltrados.length ? productosFiltrados : productos;
      if (!lista || lista.length === 0) {
        Swal.fire('Sin productos', 'No hay productos para imprimir en el arqueo.', 'info');
        return;
      }

      const fecha = new Date().toLocaleString();
      const rows = lista.map((p: any) => {
        const nombre = escapeHtml(p.nombre || '');
        const stockRaw = p.stock_actual ?? 0;
        const stock = escapeHtml(formatNumber(stockRaw));
        return `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px;"><div style="flex:1">${nombre}</div><div style="min-width:60px;text-align:right">${stock}</div></div>`;
      }).join('');

      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Arqueo</title><style>@page{size:80mm auto;margin:5mm}body{font-family:monospace;font-size:12px;width:80mm;padding:4mm;margin:0} .header{text-align:center;font-weight:700;margin-bottom:8px} .divider{border-top:1px dashed #000;margin:6px 0}</style></head><body><div class="header">JABEM - Arqueo de stock<br/><div style="font-weight:400;font-size:11px">${fecha}</div></div><div class="divider"></div>${rows}<div class="divider"></div><div style="text-align:center;margin-top:8px;font-size:11px">--- Fin del reporte ---</div></body></html>`;

      const w = window.open('', '_blank', 'toolbar=0,location=0,menubar=0');
      if (!w) {
        Swal.fire('Error', 'No se pudo abrir la ventana de impresión. Revisa bloqueadores de ventanas emergentes.', 'error');
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      // Dar un pequeño retraso para que el contenido cargue antes de imprimir
      setTimeout(() => { try { w.print(); } catch (e) { console.error(e); } }, 500);

    } catch (err: any) {
      Swal.fire('Error', err?.message || 'Error al generar el arqueo', 'error');
    }
  }

  async function fetchMovimientos(productoId?: number) {
    try {
      const url = productoId ? `/api/inventario/movimientos-listar?producto_id=${productoId}` : '/api/inventario/movimientos-listar';
      const res = await apiFetch(url);
      setMovimientos(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setMovimientos([]);
    }
  }

  // Mostrar ultimos movimientos de un producto en un Swal
  async function verMovimientosProducto(productoId: number) {
    try {
  const res = await apiFetch(`/api/inventario/movimientos-listar?producto_id=${productoId}`);
  if (!res.ok) throw new Error(res.error || 'Error al obtener movimientos');
  const lista = Array.isArray(res.data) ? res.data : [];
      const html = lista.slice(0, 50).map((m: any) => `
        <div style="border-bottom:1px solid #eee;padding:6px 0;">
          <div style="font-weight:600">${m.producto?.nombre || ''} — ${m.tipo_movimiento}</div>
          <div style="font-size:12px;color:#666">${new Date(m.fecha).toLocaleString()} — Cantidad: ${m.cantidad_base}</div>
          <div style="font-size:12px;color:#444">${m.comentario || ''}</div>
        </div>
      `).join('');

      Swal.fire({
        title: 'Últimos movimientos',
        html: `<div style="max-height:400px;overflow:auto;text-align:left">${html || '<div>No hay movimientos</div>'}</div>`,
        width: 700
      });
    } catch (err: any) {
      Swal.fire('Error', err?.message || 'No se pudieron obtener movimientos', 'error');
    }
  }

  useEffect(() => { fetchProductos(); fetchMovimientos(); }, []);

  // filtrado y paginado en cliente
  const productosFiltrados = productos.filter(p => !busqueda || (p.nombre || '').toLowerCase().includes(busqueda.toLowerCase()));
  const totalPaginas = Math.max(1, Math.ceil(productosFiltrados.length / ITEMS_POR_PAGINA));
  const productosPagina = productosFiltrados.slice((pagina - 1) * ITEMS_POR_PAGINA, pagina * ITEMS_POR_PAGINA);

  function abrirAjuste(producto: any, tipo: 'entrada' | 'salida' | 'ajuste') {
    Swal.fire({
      title: `${tipo === 'ajuste' ? 'Ajuste' : tipo === 'entrada' ? 'Registrar entrada' : 'Registrar salida'} - ${producto.nombre}`,
      html: `
        <input id="swal-cantidad" type="number" class="swal2-input" placeholder="Cantidad (en unidades base)" />
        <input id="swal-comentario" class="swal2-input" placeholder="Comentario (opcional)" />
      `,
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      preConfirm: () => {
        const cantidad = (document.getElementById('swal-cantidad') as HTMLInputElement)?.value;
        const comentario = (document.getElementById('swal-comentario') as HTMLInputElement)?.value;
        if (!cantidad) Swal.showValidationMessage('La cantidad es obligatoria');
        return { cantidad, comentario };
      }
    }).then(async (result) => {
      if (!result.isConfirmed) return;
      const { cantidad, comentario } = result.value || {};
      try {
        const res = await apiFetch('/api/inventario/ajustar-stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ producto_id: producto.id, cantidad, tipo, razon: comentario })
        });
        if (!res.ok) throw new Error(res.error || 'Error al ajustar stock');
        Swal.fire('Listo', 'Stock actualizado', 'success');
        fetchProductos(); fetchMovimientos(producto.id);
      } catch (err: any) {
        Swal.fire('Error', err?.message || 'No se pudo ajustar el stock', 'error');
      }
    });
  }

  return (
    <div className="min-h-screen bg-[#091B26] p-6">
      <button
        onClick={() => window.location.href = "/menuPrincipal"}
        className="mb-4 px-4 py-2 rounded-xl bg-[#038C65] text-white font-semibold shadow hover:bg-[#027857]">
        ← Volver al menú principal
      </button>
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-xl p-6 shadow">
          <h2 className="text-xl font-bold text-[#038C65] mb-4">Productos y arqueo</h2>
          <div className="mb-4 flex items-center gap-3">
            <input value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }} placeholder="Buscar producto..." className="rounded border px-3 py-2 w-full" />
            <button onClick={() => { setBusqueda(''); setPagina(1); fetchProductos(); }} className="px-3 py-2 rounded bg-gray-100">Limpiar</button>
            <button onClick={() => imprimirArqueo()} className="px-3 py-2 rounded bg-[#0F1724] text-white">Imprimir</button>
          </div>

          {loading ? <div>Cargando productos...</div> : (
            <table className="min-w-full">
              <thead className="bg-[#F2F0EB]"><tr>
                <th className="px-3 py-2 text-center">Nombre</th>
                <th className="px-3 py-2 text-center">Stock</th>
                <th className="px-3 py-2 text-center">Unidad</th>
                <th className="px-3 py-2 text-center">Acciones</th></tr></thead>
              <tbody>
                {productosPagina.map(p => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">{p.nombre}</td>
                    <td className="px-3 py-2">{formatNumber(p.stock_actual ?? 0)}</td>
                    <td className="px-3 py-2">{p.unidad_base}</td>
                    <td className="px-3 py-2 flex gap-2">
                      <button onClick={() => abrirAjuste(p, 'entrada')} className="px-2 py-1 rounded bg-green-100 text-green-800 flex items-center gap-1"><ArrowUpCircle className="w-4 h-4"/> Entrada</button>
                      <button onClick={() => abrirAjuste(p, 'salida')} className="px-2 py-1 rounded bg-red-100 text-red-800 flex items-center gap-1"><ArrowDownCircle className="w-4 h-4"/> Salida</button>
                      <button onClick={() => abrirAjuste(p, 'ajuste')} className="px-2 py-1 rounded bg-gray-100 text-gray-800">Ajuste</button>
                      <button onClick={() => verMovimientosProducto(p.id)} className="px-2 py-1 rounded bg-blue-100 text-blue-800">Ver movimientos</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* paginación */}
          <div className="mt-3 flex items-center justify-between">
            <div className="text-sm text-gray-600">Página {pagina} de {totalPaginas} — {productosFiltrados.length} productos</div>
            <div className="flex gap-2">
              <button disabled={pagina <= 1} onClick={() => setPagina(p => Math.max(1, p - 1))} className="px-3 py-1 rounded bg-gray-100">Anterior</button>
              <button disabled={pagina >= totalPaginas} onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} className="px-3 py-1 rounded bg-gray-100">Siguiente</button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow">
          <h2 className="text-xl font-bold text-[#038C65] mb-4">Movimientos recientes</h2>
          <div className="space-y-3" style={{ maxHeight: 520, overflow: 'auto' }}>
            {movimientos.length === 0 ? <div className="text-gray-500">Sin movimientos</div> : movimientos.map(m => (
              <div key={m.id} className="border rounded p-3">
                <div className="text-sm font-medium">{m.producto?.nombre || 'Producto'}</div>
                <div className="text-xs text-gray-600">{new Date(m.fecha).toLocaleString()}</div>
                <div className="text-sm">Tipo: {m.tipo_movimiento} - Cantidad: {formatNumber(m.cantidad_base ?? 0)}</div>
                {m.comentario && <div className="text-xs text-gray-700">{m.comentario}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
