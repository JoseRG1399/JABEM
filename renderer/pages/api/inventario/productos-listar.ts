import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const productos = await prisma.productos.findMany({
      include: { categoria: true, presentaciones: true },
      orderBy: { nombre: 'asc' }
    });

    const mapped = productos.map((p) => ({
      ...p,
      stock_actual: p.stock_actual ? String(p.stock_actual) : '0',
      stock_minimo: p.stock_minimo ? String(p.stock_minimo) : '0',
      presentaciones: (p.presentaciones || []).map((pr) => ({
        ...pr,
        factor_a_base: pr.factor_a_base ? String(pr.factor_a_base) : '0',
        precio_unitario: pr.precio_unitario ? String(pr.precio_unitario) : '0'
      }))
    }));

    return res.status(200).json(mapped);
  } catch (error) {
    console.error('Error listar productos inventario:', error);
    return res.status(500).json({ error: 'Error al listar productos' });
  }
}
