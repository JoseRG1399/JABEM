import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

// Prisma singleton para evitar múltiples instancias en dev/hot-reload
const globalForPrisma = global as unknown as { prisma?: PrismaClient };
export const prisma =
  globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { nombre, descripcion = "" } = (req.body ?? {}) as {
      nombre?: string;
      descripcion?: string;
    };

    const nombreTrim = (nombre ?? "").toString().trim();
    const descTrim = (descripcion ?? "").toString().trim();

    if (!nombreTrim) {
      return res.status(400).json({ error: "El nombre es obligatorio" });
    }

    // (Opcional) evitar duplicados por nombre
    const existente = await prisma.categorias.findFirst({
      where: { nombre: nombreTrim },
      select: { id: true },
    });
    if (existente) {
      return res
        .status(409)
        .json({ error: "Ya existe una categoría con ese nombre", id: existente.id });
    }

    const nueva = await prisma.categorias.create({
      data: {
        nombre: nombreTrim,
        descripcion: descTrim,
      },
      select: { id: true, nombre: true, descripcion: true },
    });

    return res.status(201).json(nueva);
  } catch (e) {
    console.error("categorias-alta error:", e);
    return res.status(500).json({ error: "No se pudo crear la categoría" });
  }
}
