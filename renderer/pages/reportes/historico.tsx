"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, ChartOptions } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import Swal from 'sweetalert2';

ChartJS.register(ArcElement, Tooltip, Legend);

type ByDay = { fecha: string; cantidad: number; total: number };
type ByProduct = { productoId?: number; nombre: string; cantidad: number; total: number };

export default function HistoricoPage() {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [data, setData] = useState<{ byDay: ByDay[]; byProduct: ByProduct[] }>({ byDay: [], byProduct: [] });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [activeRange, setActiveRange] = useState<string>('');
  const [currency, setCurrency] = useState('MXN');

  const chartRef = useRef<any>(null);

  function formatCurrency(amount: number) {
    try {
      return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(amount);
    } catch {
      return `$${Number(amount || 0).toFixed(2)}`;
    }
  }

  // Formatea números a 3 decimales
  function formatNumber(value: any) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0.000';
    return n.toFixed(3);
  }

  async function fetchHistorico() {
    if (!start || !end) return Swal.fire('Error', 'Selecciona rango de fechas', 'error');
    try {
      setLoading(true);
      const res = await fetch(`/api/reportes/ventas-historico?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Error al obtener histórico');
      setData({ byDay: payload.byDay ?? [], byProduct: payload.byProduct ?? [] });
    } catch (err: any) {
      Swal.fire('Error', err?.message || 'No se pudo obtener histórico', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function fetchHistoricoRange(startStr: string, endStr: string) {
    try {
      setLoading(true);
      const res = await fetch(`/api/reportes/ventas-historico?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Error al obtener histórico');
      setData({ byDay: payload.byDay ?? [], byProduct: payload.byProduct ?? [] });
      setStart(startStr); setEnd(endStr);
    } catch (err: any) {
      Swal.fire('Error', err?.message || 'No se pudo obtener histórico', 'error');
    } finally { setLoading(false); }
  }

  function formatDateISO(d: Date) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function rangeToday() {
    const today = new Date();
    const s = formatDateISO(today);
    fetchHistoricoRange(s, s);
    setActiveRange('today');
  }

  function rangeLastDays(days: number) {
    const endD = new Date();
    const startD = new Date();
    startD.setDate(endD.getDate() - (days - 1));
    fetchHistoricoRange(formatDateISO(startD), formatDateISO(endD));
    setActiveRange(String(days));
  }

  // 1) Carga configuración SOLO una vez
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/config/configuracion');
        if (r.ok) {
          const cfg = await r.json();
          if (cfg?.moneda) setCurrency(cfg.moneda);
        }
      } catch {}
    })();
  }, []);

  // 2) Inicializa / actualiza gráfica cuando cambie data.byProduct
  // Preparar datos para la gráfica (react-chartjs-2)
  const pieData = React.useMemo(() => {
    const products = Array.isArray(data.byProduct) ? [...data.byProduct] : [];
    products.sort((a, b) => (b.cantidad || 0) - (a.cantidad || 0));
    const TOP_N = 10;
    const top = products.slice(0, TOP_N);
    const resto = products.slice(TOP_N);
    const otherTotal = resto.reduce((s, r) => s + Number(r.cantidad || 0), 0);

    const labels = top.map((p) => p.nombre);
    const values = top.map((p) => Number(p.cantidad || 0));
    if (otherTotal > 0) { labels.push('Otros'); values.push(otherTotal); }

    const palette = ['#0EA5A5','#0369A1','#0F1724','#065F46','#7C3AED','#B91C1C','#F59E0B','#10B981','#06B6D4','#EF4444','#64748B'];
    const backgroundColors = labels.map((_, i) => palette[i % palette.length]);

    return { labels, datasets: [{ label: 'Cantidad vendida', data: values, backgroundColor: backgroundColors }] };
  }, [data.byProduct]);

  const pieOptions: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.label || '';
            const value = Number(context.parsed || 0);
            const dataArr = context.chart.data.datasets[0].data as number[];
            const total = dataArr.reduce((s, v) => s + Number(v || 0), 0);
            const pct = total ? ((value / total) * 100) : 0;

            let monetario = 0;
            if (label !== 'Otros') {
              const prod = (data.byProduct || []).find((p) => p.nombre === label);
              monetario = prod ? Number(prod.total || 0) : 0;
            }
            return `${label}: ${formatNumber(value)} (${pct.toFixed(1)}%) — ${formatCurrency(monetario)}`;
          }
        }
      },
      legend: {
        labels: {
          // react-chartjs-2 / chart.js will use this to show legend text
          generateLabels: (chart: any) => {
            const ds = chart.data.datasets[0];
            const total = (ds.data || []).reduce((s: number, v: any) => s + Number(v || 0), 0);
            return chart.data.labels.map((label: any, i: number) => {
              const value = Number(ds.data[i] || 0);
              const pct = total ? ((value / total) * 100) : 0;
              return { text: `${label} (${pct.toFixed(1)}%)`, fillStyle: ds.backgroundColor[i], hidden: false, index: i };
            });
          }
        }
      }
    }
  };

  // KPIs
  const totalUnidades = data.byProduct.reduce((s, p) => s + (p.cantidad || 0), 0);
  const totalIngreso = data.byProduct.reduce((s, p) => s + (p.total || 0), 0);
  const numDias = data.byDay.length || 1;
  const ingresoPromedioDia = totalIngreso / numDias;

  // Exportación CSV
  function exportCSV() {
    const rows = [
      ['Tipo','Fecha/Producto','Cantidad','Total'],
      ...data.byDay.map(d => ['DIA', d.fecha, String(d.cantidad), String(d.total)]),
      ...data.byProduct.map(p => ['PRODUCTO', p.nombre, String(p.cantidad), String(p.total)])
    ];
    const csv = rows.map(r => r.map(x => `"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `reporte_${start}_a_${end}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-[#091B26] p-6">
      <button
        onClick={() => (window.location.href = "/reportes")}
        className="mb-4 px-4 py-2 rounded-xl bg-[#038C65] text-white font-semibold shadow hover:bg-[#027857]"
      >
        ← Volver
      </button>

      <div className="max-w-6xl mx-auto bg-white rounded-xl p-6">
        <h2 className="text-xl font-bold text-[#038C65] mb-2">Reportes - Histórico de ventas por fechas</h2>
        <p className="mb-4 text-gray-700">Selecciona las fechas y consulta. También puedes usar “Hoy” o “Últimos 7/30 días”.</p>

        <div className="flex items-end flex-wrap gap-4 mb-6">
          <div className="flex flex-col">
            <label className="text-sm text-gray-600 mb-1">Fecha inicio</label>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="rounded border px-3 py-2" />
          </div>
          <div className="flex flex-col">
            <label className="text-sm text-gray-600 mb-1">Fecha fin</label>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded border px-3 py-2" />
          </div>
          <button onClick={fetchHistorico} className="px-3 py-2 rounded bg-[#0EA5A5] text-white">Consultar</button>

          <div className="flex items-center gap-2">
            <button onClick={rangeToday} className={`px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 ${activeRange === 'today' ? 'ring-2 ring-[#0EA5A5] border-2 border-[#0EA5A5]' : ''}`}>Hoy</button>
            <button onClick={() => rangeLastDays(7)} className={`px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 ${activeRange === '7' ? 'ring-2 ring-[#0EA5A5] border-2 border-[#0EA5A5]' : ''}`}>Últimos 7 días</button>
            <button onClick={() => rangeLastDays(30)} className={`px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 ${activeRange === '30' ? 'ring-2 ring-[#0EA5A5] border-2 border-[#0EA5A5]' : ''}`}>Últimos 30 días</button>
          </div>

          <button onClick={() => { setStart(''); setEnd(''); setActiveRange(''); setData({ byDay: [], byProduct: [] }); }} className="px-3 py-2 rounded bg-gray-100">Limpiar</button>
          {/* <button onClick={exportCSV} disabled={!data.byDay.length && !data.byProduct.length} className="px-3 py-2 rounded bg-[#038C65] text-white disabled:opacity-50">Exportar CSV</button> */}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-[#F2F0EB]">
            <div className="text-sm text-gray-500">Ingresos</div>
            <div className="text-xl font-semibold">{formatCurrency(totalIngreso)}</div>
          </div>
          <div className="p-4 rounded-lg bg-[#F2F0EB]">
            <div className="text-sm text-gray-500">Unidades</div>
            <div className="text-xl font-semibold">{totalUnidades}</div>
          </div>
          <div className="p-4 rounded-lg bg-[#F2F0EB]">
            <div className="text-sm text-gray-500">Días</div>
            <div className="text-xl font-semibold">{numDias}</div>
          </div>
          <div className="p-4 rounded-lg bg-[#F2F0EB]">
            <div className="text-sm text-gray-500">Promedio/día</div>
            <div className="text-xl font-semibold">{formatCurrency(ingresoPromedioDia)}</div>
          </div>
        </div>

        {loading ? <div>Cargando...</div> : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">Distribución por cantidad vendida (por producto)</h3>
              <div style={{ height: 320 }}>
                <Pie ref={chartRef} data={pieData} options={pieOptions} />
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Ventas por producto</h3>
              <div className="overflow-auto max-h-80">
                <table className="min-w-full">
                  <thead className="bg-[#F2F0EB]">
                    <tr>
                      <th className="px-3 py-2 text-left">Producto</th>
                      <th className="px-3 py-2 text-right">Cantidad</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byProduct.length ? (
                      (() => {
                        const totalItems = data.byProduct.length;
                        const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
                        const currentPage = Math.min(Math.max(1, page), totalPages);
                        const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
                        const endIdx = startIdx + ITEMS_PER_PAGE;
                        const pageSlice = data.byProduct.slice(startIdx, endIdx);
                        return (
                          <>
                            {pageSlice.map((p, idx) => (
                              <tr key={(p.productoId ?? 0) || `p-${startIdx + idx}`}>
                                <td className="px-3 py-2">{p.nombre}</td>
                                <td className="px-3 py-2 text-right">{formatNumber(p.cantidad ?? 0)}</td>
                                <td className="px-3 py-2 text-right">{formatCurrency(Number(p.total || 0))}</td>
                              </tr>
                            ))}
                            {/* Pagination controls */}
                            <tr>
                              <td colSpan={3} className="px-3 py-2">
                                <div className="flex items-center justify-between">
                                  <div className="text-sm text-gray-600">Mostrando {startIdx + 1}–{Math.min(endIdx, totalItems)} de {totalItems}</div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                                      disabled={currentPage <= 1}
                                      className={`px-3 py-1 rounded ${currentPage <= 1 ? 'bg-gray-200 text-gray-500' : 'bg-[#0EA5A5] text-white'}`}
                                    >Anterior</button>
                                    <div className="text-sm">Página {currentPage} / {totalPages}</div>
                                    <button
                                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                      disabled={currentPage >= totalPages}
                                      className={`px-3 py-1 rounded ${currentPage >= totalPages ? 'bg-gray-200 text-gray-500' : 'bg-[#0EA5A5] text-white'}`}
                                    >Siguiente</button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          </>
                        );
                      })()
                    ) : <tr><td colSpan={3} className="p-4 text-gray-500">No hay datos</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:col-span-2">
              <h3 className="font-semibold mb-2">Ventas por día</h3>
              <div className="overflow-auto max-h-80">
                <table className="min-w-full">
                  <thead className="bg-[#F2F0EB]">
                    <tr>
                      <th className="px-3 py-2 text-left">Fecha</th>
                      <th className="px-3 py-2 text-right">Unidades</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byDay.length ? data.byDay.map((d) => (
                      <tr key={d.fecha}>
                        <td className="px-3 py-2">{d.fecha}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(d.cantidad ?? 0)}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(Number(d.total || 0))}</td>
                      </tr>
                    )) : <tr><td colSpan={3} className="p-4 text-gray-500">No hay datos</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
