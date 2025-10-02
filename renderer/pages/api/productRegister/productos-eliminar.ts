import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'ID requerido' });
  }
  try {
    await prisma.productos.delete({ where: { id: Number(id) } });
    return res.status(200).json({ ok: true });
  } catch (error) {
    let errorMsg = 'Error al eliminar producto';
    if (error instanceof Error) {
      errorMsg += ': ' + error.message;
      if (error.stack) {
        errorMsg += '\n' + error.stack;
      }
    } else if (typeof error === 'string') {
      errorMsg += ': ' + error;
    }
    return res.status(500).json({ error: errorMsg });
  }
}
