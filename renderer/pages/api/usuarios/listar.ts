import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  try {
    const usuarios = await prisma.usuarios.findMany({
      select: {
        id: true,
        nombre: true,
        usuario: true,
        rol: true,
        activo: true,
      },
    });
    return res.status(200).json(usuarios);
  } catch (error) {
    return res.status(500).json({ error: 'Error interno' });
  }
}
