import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  const { id, nombre, usuario, rol, activo } = req.body;
  if (!id || !nombre || !usuario || !rol) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }
  try {
    await prisma.usuarios.update({
      where: { id },
      data: { nombre, usuario, rol, activo },
    });
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno' });
  }
}
