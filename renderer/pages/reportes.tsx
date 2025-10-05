"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
} from "chart.js";
import { Bar } from "react-chartjs-2";
import Swal from "sweetalert2";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

type Fila = {
  productoId?: number | string;
  nombre: string;
  cantidad: number;
  total: number;
};

type ResDia = { filas: Fila[] };

export default function ReportesPage() {
  const [data, setData] = useState<ResDia>({ filas: [] });
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
      const res = await fetch("/api/reportes/ventas-dia");
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Error al obtener ventas del día");
      setData({ filas: Array.isArray(payload.filas) ? payload.filas : [] });
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
    fetch("/api/config/configuracion")
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (cfg?.moneda) setCurrency(cfg.moneda);
      })
      .catch(() => {});
  }, []);

  // --- derivaciones memoizadas ---
  const filasOrdenadas = useMemo<Fila[]>(() => {
    const arr = [...(data.filas || [])];
    // aplicar filtro por nombre
    const filtered = search
      ? arr.filter((f) => (f.nombre || '').toLowerCase().includes(search.toLowerCase()))
      : arr;
    return filtered.sort((a, b) => Number(b.total || 0) - Number(a.total || 0));
  }, [data.filas, search]);

  const totalIngreso = useMemo(
    () => filasOrdenadas.reduce((s, f) => s + Number(f.total || 0), 0),
    [filasOrdenadas]
  );

  const totalUnidades = useMemo(
    () => filasOrdenadas.reduce((s, f) => s + Number(f.cantidad || 0), 0),
    [filasOrdenadas]
  );

  const productosDistintos = useMemo(() => filasOrdenadas.length, [filasOrdenadas]);

  const topProducto = useMemo(() => filasOrdenadas[0]?.nombre || "—", [filasOrdenadas]);

  // Datos para la gráfica (Top 10 productos por ingreso)
  const topN = 10;
  const topFilas = useMemo(() => filasOrdenadas.slice(0, topN), [filasOrdenadas]);

  const barData = useMemo(
    () => ({
      labels: topFilas.map((f) => f.nombre),
      datasets: [
        {
          label: "Total ventas (dinero)",
          data: topFilas.map((f) => Number(f.total || 0)),
          backgroundColor: "rgba(3,140,101,0.7)"
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
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: any) => {
              const val = Number(ctx.parsed.y || 0);
              return ` ${formatCurrency(val)}`;
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: "#334155" } },
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
      ["Producto", "Cantidad", "Total ($)"],
      ...filasOrdenadas.map((f) => [f.nombre, String(f.cantidad ?? 0), String(f.total ?? 0)])
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
        const r = await fetch('/api/config/configuracion');
        if (r.ok) empresa = await r.json();
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
        total: formatCurrency(Number(f.total || 0))
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
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Ticket</title><style>@page{size:80mm auto;margin:5mm}body{font-family:monospace;font-size:12px;width:80mm;padding:6mm;margin:0} .center{text-align:center} .divider{border-top:1px dashed #000;margin:6px 0}</style></head><body><div class="center" style="font-weight:700;font-size:14px">${softwareName}</div>${storeNameHtml}${empLinea2}${empContacto} ${titleReport}<div class="center" style="font-size:11px;margin-top:6px">Fecha y hora: ${fechaStr}</div><div class="divider"></div>${htmlRows}<div class="divider"></div><div style="display:flex;justify-content:space-between;padding-top:6px;font-size:13px;font-weight:700"><div>Total</div><div style="min-width:80px;text-align:right">${totalGeneral}</div></div></body></html>`;

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

      <div className="max-w-6xl mx-auto bg-white rounded-xl p-6">
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-[#F2F0EB]">
            <div className="text-sm text-gray-500">Ingreso del día</div>
            <div className="text-xl font-semibold">{formatCurrency(totalIngreso)}</div>
          </div>
          <div className="p-4 rounded-lg bg-[#F2F0EB]">
            <div className="text-sm text-gray-500">Unidades vendidas</div>
            <div className="text-xl font-semibold">{formatNumber(totalUnidades)}</div>
          </div>
          <div className="p-4 rounded-lg bg-[#F2F0EB]">
            <div className="text-sm text-gray-500">Productos distintos</div>
            <div className="text-xl font-semibold">{productosDistintos}</div>
          </div>
          <div className="p-4 rounded-lg bg-[#F2F0EB]">
            <div className="text-sm text-gray-500">Top producto</div>
            <div className="text-xl font-semibold truncate" title={topProducto}>
              {topProducto}
            </div>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar producto..." className="rounded border px-3 py-2 w-full max-w-sm" />
          <div className="text-sm text-gray-500">Resultados: {filasOrdenadas.length}</div>
        </div>

        {loading ? (
          <div>Cargando...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tabla por producto */}
            <div>
              <h3 className="font-semibold mb-2">Ventas por producto (hoy)</h3>
              <div className="overflow-auto max-h-[360px]">
                <table className="min-w-full">
                  <thead className="bg-[#F2F0EB]">
                    <tr>
                      <th className="px-3 py-2 text-left">Producto</th>
                      <th className="px-3 py-2 text-right">Cantidad</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasOrdenadas.length ? (
                      (() => {
                        const start = (page - 1) * ITEMS_PER_PAGE;
                        const end = start + ITEMS_PER_PAGE;
                        return filasOrdenadas.slice(start, end).map((f, idx) => (
                          <tr key={(f.productoId ?? `row-${start + idx}`) as React.Key} className="border-b">
                            <td className="px-3 py-2">{f.nombre}</td>
                            <td className="px-3 py-2 text-right">{formatNumber(f.cantidad ?? 0)}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(Number(f.total || 0))}</td>
                          </tr>
                        ));
                      })()
                    ) : (
                      <tr>
                        <td colSpan={3} className="p-4 text-gray-500">
                          No hay ventas hoy
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              {filasOrdenadas.length > ITEMS_PER_PAGE && (
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-sm text-gray-600">Página {page} de {Math.max(1, Math.ceil(filasOrdenadas.length / ITEMS_PER_PAGE))}</div>
                  <div className="flex gap-2">
                    <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1 rounded bg-gray-100">Anterior</button>
                    <button disabled={page >= Math.ceil(filasOrdenadas.length / ITEMS_PER_PAGE)} onClick={() => setPage((p) => Math.min(Math.ceil(filasOrdenadas.length / ITEMS_PER_PAGE), p + 1))} className="px-3 py-1 rounded bg-gray-100">Siguiente</button>
                  </div>
                </div>
              )}
            </div>

            {/* Gráfica Top 10 por ingreso */}
            <div>
              <h3 className="font-semibold mb-2">Top {topN} productos por ingreso</h3>
              <div style={{ height: 360 }}>
                <Bar data={barData} options={barOptions as any} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
