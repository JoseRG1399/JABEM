import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    return handleCreateSale(req, res);
  } else if (req.method === "GET") {
    return handleGetSales(req, res);
  } else {
    return res.status(405).json({ message: "Method not allowed" });
  }
}

async function handleCreateSale(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { usuario_id, metodo_pago, items, descuento_porcentaje } = req.body;

    if (!usuario_id || !metodo_pago || !items || items.length === 0) {
      return res.status(400).json({ message: "Datos incompletos" });
    }

    // Calcular el subtotal
    let subtotal = 0;
    const detalleData = [];

    for (const item of items) {
      const presentacion = await prisma.presentaciones_producto.findUnique({
        where: { id: item.presentacion_id },
        include: { producto: true },
      });

      if (!presentacion) {
        return res.status(404).json({
          message: `Presentación ${item.presentacion_id} no encontrada`,
        });
      }

      const itemSubtotal = Number(presentacion.precio_unitario) * item.cantidad;
      subtotal += itemSubtotal;

      detalleData.push({
        producto_id: presentacion.producto_id,
        presentacion_id: item.presentacion_id,
        cantidad_presentacion: item.cantidad,
        precio_unitario: presentacion.precio_unitario,
        precio_compra: presentacion.producto?.precio_compra ?? 0,
        subtotal: itemSubtotal,
      });
    }

    // Calcular descuento y total
    const descuentoPorcentajeVal = descuento_porcentaje || 0;
    const descuentoMonto = (subtotal * descuentoPorcentajeVal) / 100;
    const total = subtotal - descuentoMonto;

    // Crear la venta con sus detalles
    const venta = await prisma.ventas.create({
      data: {
        usuario_id,
        fecha: new Date(),
        subtotal,
        descuento_porcentaje: descuentoPorcentajeVal,
        descuento_monto: descuentoMonto,
        total,
        metodo_pago,
        detalle: {
          create: detalleData,
        },
      },
      include: {
        detalle: {
          include: {
            producto: true,
            presentacion: true,
          },
        },
        usuario: {
          select: {
            id: true,
            nombre: true,
            usuario: true,
          },
        },
      },
    });

    // Agregar información de descuento a la respuesta
    const ventaConDescuento = {
      ...venta,
      subtotal,
      descuento_porcentaje: descuentoPorcentajeVal,
      descuento_monto: descuentoMonto,
    };

    // Actualizar inventario y crear movimientos
    for (const item of items) {
      const presentacion = await prisma.presentaciones_producto.findUnique({
        where: { id: item.presentacion_id },
      });

      const cantidadBase = Number(presentacion.factor_a_base) * item.cantidad;

      // Actualizar stock
      await prisma.productos.update({
        where: { id: presentacion.producto_id },
        data: {
          stock_actual: {
            decrement: cantidadBase,
          },
        },
      });

      // Registrar movimiento de inventario
      await prisma.inventario_movimientos.create({
        data: {
          producto_id: presentacion.producto_id,
          presentacion_id: item.presentacion_id,
          tipo_movimiento: "salida",
          cantidad_base: cantidadBase,
          fecha: new Date(),
          comentario: `Venta #${venta.id}`,
        },
      });
    }

    return res.status(200).json(ventaConDescuento);
  } catch (error) {
    console.error("Error creating sale:", error);
    return res.status(500).json({ message: "Error al crear la venta", error: error.message });
  }
}

async function handleGetSales(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { limit, offset, fecha_inicio, fecha_fin } = req.query;

    const where: any = {};
    
    if (fecha_inicio || fecha_fin) {
      where.fecha = {};
      if (fecha_inicio) {
        where.fecha.gte = new Date(fecha_inicio as string);
      }
      if (fecha_fin) {
        where.fecha.lte = new Date(fecha_fin as string);
      }
    }

    const ventas = await prisma.ventas.findMany({
      where,
      include: {
        detalle: {
          include: {
            producto: true,
            presentacion: true,
          },
        },
        usuario: {
          select: {
            id: true,
            nombre: true,
            usuario: true,
          },
        },
      },
      orderBy: {
        fecha: "desc",
      },
      take: limit ? parseInt(limit as string) : undefined,
      skip: offset ? parseInt(offset as string) : undefined,
    });

    return res.status(200).json(ventas);
  } catch (error) {
    console.error("Error fetching sales:", error);
    return res.status(500).json({ message: "Error al obtener las ventas" });
  }
}
