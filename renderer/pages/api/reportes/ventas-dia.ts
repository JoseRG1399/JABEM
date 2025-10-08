import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todayEnd = new Date();
    todayEnd.setHours(23,59,59,999);

    // Obtener detalle de ventas del día, incluyendo producto y sumas
    const detalles = await prisma.detalle_venta.findMany({
      where: { venta: { fecha: { gte: todayStart, lte: todayEnd } } },
      include: { producto: true, presentacion: true, venta: true }
    });

    // Agrupar por producto
    const agrupado: Record<string, { productoId: number; nombre: string; cantidad: number; total: number; costo: number; margen: number }> = {};
    detalles.forEach(d => {
      const pid = d.producto_id;
      const key = String(pid);
      const cantidad = Number(d.cantidad_presentacion || 0);
      const total = Number(d.subtotal || 0);
      const factor = Number(d.presentacion?.factor_a_base || 1);
      const cantidadBase = cantidad * factor;
  const costoUnitario = Number((d.producto as any)?.precio_compra || 0);
      const costoTotal = cantidadBase * costoUnitario;
      const margen = total - costoTotal;

      if (!agrupado[key]) agrupado[key] = { productoId: pid, nombre: d.producto?.nombre || 'Producto', cantidad: 0, total: 0, costo: 0, margen: 0 };
      agrupado[key].cantidad += cantidad;
      agrupado[key].total += total;
      agrupado[key].costo += costoTotal;
      agrupado[key].margen += margen;
    });

    const rows = Object.values(agrupado);

    return res.status(200).json({ fecha: new Date(), filas: rows });
  } catch (error) {
    console.error('Error ventas-dia:', error);
    return res.status(500).json({ error: 'Error al obtener reporte de ventas del día' });
  }
}
