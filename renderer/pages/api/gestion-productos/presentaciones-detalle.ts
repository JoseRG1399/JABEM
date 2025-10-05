import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  
  try {
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ error: 'ID de presentación requerido' });
    }
    
    const presentacion = await prisma.presentaciones_producto.findUnique({
      where: { id: parseInt(id) },
      include: {
        producto: {
          include: {
            categoria: {
              select: {
                id: true,
                nombre: true
              }
            }
          }
        }
      }
    });
    
    if (!presentacion) {
      return res.status(404).json({ error: 'Presentación no encontrada' });
    }
    
    return res.status(200).json(presentacion);
  } catch (error) {
    console.error('Error al obtener presentación:', error);
    return res.status(500).json({ error: 'Error al obtener la presentación' });
  }
}