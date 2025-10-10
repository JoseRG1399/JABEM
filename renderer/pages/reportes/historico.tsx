"use client";

import React, { useState, useRef, useEffect } from 'react';
import apiFetch from '../../lib/api';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, ChartOptions } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import Swal from 'sweetalert2';

ChartJS.register(ArcElement, Tooltip, Legend);

type ByDay = { 
  fecha: string; 
  cantidad: number; 
  total: number;
  totalSinDescuento?: number;
  gananciaTotal?: number;
  margenPorcentaje?: number;
  descuentoPromedio?: number;
  costoTotal?: number;
};
type ByProduct = { 
  productoId?: number; 
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

export default function HistoricoPage() {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [data, setData] = useState<{ byDay: ByDay[]; byProduct: ByProduct[]; resumenDescuentos?: ResumenDescuentos }>({ byDay: [], byProduct: [] });
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
      const res = await apiFetch(`/api/reportes/ventas-historico?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
      if (!res.ok) throw new Error(res.error || 'Error al obtener histórico');
      
      setData({ 
        byDay: res.data?.byDay ?? [], 
        byProduct: res.data?.byProduct ?? [],
        resumenDescuentos: res.data?.resumenDescuentos
      });
    } catch (err: any) {
      Swal.fire('Error', err?.message || 'No se pudo obtener histórico', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function fetchHistoricoRange(startStr: string, endStr: string) {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/reportes/ventas-historico?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`);
      if (!res.ok) throw new Error(res.error || 'Error al obtener histórico');
      
      setData({ 
        byDay: res.data?.byDay ?? [], 
        byProduct: res.data?.byProduct ?? [],
        resumenDescuentos: res.data?.resumenDescuentos
      });
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
        const r = await apiFetch('/api/config/configuracion');
        if (r.ok && r.data && r.data.moneda) setCurrency(r.data.moneda);
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
              monetario = prod ? Number(prod.precioFinal * prod.cantidad || 0) : 0;
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
  const totalIngreso = data.byProduct.reduce((s, p) => s + (p.precioFinal * p.cantidad || 0), 0);
  const totalCosto = data.byProduct.reduce((s, p) => s + (p.costo || 0), 0);
  const totalGanancia = data.byProduct.reduce((s, p) => s + (p.ganancia || 0), 0);
  const numDias = data.byDay.length || 1;
  const ingresoPromedioDia = totalIngreso / numDias;

  // Exportación CSV
  function exportCSV() {
    const rows = [
      ['Tipo','Fecha/Producto','Cantidad','Precio Final','Costo','Ganancia'],
      ...data.byDay.map(d => ['DIA', d.fecha, String(d.cantidad), String(d.total), '', '']),
      ...data.byProduct.map(p => ['PRODUCTO', p.nombre, String(p.cantidad), String(p.precioFinal * p.cantidad || 0), String(p.costo || 0), String(p.ganancia || 0)])
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

      <div className="max-w-full mx-auto bg-white rounded-xl p-6">
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

        {/* KPIs principales */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-[#F2F0EB]">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">Ingreso del período</div>
              <button 
                onClick={() => Swal.fire('Ingreso del período', 'Total de ventas después de aplicar descuentos en el período seleccionado', 'info')}
                className="text-xs bg-gray-300 rounded-full w-4 h-4 flex items-center justify-center"
              >?</button>
            </div>
            <div className="text-xl font-semibold text-[#038C65]">{formatCurrency(totalIngreso)}</div>
          </div>
          <div className="p-4 rounded-lg bg-[#F2F0EB]">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">Unidades vendidas</div>
              <button 
                onClick={() => Swal.fire('Unidades vendidas', 'Número total de productos vendidos en el período', 'info')}
                className="text-xs bg-gray-300 rounded-full w-4 h-4 flex items-center justify-center"
              >?</button>
            </div>
            <div className="text-xl font-semibold text-[#0EA5A5]">{totalUnidades}</div>
          </div>
          <div className="p-4 rounded-lg bg-[#F2F0EB]">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">Inversión</div>
              <button 
                onClick={() => Swal.fire('Inversión', 'Costo total del inventario vendido en el período', 'info')}
                className="text-xs bg-gray-300 rounded-full w-4 h-4 flex items-center justify-center"
              >?</button>
            </div>
            <div className="text-xl font-semibold text-[#F59E0B]">{formatCurrency(totalCosto)}</div>
          </div>
          <div className="p-4 rounded-lg bg-[#F2F0EB]">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">Ganancia neta</div>
              <button 
                onClick={() => Swal.fire('Ganancia neta', 'Diferencia entre ingresos totales y costos del inventario: Ingreso - Inversión', 'info')}
                className="text-xs bg-gray-300 rounded-full w-4 h-4 flex items-center justify-center"
              >?</button>
            </div>
            <div className="text-xl font-semibold text-[#10B981]">{formatCurrency(totalGanancia)}</div>
          </div>
        </div>

        {/* Resumen de descuentos */}
        {data.resumenDescuentos && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold mb-3 text-[#038C65]">📊 Análisis de Descuentos del Período</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1">Total sin descuento</div>
                <div className="font-semibold">{formatCurrency(data.resumenDescuentos.totalSinDescuento)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1">Total con descuento</div>
                <div className="font-semibold">{formatCurrency(data.resumenDescuentos.totalConDescuento)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1">Diferencia ($)</div>
                <div className="font-semibold text-red-600">{formatCurrency(data.resumenDescuentos.diferenciaDinero)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1">Pérdida de margen (%)</div>
                <div className="font-semibold text-red-600">{data.resumenDescuentos.perdidaMargenPorcentaje.toFixed(1)}%</div>
              </div>
            </div>
          </div>
        )}

        {/* KPIs adicionales */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-[#F2F0EB]">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">Días analizados</div>
              <button 
                onClick={() => Swal.fire('Días analizados', 'Número de días incluidos en el período seleccionado', 'info')}
                className="text-xs bg-gray-300 rounded-full w-4 h-4 flex items-center justify-center"
              >?</button>
            </div>
            <div className="text-xl font-semibold">{numDias}</div>
          </div>
          <div className="p-4 rounded-lg bg-[#F2F0EB]">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">Promedio/día</div>
              <button 
                onClick={() => Swal.fire('Promedio por día', 'Ingreso promedio por día en el período: Total de ingresos ÷ Días analizados', 'info')}
                className="text-xs bg-gray-300 rounded-full w-4 h-4 flex items-center justify-center"
              >?</button>
            </div>
            <div className="text-xl font-semibold">{formatCurrency(ingresoPromedioDia)}</div>
          </div>
          <div className="p-4 rounded-lg bg-[#F2F0EB]">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">Margen general</div>
              <button 
                onClick={() => Swal.fire('Margen general', 'Porcentaje de ganancia sobre ventas totales: (Ganancia ÷ Ingresos) × 100', 'info')}
                className="text-xs bg-gray-300 rounded-full w-4 h-4 flex items-center justify-center"
              >?</button>
            </div>
            <div className="text-xl font-semibold">{totalIngreso > 0 ? ((totalGanancia / totalIngreso) * 100).toFixed(1) : '0.0'}%</div>
          </div>
        </div>

        {loading ? <div>Cargando...</div> : (
          <div className="space-y-6">
            {/* Tabla por producto - Ancho completo */}
            <div className="w-full">
              <h3 className="font-semibold mb-4 text-lg">Ventas por producto</h3>
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
                              <tr key={(p.productoId ?? 0) || `p-${startIdx + idx}`} className="border-b hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 font-medium">{p.nombre}</td>
                                <td className="px-4 py-3 text-center font-semibold text-blue-600">{formatNumber(p.cantidad || 0)}</td>
                                <td className="px-4 py-3 text-right">{formatCurrency(Number(p.precioVenta || 0))}</td>
                                <td className="px-4 py-3 text-right text-orange-600 font-semibold">{p.descuentoPorcentaje.toFixed(1)}%</td>
                                <td className="px-4 py-3 text-right font-semibold">{formatCurrency(Number(p.precioFinal || 0))}</td>
                                <td className="px-4 py-3 text-right font-semibold text-purple-600">{formatCurrency(Number(p.precioFinal * p.cantidad || 0))}</td>
                                <td className="px-4 py-3 text-right text-red-600">{formatCurrency(Number(p.costo || 0))}</td>
                                <td className="px-4 py-3 text-right text-green-600 font-semibold">{formatCurrency(Number(p.ganancia || 0))}</td>
                                <td className="px-4 py-3 text-right font-semibold">{p.margenPorcentaje.toFixed(1)}%</td>
                              </tr>
                            ))}
                          </>
                        );
                      })()
                    ) : <tr><td colSpan={9} className="p-8 text-gray-500 text-center">No hay datos</td></tr>}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              {data.byProduct.length > ITEMS_PER_PAGE && (
                <div className="mt-4 flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
                  <div className="text-sm text-gray-600">Mostrando {((page - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(page * ITEMS_PER_PAGE, data.byProduct.length)} de {data.byProduct.length}</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="px-4 py-2 rounded bg-white border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Anterior
                    </button>
                    <div className="text-sm flex items-center px-2">Página {page} / {Math.max(1, Math.ceil(data.byProduct.length / ITEMS_PER_PAGE))}</div>
                    <button
                      onClick={() => setPage((p) => Math.min(Math.ceil(data.byProduct.length / ITEMS_PER_PAGE), p + 1))}
                      disabled={page >= Math.ceil(data.byProduct.length / ITEMS_PER_PAGE)}
                      className="px-4 py-2 rounded bg-white border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </div>

    
            {/* Gráfica de distribución */}
            <div className="w-full lg:w-2/3 mx-auto">
              <h3 className="font-semibold mb-4 text-lg text-center">Distribución por cantidad vendida (por producto)</h3>
              <div className="bg-white rounded-lg shadow border p-4">
                <div style={{ height: 320 }}>
                  <Pie ref={chartRef} data={pieData} options={pieOptions} />
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
