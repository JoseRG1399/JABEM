import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  
  try {
    const { id } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'ID de presentación requerido' });
    }
    
    // Primero obtenemos el estado actual
    const presentacionActual = await prisma.presentaciones_producto.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!presentacionActual) {
      return res.status(404).json({ error: 'Presentación no encontrada' });
    }
    
    // Cambiamos al estado opuesto
    const nuevoEstado = !presentacionActual.activo;
    
    const presentacionActualizada = await prisma.presentaciones_producto.update({
      where: { id: parseInt(id) },
      data: { activo: nuevoEstado },
      include: {
        producto: {
          select: {
            id: true,
            nombre: true
          }
        }
      }
    });
    
    return res.status(200).json({
      message: `Presentación ${nuevoEstado ? 'activada' : 'desactivada'} correctamente`,
      presentacion: presentacionActualizada
    });
  } catch (error) {
    console.error('Error al cambiar estado de presentación:', error);
    return res.status(500).json({ error: 'Error al cambiar estado de la presentación' });
  }
}