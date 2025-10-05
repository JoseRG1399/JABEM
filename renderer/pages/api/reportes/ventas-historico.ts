import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'start y end son requeridos (ISO date)' });

    const startDate = new Date(String(start));
    const endDate = new Date(String(end));
    endDate.setHours(23,59,59,999);

    // Obtener detalles de ventas en el rango
    const detalles = await prisma.detalle_venta.findMany({
      where: { venta: { fecha: { gte: startDate, lte: endDate } } },
      include: { producto: true, venta: true }
    });

    // Agrupar por día (yyyy-mm-dd)
    const byDay: Record<string, { fecha: string; cantidad: number; total: number }> = {};
    const byProduct: Record<string, { productoId: number; nombre: string; cantidad: number; total: number }> = {};

    detalles.forEach(d => {
      const fecha = new Date(d.venta.fecha).toISOString().slice(0,10);
      const cantidad = Number(d.cantidad_presentacion || 0);
      const total = Number(d.subtotal || 0);

      if (!byDay[fecha]) byDay[fecha] = { fecha, cantidad: 0, total: 0 };
      byDay[fecha].cantidad += cantidad;
      byDay[fecha].total += total;

      const pid = d.producto_id;
      const pkey = String(pid);
      if (!byProduct[pkey]) byProduct[pkey] = { productoId: pid, nombre: d.producto?.nombre || 'Producto', cantidad: 0, total: 0 };
      byProduct[pkey].cantidad += cantidad;
      byProduct[pkey].total += total;
    });

    return res.status(200).json({ start: startDate, end: endDate, byDay: Object.values(byDay), byProduct: Object.values(byProduct) });
  } catch (error) {
    console.error('Error ventas-historico:', error);
    return res.status(500).json({ error: 'Error al obtener reporte histórico' });
  }
}
