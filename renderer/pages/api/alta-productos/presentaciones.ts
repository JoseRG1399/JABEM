import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient, Unidad } from "@prisma/client";

// Prisma singleton (evita múltiples instancias en dev)
const g = global as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;

type NuevaPresentacion = {
  producto_id: number | string;
  nombre: string;
  unidad: Unidad | string; // "kg" | "bulto" | "pieza"
  factor_a_base: number | string; // > 0
  precio_unitario: number | string; // >= 0
  codigo_barras?: string | null;
  es_default?: boolean;
  activo?: boolean;
};

// --- GET /api/alta-productos/presentaciones?producto_id=123
// Lista presentaciones de un producto
async function handleGET(req: NextApiRequest, res: NextApiResponse) {
  const productoId = Number(req.query.producto_id);
  if (!productoId) {
    return res.status(400).json({ error: "producto_id es obligatorio" });
  }

  const presentaciones = await prisma.presentaciones_producto.findMany({
    where: { producto_id: productoId },
    orderBy: [{ es_default: "desc" }, { nombre: "asc" }],
    select: {
      id: true,
      producto_id: true,
      nombre: true,
      unidad: true,
      factor_a_base: true,
      precio_unitario: true,
      codigo_barras: true,
      es_default: true,
      activo: true,
    },
  });

  return res.status(200).json(presentaciones);
}

// --- POST /api/alta-productos/presentaciones
// Crea 1 o varias presentaciones (acepta objeto o array)
async function handlePOST(req: NextApiRequest, res: NextApiResponse) {
  const body = req.body as NuevaPresentacion | NuevaPresentacion[];

  const inputArray: NuevaPresentacion[] = Array.isArray(body) ? body : [body];

  if (!inputArray.length) {
    return res.status(400).json({ error: "Faltan datos" });
  }

  // Validamos y normalizamos
  const normalizados = inputArray.map((p, idx) => {
    const producto_id = Number(p.producto_id);
    const nombre = String(p.nombre ?? "").trim();
    const unidad = String(p.unidad ?? "").trim() as Unidad;
    const factor_a_base = Number(p.factor_a_base);
    const precio_unitario = Number(p.precio_unitario);
    const codigo_barras = p.codigo_barras ? String(p.codigo_barras).trim() : null;
    const es_default = Boolean(p.es_default);
    const activo = p.activo === undefined ? true : Boolean(p.activo);

    if (!producto_id) throw new Error(`[#${idx + 1}] producto_id es obligatorio`);
    if (!nombre) throw new Error(`[#${idx + 1}] nombre es obligatorio`);
    if (!unidad || !["kg", "bulto", "pieza"].includes(unidad))
      throw new Error(`[#${idx + 1}] unidad inválida`);
    if (!(factor_a_base > 0)) throw new Error(`[#${idx + 1}] factor_a_base debe ser > 0`);
    if (!(precio_unitario >= 0)) throw new Error(`[#${idx + 1}] precio_unitario debe ser >= 0`);

    return {
      producto_id,
      nombre,
      unidad,
      // Prisma Decimal acepta string | number; usamos string por seguridad
      factor_a_base: factor_a_base.toString(),
      precio_unitario: precio_unitario.toString(),
      codigo_barras,
      es_default,
      activo,
    };
  });

  // Aseguramos que si alguna viene con es_default=true, solo haya UNA por producto.
  // Estrategia: por cada producto involucrado, si se marca default en la tanda,
  // guardamos y ponemos el resto del mismo producto como no default.
  const productoIdsInBatch = Array.from(
    new Set(normalizados.map((n) => n.producto_id))
  );

  try {
    const result: any[] = [];

    // Usamos una transacción por producto para garantizar consistencia
    for (const pid of productoIdsInBatch) {
      const delProd = normalizados.filter((n) => n.producto_id === pid);

      await prisma.$transaction(async (tx) => {
        // Si alguno es default dentro de este producto, limpiamos previos
        const hayDefault = delProd.some((n) => n.es_default);
        if (hayDefault) {
          await tx.presentaciones_producto.updateMany({
            where: { producto_id: pid, es_default: true },
            data: { es_default: false },
          });
        }

        for (const n of delProd) {
          const created = await tx.presentaciones_producto.create({
            data: n,
            select: {
              id: true,
              producto_id: true,
              nombre: true,
              unidad: true,
              factor_a_base: true,
              precio_unitario: true,
              codigo_barras: true,
              es_default: true,
              activo: true,
            },
          });
          result.push(created);
        }
      });
    }

    return res.status(201).json(result.length === 1 ? result[0] : result);
  } catch (e: any) {
    console.error("presentaciones POST error:", e);
    // Prisma unique violation (p.ej. codigo_barras repetido)
    if (e?.code === "P2002") {
      return res
        .status(409)
        .json({ error: "Violación de único (¿código de barras duplicado?)" });
    }
    return res.status(500).json({ error: "No se pudieron crear las presentaciones" });
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") return handleGET(req, res);
  if (req.method === "POST") return handlePOST(req, res);
  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
