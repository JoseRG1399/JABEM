import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { producto_id, presentacion_id, cantidad, tipo, razon } = req.body;
    if (!producto_id || !cantidad || !tipo) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const qty = Number(cantidad);
    if (isNaN(qty) || qty === 0) {
      return res.status(400).json({ error: 'Cantidad inválida' });
    }

    // Actualizamos stock del producto (usamos stock_actual como Decimal en prisma)
    const producto = await prisma.productos.findUnique({ where: { id: parseInt(producto_id) } });
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

    // calculamos nuevo stock segun tipo
    let nuevoStock = Number(producto.stock_actual || 0);
    if (tipo === 'entrada') nuevoStock += qty;
    else if (tipo === 'salida') nuevoStock -= qty;
    else if (tipo === 'ajuste') nuevoStock = qty; // ajuste directo

    await prisma.productos.update({ where: { id: parseInt(producto_id) }, data: { stock_actual: nuevoStock } });

    // registramos movimiento
    const movimiento = await prisma.inventario_movimientos.create({
      data: {
        producto_id: parseInt(producto_id),
        presentacion_id: presentacion_id ? parseInt(presentacion_id) : null,
        tipo_movimiento: tipo,
        cantidad_base: qty,
        comentario: razon || '',
        fecha: new Date()
      }
    });

    return res.status(200).json({ message: 'Stock actualizado', movimiento });
  } catch (error) {
    console.error('Error ajustar stock:', error);
    return res.status(500).json({ error: 'Error al ajustar stock' });
  }
}
