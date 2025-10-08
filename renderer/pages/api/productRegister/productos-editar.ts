import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Método no permitido' });
  try {
    const {
      id,
      nombre,
      descripcion,
      categoria_id,
      unidad_base,
      stock_actual,
      stock_minimo,
      codigo_barras,
      precio_compra,
    } = req.body || {};

    if (!id) return res.status(400).json({ error: 'ID requerido' });

    const data: any = {};
    if (nombre !== undefined) data.nombre = nombre;
    if (descripcion !== undefined) data.descripcion = descripcion;
    if (categoria_id !== undefined) data.categoria_id = Number(categoria_id);
    if (unidad_base !== undefined) data.unidad_base = unidad_base;
    if (stock_actual !== undefined) data.stock_actual = Number(stock_actual || 0);
    if (stock_minimo !== undefined) data.stock_minimo = Number(stock_minimo || 0);
    if (codigo_barras !== undefined) data.codigo_barras = codigo_barras || null;
    if (precio_compra !== undefined) data.precio_compra = Number(precio_compra || 0);

    const updated = await prisma.productos.update({ where: { id: Number(id) }, data });
    return res.status(200).json({ ok: true, message: 'Producto actualizado', data: { id: updated.id } });
  } catch (err: any) {
    console.error('Error updating product:', err);
    if (err?.code === 'P2002') return res.status(400).json({ error: 'El código de barras ya existe' });
    return res.status(500).json({ error: err?.message || 'Error interno' });
  }
}
