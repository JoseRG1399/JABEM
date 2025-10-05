import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const productos = await prisma.productos.findMany({
      where: {
        stock_actual: {
          gt: 0,
        },
      },
      include: {
        categoria: true,
        presentaciones: {
          where: {
            activo: true,
          },
          orderBy: {
            es_default: "desc",
          },
        },
      },
      orderBy: {
        nombre: "asc",
      },
    });

    return res.status(200).json(productos);
  } catch (error) {
    console.error("Error fetching products:", error);
    return res.status(500).json({ message: "Error al obtener productos" });
  }
}
