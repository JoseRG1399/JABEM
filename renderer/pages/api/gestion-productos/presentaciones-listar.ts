import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  
  try {
    const { producto_id } = req.query;
    
    const whereClause = producto_id ? { producto_id: parseInt(producto_id) } : {};
    
    const presentaciones = await prisma.presentaciones_producto.findMany({
      where: whereClause,
      include: {
        producto: {
          select: {
            id: true,
            nombre: true,
            categoria: {
              select: {
                id: true,
                nombre: true
              }
            }
          }
        }
      },
      orderBy: [
        { es_default: 'desc' },
        { nombre: 'asc' }
      ]
    });
    
    return res.status(200).json(presentaciones);
  } catch (error) {
    console.error('Error al listar presentaciones:', error);
    return res.status(500).json({ error: 'Error al listar presentaciones' });
  }
}