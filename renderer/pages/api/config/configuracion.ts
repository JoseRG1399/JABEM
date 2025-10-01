import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Obtener configuración actual
    const config = await prisma.configuracion.findFirst();
    if (!config) {
      return res.status(404).json({ error: 'No se encontró la configuración' });
    }
    return res.status(200).json(config);
  }

  if (req.method === 'PUT') {
    // Actualizar configuración
    const { nombre_empresa, logo, direccion, telefono, rfc, moneda } = req.body;
    try {
      const config = await prisma.configuracion.findFirst();
      if (!config) {
        return res.status(404).json({ error: 'No se encontró la configuración' });
      }
      const updated = await prisma.configuracion.update({
        where: { id: config.id },
        data: { nombre_empresa, logo, direccion, telefono, rfc, moneda },
      });
      return res.status(200).json(updated);
    } catch (error) {
      return res.status(500).json({ error: 'Error al actualizar configuración' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
