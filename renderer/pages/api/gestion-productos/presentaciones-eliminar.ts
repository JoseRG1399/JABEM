import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  
  try {
    const { id } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'ID de presentación requerido' });
    }
    
    // Verificamos si la presentación existe
    const presentacion = await prisma.presentaciones_producto.findUnique({
      where: { id: parseInt(id) },
      include: {
        producto: {
          select: {
            id: true,
            nombre: true
          }
        }
      }
    });
    
    if (!presentacion) {
      return res.status(404).json({ error: 'Presentación no encontrada' });
    }
    
    // Verificamos si hay ventas asociadas a esta presentación
    const ventasAsociadas = await prisma.detalle_venta.count({
      where: { presentacion_id: parseInt(id) }
    });
    
    if (ventasAsociadas > 0) {
      return res.status(400).json({ 
        error: 'No se puede eliminar la presentación porque tiene ventas asociadas. Puede desactivarla en su lugar.' 
      });
    }
    
    // Verificamos si hay movimientos de inventario asociados
    const movimientosAsociados = await prisma.inventario_movimientos.count({
      where: { presentacion_id: parseInt(id) }
    });
    
    if (movimientosAsociados > 0) {
      return res.status(400).json({ 
        error: 'No se puede eliminar la presentación porque tiene movimientos de inventario asociados. Puede desactivarla en su lugar.' 
      });
    }
    
    await prisma.presentaciones_producto.delete({
      where: { id: parseInt(id) }
    });
    
    return res.status(200).json({
      message: 'Presentación eliminada correctamente',
      presentacion
    });
  } catch (error) {
    console.error('Error al eliminar presentación:', error);
    return res.status(500).json({ error: 'Error al eliminar la presentación' });
  }
}