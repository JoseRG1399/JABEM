import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

const g = global as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;

// GET /api/alta-productos/productos-detalle?id=123
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const id = Number(req.query.id);
  if (!id) return res.status(400).json({ error: "id es obligatorio" });

  try {
    const producto = await prisma.productos.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        unidad_base: true,
        categoria: { select: { id: true, nombre: true } },
        presentaciones: {
          select: {
            id: true,
            nombre: true,
            unidad: true,
            factor_a_base: true,
            precio_unitario: true,
            codigo_barras: true,
            es_default: true,
            activo: true,
          },
          orderBy: [{ es_default: "desc" }, { nombre: "asc" }],
        },
      },
    });

    if (!producto) return res.status(404).json({ error: "Producto no encontrado" });
    return res.status(200).json(producto);
  } catch (e) {
    console.error("productos-detalle error:", e);
    return res.status(500).json({ error: "No se pudo obtener el producto" });
  }
}
