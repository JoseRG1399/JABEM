import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  const { nombre, descripcion, categoria_id, unidad_base, stock_actual, stock_minimo, codigo_barras } = req.body;
  if (!nombre || !descripcion || !categoria_id || !unidad_base) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }
  try {
    const producto = await prisma.productos.create({
      data: {
        nombre,
        descripcion,
        categoria_id: Number(categoria_id),
        unidad_base,
        stock_actual: Number(stock_actual) || 0,
        stock_minimo: Number(stock_minimo) || 0,
        codigo_barras,
      },
    });
    return res.status(201).json(producto);
  } catch (error) {
    return res.status(500).json({ error: 'Error al crear producto' });
  }
}
