"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import Swal from 'sweetalert2';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function ReportesPage() {
  const [data, setData] = useState<any>({ filas: [] });
  const [loading, setLoading] = useState(false);
  const [currency, setCurrency] = useState('MXN');
  function formatCurrency(amount: number) {
    try {
      return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(amount);
    } catch (e) {
      return `$${Number(amount || 0).toFixed(2)}`;
    }
  }
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  async function fetchVentasDia() {
    try {
      setLoading(true);
      const res = await fetch('/api/reportes/ventas-dia');
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Error al obtener ventas del día');
      setData(payload);
    } catch (err: any) {
      Swal.fire('Error', err?.message || 'No se pudo obtener el reporte', 'error');
    } finally {
      setLoading(false);
    }
  }

  // obtener moneda desde configuración
  useEffect(() => {
    fetch('/api/config/configuracion').then(r => r.ok ? r.json() : null).then(cfg => {
      if (cfg && cfg.moneda) setCurrency(cfg.moneda);
    }).catch(() => {});
  }, []);

  useEffect(() => { fetchVentasDia(); }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    const labels = data.filas?.map((f: any) => f.nombre) || [];
    const totals = data.filas?.map((f: any) => Number(f.total || 0)) || [];

    if (chartRef.current) {
      chartRef.current.data.labels = labels;
      chartRef.current.data.datasets = [{ label: 'Total ventas (dinero)', data: totals, backgroundColor: 'rgba(3,140,101,0.7)' }];
      chartRef.current.update();
      return;
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Total ventas (dinero)', data: totals, backgroundColor: 'rgba(3,140,101,0.7)' }] },
      options: { responsive: true, maintainAspectRatio: false }
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
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-[#038C65]">Reportes - Ventas del día</h2>
          <div className="flex gap-2">
            <button onClick={() => window.location.href = '/reportes/historico'} className="px-3 py-2 rounded bg-[#0EA5A5] text-white">Histórico por fechas</button>
            <button onClick={() => fetchVentasDia()} className="px-3 py-2 rounded bg-gray-100">Actualizar</button>
          </div>
        </div>

        {loading ? <div>Cargando...</div> : (
          <div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <table className="min-w-full mb-4">
                  <thead className="bg-[#F2F0EB]"><tr><th className="px-3 py-2 text-left">Producto</th><th className="px-3 py-2 text-right">Cantidad</th><th className="px-3 py-2 text-right">Total</th></tr></thead>
                  <tbody>
                    {data.filas && data.filas.length ? data.filas.map((f: any) => (
                      <tr key={f.productoId} className="border-b"><td className="px-3 py-2">{f.nombre}</td><td className="px-3 py-2 text-right">{f.cantidad}</td><td className="px-3 py-2 text-right">{formatCurrency(Number(f.total || 0))}</td></tr>
                    )) : <tr><td colSpan={3} className="p-4 text-gray-500">No hay ventas hoy</td></tr>}
                  </tbody>
                </table>
              </div>
              <div style={{height: 360}}>
                <canvas ref={canvasRef}></canvas>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
