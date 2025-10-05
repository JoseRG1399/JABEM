"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Chart, PieController, ArcElement, Tooltip, Legend } from 'chart.js';
import Swal from 'sweetalert2';

Chart.register(PieController, ArcElement, Tooltip, Legend);

export default function HistoricoPage() {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [data, setData] = useState<any>({ byDay: [], byProduct: [] });
  const [loading, setLoading] = useState(false);
  const [activeRange, setActiveRange] = useState<string>('');
  const [currency, setCurrency] = useState('MXN');
  function formatCurrency(amount: number) {
    try {
      return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(amount);
    } catch (e) {
      return `$${Number(amount || 0).toFixed(2)}`;
    }
  }
  const chartRef = useRef<Chart | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  async function fetchHistorico() {
    if (!start || !end) return Swal.fire('Error', 'Selecciona rango de fechas', 'error');
    try {
      setLoading(true);
      const res = await fetch(`/api/reportes/ventas-historico?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Error al obtener histórico');
      setData(payload);
    } catch (err: any) {
      Swal.fire('Error', err?.message || 'No se pudo obtener histórico', 'error');
    } finally { setLoading(false); }
  }

  // Helper to fetch a specific start/end without relying on component state
  async function fetchHistoricoRange(startStr: string, endStr: string) {
    try {
      setLoading(true);
      const res = await fetch(`/api/reportes/ventas-historico?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Error al obtener histórico');
      setData(payload);
      // mirror into inputs
      setStart(startStr);
      setEnd(endStr);
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

  useEffect(() => {
    // obtener moneda de configuración
    fetch('/api/config/configuracion').then(r => r.ok ? r.json() : null).then(cfg => { if (cfg && cfg.moneda) setCurrency(cfg.moneda); }).catch(() => {});

    if (!canvasRef.current) return;

    // Build pie data from byProduct: sort by cantidad desc, take top N and group rest as 'Otros'
    const products = Array.isArray(data.byProduct) ? [...data.byProduct] : [];
    products.sort((a: any, b: any) => (b.cantidad || 0) - (a.cantidad || 0));
    const TOP_N = 10;
    const top = products.slice(0, TOP_N);
    const resto = products.slice(TOP_N);
    const otherTotal = resto.reduce((s: number, r: any) => s + Number(r.cantidad || 0), 0);

    const labels = top.map((p: any) => p.nombre);
    const values = top.map((p: any) => Number(p.cantidad || 0));
    if (otherTotal > 0) { labels.push('Otros'); values.push(otherTotal); }

    // Colors (generate a palette)
    const palette = [
      '#0EA5A5','#0369A1','#0F1724','#065F46','#7C3AED','#B91C1C','#F59E0B','#10B981','#06B6D4','#EF4444','#64748B'
    ];
    const backgroundColors = labels.map((_, i) => palette[i % palette.length]);

    if (chartRef.current) {
      chartRef.current.data.labels = labels;
      chartRef.current.data.datasets = [{ label: 'Cantidad vendida', data: values, backgroundColor: backgroundColors }];
      chartRef.current.update();
      return;
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    chartRef.current = new Chart(ctx, {
      type: 'pie',
      data: { labels, datasets: [{ label: 'Cantidad vendida', data: values, backgroundColor: backgroundColors }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
                callbacks: {
              label: function(context: any) {
                const label = context.label || '';
                const value = Number(context.parsed || 0);
                const dataArr = context.chart.data.datasets[0].data as number[];
                const total = dataArr.reduce((s, v) => s + Number(v || 0), 0);
                const pct = total ? ((value / total) * 100) : 0;
                // Buscar total monetario en data.byProduct por nombre
                const prod = (data.byProduct || []).find((p: any) => p.nombre === label);
                const monetario = prod ? Number(prod.total || 0) : 0;
                const monetarioFmt = formatCurrency(monetario);
                return `${label}: ${value} (${pct.toFixed(1)}%) — ${monetarioFmt}`;
              }
            }
          },
          legend: {
            labels: {
              generateLabels: function(chart: any) {
                const data = chart.data;
                const ds = data.datasets[0];
                const total = (ds.data || []).reduce((s: number, v: any) => s + Number(v || 0), 0);
                return data.labels.map((label: any, i: number) => {
                  const value = Number(ds.data[i] || 0);
                  const pct = total ? ((value / total) * 100) : 0;
                  return {
                    text: `${label} (${pct.toFixed(1)}%)`,
                    fillStyle: ds.backgroundColor[i],
                    hidden: false,
                    index: i
                  };
                });
              }
            }
          }
        }
      }
    });
  }, [data]);

  return (
    <div className="min-h-screen bg-[#091B26] p-6">
         <button
                    onClick={() => window.location.href = "/menuPrincipal"}
                    className="mb-4 px-4 py-2 rounded-xl bg-[#038C65] text-white font-semibold shadow hover:bg-[#027857]"
                >
                    ← Volver al menú principal
                </button>
      <div className="max-w-6xl mx-auto bg-white rounded-xl p-6">
        <h2 className="text-xl font-bold text-[#038C65] mb-4">Reportes - Histórico de ventas por fechas</h2>
        <p className='mb-4 text-gray-700 font-normal'>
            Selecciona las fechas y haz clic en "Consultar". También puedes usar los botones para rangos rápidos como "Hoy" o "Últimos 7 días".
        </p>
        <div className="flex items-center gap-4 mb-4">
          <div className="flex flex-col">
            <label className="text-sm text-gray-600 mb-1">Fecha inicio</label>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="rounded border px-3 py-2" />
          </div>
          <div className="flex flex-col">
            <label className="text-sm text-gray-600 mb-1">Fecha fin</label>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded border px-3 py-2" />
          </div>
          <button onClick={fetchHistorico} className="px-3 py-2 mt-5 rounded bg-[#0EA5A5] text-white">Consultar</button>
          <div className="flex items-center gap-2 mt-5">
              <button
                onClick={() => rangeToday()}
                className={`px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 transition-all ${activeRange === 'today' ? 'ring-2 ring-[#0EA5A5] border-2 border-[#0EA5A5]' : ''}`}>
                Hoy
              </button>
              <button
                onClick={() => rangeLastDays(7)}
                className={`px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 transition-all ${activeRange === '7' ? 'ring-2 ring-[#0EA5A5] border-2 border-[#0EA5A5]' : ''}`}>
                Últimos 7 días
              </button>
              <button
                onClick={() => rangeLastDays(30)}
                className={`px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 transition-all ${activeRange === '30' ? 'ring-2 ring-[#0EA5A5] border-2 border-[#0EA5A5]' : ''}`}>
                Últimos 30 días
              </button>
          </div>
          
          <button onClick={() => { setStart(''); setEnd(''); setData({ byDay: [], byProduct: [] }); }} className="px-3 py-2 rounded bg-gray-100 mt-5">Limpiar</button>
        </div>

        {loading ? <div>Cargando...</div> : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">Distribución por cantidad vendida (por producto)</h3>
              <div style={{height: 320}}><canvas ref={canvasRef}></canvas></div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Ventas por producto</h3>
              <div className="overflow-auto" style={{maxHeight: 320}}>
                <table className="min-w-full">
                  <thead className="bg-[#F2F0EB]"><tr><th className="px-3 py-2 text-left">Producto</th><th className="px-3 py-2 text-right">Cantidad</th><th className="px-3 py-2 text-right">Total</th></tr></thead>
                  <tbody>
                    {data.byProduct && data.byProduct.length ? data.byProduct.map((p: any) => (
                      <tr key={p.productoId}><td className="px-3 py-2">{p.nombre}</td><td className="px-3 py-2 text-right">{p.cantidad}</td><td className="px-3 py-2 text-right">{formatCurrency(Number(p.total || 0))}</td></tr>
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
