import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  try {
    const categorias = await prisma.categorias.findMany();
    return res.status(200).json(categorias);
  } catch (error) {
    return res.status(500).json({ error: 'Error al listar categorías' });
  }
}
