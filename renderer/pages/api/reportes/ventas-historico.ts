// pages/api/reportes/ventas-historico.ts (o .js)
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function parseLocalDate(dStr: string) {
  // "2025-10-05" -> Date en local 00:00:00
  const [y, m, d] = dStr.split('-').map(Number);
  return new Date(y, (m - 1), d, 0, 0, 0, 0); // local
}

function endOfDayLocal(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function nextDayLocal(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'start y end son requeridos (YYYY-MM-DD)' });

    const startDate = parseLocalDate(String(start));
    const endDate = parseLocalDate(String(end));

    // Opción 1 (recomendada): half-open [start, nextDay(end))
    const endExclusive = nextDayLocal(endDate);

    // ⚠️ Ajusta nombres de modelo/campos a tu schema real:
    const detalles = await prisma.detalle_venta.findMany({
      where: { venta: { fecha: { gte: startDate, lt: endExclusive } } },
      include: { producto: true, venta: true, presentacion: true },
    });

    // Agrupar por día (local)
    const byDayMap: Record<string, { fecha: string; cantidad: number; total: number }> = {};
  const byProductMap: Record<string, { productoId: number; nombre: string; cantidad: number; total: number; costo: number; margen: number }> = {};

    for (const d of detalles) {
      const vf = new Date(d.venta.fecha);
      const key = `${vf.getFullYear()}-${String(vf.getMonth() + 1).padStart(2,'0')}-${String(vf.getDate()).padStart(2,'0')}`;

      const cantidad = Number(d.cantidad_presentacion ?? 0);
      const total = Number(d.subtotal ?? d.venta.total ?? 0);

      if (!byDayMap[key]) byDayMap[key] = { fecha: key, cantidad: 0, total: 0 };
      byDayMap[key].cantidad += cantidad;
      byDayMap[key].total += total;

      const pid = d.producto_id ?? d.producto?.id;
      const nombre = d.producto?.nombre ?? 'Producto';
      const pkey = String(pid ?? nombre);

    const factor = Number(d.presentacion?.factor_a_base || 1);
    const cantidadBase = cantidad * factor;
    const costoUnitario = Number((d.producto as any)?.precio_compra || 0);
    const costoTotal = cantidadBase * costoUnitario;
    const margen = total - costoTotal;

    if (!byProductMap[pkey]) byProductMap[pkey] = { productoId: pid ?? 0, nombre, cantidad: 0, total: 0, costo: 0, margen: 0 };
    byProductMap[pkey].cantidad += cantidad;
    byProductMap[pkey].total += total;
    byProductMap[pkey].costo += costoTotal;
    byProductMap[pkey].margen += margen;
    }

    res.status(200).json({
      start: startDate.toISOString(),
      end: endOfDayLocal(endDate).toISOString(),
      byDay: Object.values(byDayMap).sort((a,b)=>a.fecha.localeCompare(b.fecha)),
      byProduct: Object.values(byProductMap).sort((a,b)=>b.total - a.total)
    });
  } catch (error) {
    console.error('Error ventas-historico:', error);
    res.status(500).json({ error: 'Error al obtener reporte histórico' });
  }
}
