import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const config = await prisma.configuracion.findFirst();
    if (!config) {
      return res.status(404).json({ error: 'No se encontró la configuración de la tienda' });
    }
    return res.status(200).json({
      nombre_empresa: config.nombre_empresa,
      logo: config.logo,
      direccion: config.direccion,
      telefono: config.telefono,
      rfc: config.rfc,
      moneda: config.moneda,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno' });
  }
}
