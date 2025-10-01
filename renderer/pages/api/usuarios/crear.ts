import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  const { nombre, usuario, password, rol } = req.body;
  if (!nombre || !usuario || !password || !rol) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }
  try {
    const password_hash = await bcrypt.hash(password, 10);
    const nuevo = await prisma.usuarios.create({
      data: {
        nombre,
        usuario,
        password_hash,
        rol,
        activo: true,
      },
    });
    return res.status(201).json({ id: nuevo.id });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno' });
  }
}
