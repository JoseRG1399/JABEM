"use client";

import React, { useEffect, useMemo, useState } from "react";
import Swal from 'sweetalert2';
import apiFetch from '../lib/api';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

type Fila = {
  productoId?: number | string;
  nombre: string;
  cantidad: number;
  precioVenta: number;
  descuentoPorcentaje: number;
  precioFinal: number;
  costo: number;
  ganancia: number;
  margenPorcentaje: number;
};

type ResumenDescuentos = {
  totalSinDescuento: number;
  totalConDescuento: number;
  diferenciaDinero: number;
  perdidaMargenPorcentaje: number;
};

type ResDia = { 
  filas: Fila[];
  resumenDescuentos: ResumenDescuentos;
};

export default function ReportesPage() {
  const [data, setData] = useState<ResDia>({ 
    filas: [], 
    resumenDescuentos: { 
      totalSinDescuento: 0,
      totalConDescuento: 0,
      diferenciaDinero: 0,
      perdidaMargenPorcentaje: 0
    }
  });
  const [loading, setLoading] = useState(false);
  const [currency, setCurrency] = useState("MXN");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // --- helpers ---
  function formatCurrency(amount: number) {
    try {
      return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(amount || 0);
    } catch {
      return `$${Number(amount || 0).toFixed(2)}`;
    }
  }
  function formatNumber(value: any) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "0.000";
    return n.toFixed(3);
  }

  // --- data fetching ---
  async function fetchVentasDia() {
    try {
      setLoading(true);
      const res = await apiFetch('/api/reportes/ventas-dia');
      if (!res.ok) throw new Error(res.error || 'Error al obtener ventas del día');
      setData({ 
        filas: Array.isArray(res.data?.filas) ? res.data?.filas : [],
        resumenDescuentos: res.data?.resumenDescuentos || {
          totalSinDescuento: 0,
          totalConDescuento: 0,
          diferenciaDinero: 0,
          perdidaMargenPorcentaje: 0
        }
      });
    } catch (err: any) {
      Swal.fire("Error", err?.message || "No se pudo obtener el reporte", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchVentasDia();
  }, []);

  // moneda desde configuración (solo una vez)
  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch('/api/config/configuracion');
        if (r.ok && r.data?.moneda) setCurrency(r.data.moneda);
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  // --- derivaciones memoizadas ---
  const filasOrdenadas = useMemo<Fila[]>(() => {
    const arr = [...(data.filas || [])];
    // aplicar filtro por nombre
    const filtered = search
      ? arr.filter((f) => (f.nombre || '').toLowerCase().includes(search.toLowerCase()))
      : arr;
    return filtered.sort((a, b) => Number(b.ganancia || 0) - Number(a.ganancia || 0));
  }, [data.filas, search]);

  const totalIngreso = useMemo(
    () => filasOrdenadas.reduce((s, f) => s + (f.precioFinal * f.cantidad), 0),
    [filasOrdenadas]
  );

  const totalCosto = useMemo(
    () => filasOrdenadas.reduce((s, f) => s + Number(f.costo || 0), 0),
    [filasOrdenadas]
  );

  const totalGanancia = useMemo(
    () => filasOrdenadas.reduce((s, f) => s + Number(f.ganancia || 0), 0),
    [filasOrdenadas]
  );

  const totalUnidades = useMemo(
    () => filasOrdenadas.reduce((s, f) => s + Number(f.cantidad || 0), 0),
    [filasOrdenadas]
  );

  const productosDistintos = useMemo(() => filasOrdenadas.length, [filasOrdenadas]);

  const topProducto = useMemo(() => filasOrdenadas[0]?.nombre || "—", [filasOrdenadas]);

  // Datos para la gráfica (Top 10 productos por ganancia neta)
  const topN = 10;
  const topFilas = useMemo(() => {
    // Ya están ordenadas por ganancia neta (filasOrdenadas se ordena por b.ganancia - a.ganancia)
    return filasOrdenadas.slice(0, topN);
  }, [filasOrdenadas]);

  const barData = useMemo(
    () => ({
      labels: topFilas.map((f) => f.nombre),
      datasets: [
        {
          label: "Total Ventas",
          data: topFilas.map((f) => Number(f.precioFinal * f.cantidad || 0)),
          backgroundColor: "rgba(147, 51, 234, 0.7)", // Púrpura para total ventas
          borderColor: "rgba(147, 51, 234, 1)",
          borderWidth: 1
        },
        {
          label: "Ganancia Neta",
          data: topFilas.map((f) => Number(f.ganancia || 0)),
          backgroundColor: "rgba(16, 185, 129, 0.7)", // Verde para ganancia neta
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 1
        }
      ]
    }),
    [topFilas]
  );

  const barOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { 
          display: true,
          position: 'top' as const,
          labels: {
            color: "#334155",
            font: {
              size: 12,
              weight: 'bold' as const
            }
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx: any) => {
              const val = Number(ctx.parsed.y || 0);
              return `${ctx.dataset.label}: ${formatCurrency(val)}`;
            }
          }
        }
      },
      scales: {
        x: { 
          ticks: { 
            color: "#334155",
            maxRotation: 45,
            minRotation: 0
          }
        },
        y: {
          ticks: {
            color: "#334155",
            callback: (v: any) => formatCurrency(Number(v))
          },
          beginAtZero: true
        }
      }
    }),
    [currency]
  );

  // --- exportar CSV ---
  function exportCSV() {
    const rows = [
      ["Producto", "Cantidad", "Precio Venta", "Descuento %", "Precio Final", "Costo", "Ganancia", "Margen %"],
      ...filasOrdenadas.map((f) => [
        f.nombre, 
        String(f.cantidad ?? 0), 
        String(f.precioVenta ?? 0),
        String(f.descuentoPorcentaje ?? 0),
        String(f.precioFinal ?? 0),
        String(f.costo ?? 0),
        String(f.ganancia ?? 0),
        String(f.margenPorcentaje ?? 0)
      ])
    ];
    const csv = rows
      .map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, "0");
    const dd = String(hoy.getDate()).padStart(2, "0");
    a.href = url;
    a.download = `ventas_dia_${yyyy}-${mm}-${dd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- imprimir ---
  // Imprime un ticket de 80mm con desglose de ventas (producto, cantidad, total) y total general
  async function imprimir() {
    try {
      // Intentar obtener datos de la empresa para el encabezado
      let empresa: any = null;
      try {
        const r = await apiFetch('/api/config/configuracion');
        if (r.ok) empresa = r.data;
      } catch (e) {
        empresa = null;
      }

      const fecha = new Date();
      const fechaStr = fecha.toLocaleString();

      // Escape simple para HTML
      const escapeHtml = (unsafe: any) => {
        if (unsafe === null || unsafe === undefined) return '';
        return String(unsafe)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      };

      // Filas a imprimir (usamos filasOrdenadas)
      const filas = filasOrdenadas.map((f) => ({
        nombre: escapeHtml(f.nombre || ''),
        cantidad: formatNumber(f.cantidad ?? 0),
        total: formatCurrency(Number(f.precioFinal * f.cantidad || 0))
      }));

      const totalGeneral = formatCurrency(totalIngreso);

      // Crear HTML del ticket 80mm
      const htmlRows = filas
        .map(
          (r) =>
            `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;line-height:1.1;"><div style="flex:1">${r.nombre}</div><div style="min-width:60px;text-align:right">${r.cantidad}</div><div style="min-width:80px;text-align:right;margin-left:8px">${r.total}</div></div>`
        )
        .join('');

  const softwareName = 'JABEM';
  const storeNameHtml = empresa?.nombre_empresa ? `<div style="font-size:13px;font-weight:700;margin-top:4px">${escapeHtml(empresa.nombre_empresa)}</div>` : '';
  const empLinea2 = empresa?.direccion ? `<div style="font-size:11px;margin-top:4px">${escapeHtml(empresa.direccion)}</div>` : '';
  const titleReport = 'Reporte de Ventas del Día';
  const empContacto = empresa?.telefono ? `<div style="font-size:11px;margin-top:2px">Tel: ${escapeHtml(empresa.telefono)}</div>` : '';
  const totalGananciaStr = formatCurrency(totalGanancia);
  const headerRow = `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;line-height:1.1;font-weight:700"><div style="flex:1">Producto</div><div style="min-width:60px;text-align:right">Cant.</div><div style="min-width:80px;text-align:right;margin-left:8px">Total</div></div><div class="divider"></div>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Ticket</title><style>@page{size:80mm auto;margin:5mm}body{font-family:monospace;font-size:12px;width:80mm;padding:6mm;margin:0} .center{text-align:center} .divider{border-top:1px dashed #000;margin:6px 0}</style></head><body><div class="center" style="font-weight:700;font-size:14px">${softwareName}</div>${storeNameHtml}${empLinea2}${empContacto} ${titleReport}<div class="center" style="font-size:11px;margin-top:6px">Fecha y hora: ${fechaStr}</div><div class="divider"></div>${headerRow}${htmlRows}<div class="divider"></div><div style="display:flex;justify-content:space-between;padding-top:6px;font-size:13px;font-weight:700"><div>Total</div><div style="min-width:80px;text-align:right">${totalGeneral}</div></div><div style="display:flex;justify-content:space-between;padding-top:4px;font-size:12px;font-weight:700"><div>Total ganancia</div><div style="min-width:80px;text-align:right">${totalGananciaStr}</div></div></body></html>`;

      const w = window.open('', '_blank', 'toolbar=0,location=0,menubar=0');
      if (!w) {
        Swal.fire('Error', 'No se pudo abrir la ventana de impresión. Revisa bloqueadores de ventanas emergentes.', 'error');
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => {
        try {
          w.print();
        } catch (e) {
          console.error(e);
        }
      }, 600);
    } catch (err: any) {
      Swal.fire('Error', err?.message || 'Error al generar ticket', 'error');
    }
  }

  return (
    <div className="min-h-screen bg-[#091B26] p-6">
      <button
        onClick={() => (window.location.href = "/menuPrincipal")}
        className="mb-4 px-4 py-2 rounded-xl bg-[#038C65] text-white font-semibold shadow hover:bg-[#027857]"
      >
        ← Volver al menú principal
      </button>

      <div className="max-w-full mx-auto bg-white rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold text-[#038C65]">Reportes - Ventas del día</h2>
          <div className="flex gap-2">
            <button
              onClick={() => (window.location.href = "/reportes/historico")}
              className="px-3 py-2 rounded bg-[#0EA5A5] text-white"
            >
              Histórico por fechas
            </button>
            <button onClick={fetchVentasDia} className="px-3 py-2 rounded bg-gray-100">
              Actualizar
            </button>
            {/* <button
              onClick={exportCSV}
              disabled={!filasOrdenadas.length}
              className="px-3 py-2 rounded bg-[#038C65] text-white disabled:opacity-50"
            >
              Exportar CSV
            </button> */}
            <button
              onClick={imprimir}
              disabled={!filasOrdenadas.length}
              className="px-3 py-2 rounded bg-gray-100 disabled:opacity-50"
            >
              Imprimir
            </button>
          </div>
        </div>

  {/* KPIs */}
          {/* KPIs Principales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-[#F2F0EB]">
              <div className="text-sm text-gray-500 flex items-center">
                Ingreso del día
                <button 
                  onClick={() => Swal.fire('Info', 'Total de dinero recibido después de aplicar descuentos', 'info')}
                  className="ml-1 text-xs bg-gray-300 rounded-full w-4 h-4 flex items-center justify-center"
                >?</button>
              </div>
              <div className="text-xl font-semibold">{formatCurrency(totalIngreso)}</div>
            </div>
            <div className="p-4 rounded-lg bg-[#F2F0EB]">
              <div className="text-sm text-gray-500 flex items-center">
                Unidades vendidas
                <button 
                  onClick={() => Swal.fire('Info', 'Total de productos vendidos en el día', 'info')}
                  className="ml-1 text-xs bg-gray-300 rounded-full w-4 h-4 flex items-center justify-center"
                >?</button>
              </div>
              <div className="text-xl font-semibold">{formatNumber(totalUnidades)}</div>
            </div>
            <div className="p-4 rounded-lg bg-[#F2F0EB]">
              <div className="text-sm text-gray-500 flex items-center">
                Inversión (costo)
                <button 
                  onClick={() => Swal.fire('Info', 'Total invertido en la compra de los productos vendidos', 'info')}
                  className="ml-1 text-xs bg-gray-300 rounded-full w-4 h-4 flex items-center justify-center"
                >?</button>
              </div>
              <div className="text-xl font-semibold">{formatCurrency(totalCosto)}</div>
            </div>
            <div className="p-4 rounded-lg bg-[#F2F0EB]">
              <div className="text-sm text-gray-500 flex items-center">
                Ganancia neta
                <button 
                  onClick={() => Swal.fire('Info', 'Ganancia después de descontar costos e incluir descuentos aplicados', 'info')}
                  className="ml-1 text-xs bg-gray-300 rounded-full w-4 h-4 flex items-center justify-center"
                >?</button>
              </div>
              <div className="text-xl font-semibold">{formatCurrency(totalGanancia)}</div>
            </div>
          </div>

          {/* Tabla de descuentos */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3">Resumen de Descuentos</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border rounded-lg">
                <thead className="bg-[#F2F0EB]">
                  <tr>
                    <th className="px-4 py-2 text-left flex items-center">
                      Total ventas sin descuento
                      <button 
                        onClick={() => Swal.fire('Info', 'Valor total de las ventas antes de aplicar cualquier descuento', 'info')}
                        className="ml-1 text-xs bg-gray-300 rounded-full w-4 h-4 flex items-center justify-center"
                      >?</button>
                    </th>
                    <th className="px-4 py-2 text-left">
                      <div className="flex items-center">
                        Total ventas con descuento
                        <button 
                          onClick={() => Swal.fire('Info', 'Valor total de las ventas después de aplicar descuentos', 'info')}
                          className="ml-1 text-xs bg-gray-300 rounded-full w-4 h-4 flex items-center justify-center"
                        >?</button>
                      </div>
                    </th>
                    <th className="px-4 py-2 text-left">
                      <div className="flex items-center">
                        Diferencia ($)
                        <button 
                          onClick={() => Swal.fire('Info', 'Dinero que se dejó de recibir por los descuentos aplicados', 'info')}
                          className="ml-1 text-xs bg-gray-300 rounded-full w-4 h-4 flex items-center justify-center"
                        >?</button>
                      </div>
                    </th>
                    <th className="px-4 py-2 text-left">
                      <div className="flex items-center">
                        Pérdida de margen (%)
                        <button 
                          onClick={() => Swal.fire('Info', 'Porcentaje de ingresos perdidos por descuentos. Ayuda a evaluar el impacto de las promociones', 'info')}
                          className="ml-1 text-xs bg-gray-300 rounded-full w-4 h-4 flex items-center justify-center"
                        >?</button>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-2 font-semibold">{formatCurrency(data.resumenDescuentos.totalSinDescuento)}</td>
                    <td className="px-4 py-2 font-semibold">{formatCurrency(data.resumenDescuentos.totalConDescuento)}</td>
                    <td className="px-4 py-2 font-semibold text-red-600">{formatCurrency(data.resumenDescuentos.diferenciaDinero)}</td>
                    <td className="px-4 py-2 font-semibold text-red-600">{data.resumenDescuentos.perdidaMargenPorcentaje.toFixed(2)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>        <div className="mb-4 flex items-center gap-3">
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar producto..." className="rounded border px-3 py-2 w-full max-w-sm" />
          <div className="text-sm text-gray-500">Resultados: {filasOrdenadas.length}</div>
        </div>

        {loading ? (
          <div>Cargando...</div>
        ) : (
          <div className="space-y-6">
            {/* Tabla por producto - Ancho completo */}
            <div className="w-full">
              <h3 className="font-semibold mb-4 text-lg">Ventas por producto (hoy)</h3>
              <div className="overflow-x-auto bg-white rounded-lg shadow border">
                <table className="w-full table-auto">
                  <thead className="bg-[#F2F0EB]">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">
                        <div className="flex items-center">
                          Producto
                          <button 
                            onClick={() => Swal.fire('Info', 'Nombre del producto vendido', 'info')}
                            className="ml-2 text-xs bg-gray-300 rounded-full w-4 h-4 flex items-center justify-center hover:bg-gray-400 transition-colors"
                          >?</button>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-center font-semibold">
                        <div className="flex items-center justify-center">
                          Cantidad
                          <button 
                            onClick={() => Swal.fire('Info', 'Cantidad total de unidades vendidas de este producto', 'info')}
                            className="ml-2 text-xs bg-gray-300 rounded-full w-4 h-4 flex items-center justify-center hover:bg-gray-400 transition-colors"
                          >?</button>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        <div className="flex items-center justify-end">
                          Precio Venta
                          <button 
                            onClick={() => Swal.fire('Info', 'Precio unitario antes de aplicar descuentos', 'info')}
                            className="ml-2 text-xs bg-gray-300 rounded-full w-4 h-4 flex items-center justify-center hover:bg-gray-400 transition-colors"
                          >?</button>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        <div className="flex items-center justify-end">
                          Descuento %
                          <button 
                            onClick={() => Swal.fire('Info', 'Porcentaje de descuento promedio aplicado a este producto', 'info')}
                            className="ml-2 text-xs bg-gray-300 rounded-full w-4 h-4 flex items-center justify-center hover:bg-gray-400 transition-colors"
                          >?</button>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        <div className="flex items-center justify-end">
                          Precio Final
                          <button 
                            onClick={() => Swal.fire('Info', 'Precio unitario después de aplicar descuentos', 'info')}
                            className="ml-2 text-xs bg-gray-300 rounded-full w-4 h-4 flex items-center justify-center hover:bg-gray-400 transition-colors"
                          >?</button>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        <div className="flex items-center justify-end">
                          Total Venta
                          <button 
                            onClick={() => Swal.fire('Info', 'Total de dinero recibido: Precio Final × Cantidad', 'info')}
                            className="ml-2 text-xs bg-gray-300 rounded-full w-4 h-4 flex items-center justify-center hover:bg-gray-400 transition-colors"
                          >?</button>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        <div className="flex items-center justify-end">
                          Costo Total
                          <button 
                            onClick={() => Swal.fire('Info', 'Costo total de compra del inventario vendido', 'info')}
                            className="ml-2 text-xs bg-gray-300 rounded-full w-4 h-4 flex items-center justify-center hover:bg-gray-400 transition-colors"
                          >?</button>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        <div className="flex items-center justify-end">
                          Ganancia
                          <button 
                            onClick={() => Swal.fire('Info', 'Ganancia total: Total Venta - Costo Total', 'info')}
                            className="ml-2 text-xs bg-gray-300 rounded-full w-4 h-4 flex items-center justify-center hover:bg-gray-400 transition-colors"
                          >?</button>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        <div className="flex items-center justify-end">
                          Margen %
                          <button 
                            onClick={() => Swal.fire('Info', 'Porcentaje de ganancia sobre las ventas: (Ganancia ÷ Total Venta) × 100', 'info')}
                            className="ml-2 text-xs bg-gray-300 rounded-full w-4 h-4 flex items-center justify-center hover:bg-gray-400 transition-colors"
                          >?</button>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasOrdenadas.length ? (
                      (() => {
                        const start = (page - 1) * ITEMS_PER_PAGE;
                        const end = start + ITEMS_PER_PAGE;
                        return filasOrdenadas.slice(start, end).map((f, idx) => (
                          <tr key={(f.productoId ?? `row-${start + idx}`) as React.Key} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-medium">{f.nombre}</td>
                            <td className="px-4 py-3 text-center font-semibold text-blue-600">{formatNumber(f.cantidad || 0)}</td>
                            <td className="px-4 py-3 text-right">{formatCurrency(Number(f.precioVenta || 0))}</td>
                            <td className="px-4 py-3 text-right text-orange-600 font-semibold">{f.descuentoPorcentaje.toFixed(1)}%</td>
                            <td className="px-4 py-3 text-right font-semibold">{formatCurrency(Number(f.precioFinal || 0))}</td>
                            <td className="px-4 py-3 text-right font-semibold text-purple-600">{formatCurrency(Number(f.precioFinal * f.cantidad || 0))}</td>
                            <td className="px-4 py-3 text-right text-red-600">{formatCurrency(Number(f.costo || 0))}</td>
                            <td className="px-4 py-3 text-right text-green-600 font-semibold">{formatCurrency(Number(f.ganancia || 0))}</td>
                            <td className="px-4 py-3 text-right font-semibold">{f.margenPorcentaje.toFixed(1)}%</td>
                          </tr>
                        ));
                      })()
                    ) : (
                      <tr>
                        <td colSpan={9} className="p-8 text-gray-500 text-center">
                          No hay ventas hoy
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              {filasOrdenadas.length > ITEMS_PER_PAGE && (
                <div className="mt-4 flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
                  <div className="text-sm text-gray-600">Página {page} de {Math.max(1, Math.ceil(filasOrdenadas.length / ITEMS_PER_PAGE))}</div>
                  <div className="flex gap-2">
                    <button 
                      disabled={page <= 1} 
                      onClick={() => setPage((p) => Math.max(1, p - 1))} 
                      className="px-4 py-2 rounded bg-white border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Anterior
                    </button>
                    <button 
                      disabled={page >= Math.ceil(filasOrdenadas.length / ITEMS_PER_PAGE)} 
                      onClick={() => setPage((p) => Math.min(Math.ceil(filasOrdenadas.length / ITEMS_PER_PAGE), p + 1))} 
                      className="px-4 py-2 rounded bg-white border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Gráfica Top 10 por ganancia neta */}
            <div className="w-full lg:w-2/3 mx-auto">
              <h3 className="font-semibold mb-4 text-lg text-center">Top {topN} productos por ganancia neta</h3>
              <div className="bg-white rounded-lg shadow border p-4">
                <div style={{ height: 400 }}>
                  <Bar data={barData} options={barOptions as any} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
