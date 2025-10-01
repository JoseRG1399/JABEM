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
    await prisma.usuarios.delete({ where: { id } });
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno' });
  }
}
