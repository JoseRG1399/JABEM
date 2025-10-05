import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { producto_id } = req.query;
    const where = producto_id ? { producto_id: parseInt(producto_id as string) } : {};

    const movimientos = await prisma.inventario_movimientos.findMany({
      where,
      orderBy: { fecha: 'desc' },
      include: { presentacion: true, producto: true }
    });

    return res.status(200).json(movimientos);
  } catch (error) {
    console.error('Error listar movimientos:', error);
    return res.status(500).json({ error: 'Error al listar movimientos' });
  }
}
