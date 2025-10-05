import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  
  try {
    const { 
      id, 
      nombre, 
      unidad, 
      factor_a_base, 
      precio_unitario, 
      codigo_barras, 
      es_default 
    } = req.body;
    
    if (!id || !nombre || !unidad || !factor_a_base || precio_unitario === undefined) {
      return res.status(400).json({ 
        error: 'Faltan campos requeridos: id, nombre, unidad, factor_a_base, precio_unitario' 
      });
    }
    
    // Validaciones
    if (parseFloat(factor_a_base) <= 0) {
      return res.status(400).json({ error: 'El factor a base debe ser mayor que 0' });
    }
    
    if (parseFloat(precio_unitario) < 0) {
      return res.status(400).json({ error: 'El precio unitario no puede ser negativo' });
    }
    
    // Si se marca como default, primero quitamos el default a las demás del mismo producto
    if (es_default) {
      const presentacionActual = await prisma.presentaciones_producto.findUnique({
        where: { id: parseInt(id) }
      });
      
      if (presentacionActual) {
        await prisma.presentaciones_producto.updateMany({
          where: { 
            producto_id: presentacionActual.producto_id,
            id: { not: parseInt(id) }
          },
          data: { es_default: false }
        });
      }
    }
    
    const presentacionActualizada = await prisma.presentaciones_producto.update({
      where: { id: parseInt(id) },
      data: {
        nombre: nombre.trim(),
        unidad,
        factor_a_base: parseFloat(factor_a_base),
        precio_unitario: parseFloat(precio_unitario),
        codigo_barras: codigo_barras ? codigo_barras.trim() : null,
        es_default: Boolean(es_default)
      },
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
      message: 'Presentación actualizada correctamente',
      presentacion: presentacionActualizada
    });
  } catch (error) {
    console.error('Error al actualizar presentación:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'El código de barras ya existe' });
    }
    return res.status(500).json({ error: 'Error al actualizar la presentación' });
  }
}