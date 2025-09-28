import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { usuario, password } = req.body;
  if (!usuario || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  try {
    const user = await prisma.usuarios.findUnique({
      where: { usuario },
    });
    if (!user) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
    // Devolver solo los datos necesarios
    return res.status(200).json({
      id: user.id,
      nombre: user.nombre,
      usuario: user.usuario,
      rol: user.rol,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno' });
  }
}
