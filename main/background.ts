import path from "path";
import fs from "fs";
import { app, BrowserWindow, ipcMain } from "electron";
import serve from "electron-serve";
import { createWindow } from "./helpers";
// Use type-only imports to avoid bundling at build time
import type { PrismaClient as PrismaClientType } from "@prisma/client";
import bcrypt from "bcryptjs";

const isProd = process.env.NODE_ENV === "production";

// En producción, sirve la carpeta "app"
if (isProd) {
  serve({ directory: "app" });

// Router IPC para reemplazar Next API en producción
ipcMain.handle(
  "api:call",
  async (
    _event,
    req: { path: string; method: string; body?: any; headers?: Record<string, string> }
  ) => {
    try {
      const prisma = getPrisma();
      const rawPath = (req.path || "").toString();
      const reqPath = rawPath.toLowerCase();
      const method = (req.method || "GET").toUpperCase();
      const body = req.body || {};

      // Helper: serialize Prisma results to plain JSON so they can be sent via IPC
      const serialize = (v: any) => {
        try {
          return JSON.parse(JSON.stringify(v, (k, val) => {
            // Handle Prisma Decimal instances (if PrismaLib is available)
            try {
              if (val && typeof val === 'object') {
                if (typeof val.toJSON === 'function') return val.toJSON();
                // Fallback: Decimal-like objects have toFixed or toString
                if (typeof (val as any).toFixed === 'function') return (val as any).toString();
              }
            } catch (e) {
              // ignore
            }
            if (typeof val === 'bigint') return val.toString();
            return val;
          }));
        } catch (e) {
          try {
            return JSON.parse(JSON.stringify(v));
          } catch (e2) {
            return v;
          }
        }
      };

      const ok = (data: any) => ({ ok: true, data: data !== null && typeof data === 'object' ? serialize(data) : data });

      // Lightweight diagnostic logging for missing routes in production.
      // Will print path and method for incoming API calls (useful while testing packaged app).
      try {
        console.debug(`api:call incoming -> ${method} ${rawPath}`);
      } catch (e) {
        /* ignore logging errors */
      }

      // USUARIOS -------------------------------------------------------------
      if (reqPath === "/api/usuarios/listar" && method === "GET") {
        const usuarios = await prisma.usuarios.findMany({
          select: { id: true, nombre: true, usuario: true, rol: true, activo: true },
        });
  return ok(usuarios);
      }

      // AUTH - store (company info) --------------------------------------
      if (reqPath === "/api/auth/store" && method === "GET") {
        try {
          const config = await prisma.configuracion.findFirst();
          if (!config) return { ok: false, error: 'No se encontró la configuración de la tienda' };
          const payload = {
            nombre_empresa: config.nombre_empresa,
            logo: config.logo,
            direccion: config.direccion,
            telefono: config.telefono,
            rfc: config.rfc,
            moneda: config.moneda,
          };
          return ok(payload);
        } catch (err) {
          console.error('Error fetching auth store:', err);
          return { ok: false, error: 'Error interno' };
        }
      }

      if (reqPath === "/api/usuarios/crear" && method === "POST") {
        const { nombre, usuario, password, rol } = body;
        if (!nombre || !usuario || !password || !rol) {
          return { ok: false, error: "Faltan campos requeridos" };
        }
        const password_hash = await bcrypt.hash(password, 10);
        const nuevo = await prisma.usuarios.create({
          data: { nombre, usuario, password_hash, rol, activo: true },
        });
        return { ok: true, data: { id: nuevo.id } };
      }

      if (reqPath === "/api/usuarios/eliminar" && method === "DELETE") {
        const { id } = body;
        if (!id) return { ok: false, error: "ID requerido" };
        await prisma.usuarios.delete({ where: { id: Number(id) } });
        return { ok: true, data: { id } };
      }

      // PRODUCT REGISTER ----------------------------------------------------
      if (reqPath === "/api/productregister/categorias-listar" && method === "GET") {
        const categorias = await prisma.categorias.findMany({ orderBy: { nombre: "asc" } });
  return ok(categorias);
      }

      if (reqPath === "/api/productregister/productos-listar" && method === "GET") {
        const productos = await prisma.productos.findMany({
          orderBy: { id: "desc" },
        });
  return ok(productos);
      }

      if (reqPath === "/api/productregister/productos-alta" && method === "POST") {
        const {
          nombre,
          descripcion,
          categoria_id,
          unidad_base,
          stock_actual,
          stock_minimo,
          codigo_barras,
        } = body || {};
        if (!nombre || !descripcion || !categoria_id || !unidad_base) {
          return { ok: false, error: "Campos requeridos faltantes" };
        }
        const prod = await prisma.productos.create({
          data: {
            nombre,
            descripcion,
            categoria_id: Number(categoria_id),
            unidad_base,
            stock_actual: new PrismaLib.Decimal(stock_actual || 0),
            stock_minimo: new PrismaLib.Decimal(stock_minimo || 0),
            codigo_barras: codigo_barras || null,
          },
        });
  return ok({ id: prod.id });
      }

      if (reqPath === "/api/productregister/productos-eliminar" && method === "DELETE") {
        const { id } = body || {};
        if (!id) return { ok: false, error: "ID requerido" };
        await prisma.productos.delete({ where: { id: Number(id) } });
  return ok({ id });
      }

      // INVENTARIO - productos list (para inventario) ---------------------
      if (reqPath === "/api/inventario/productos-listar" && method === "GET") {
        try {
          const productos = await prisma.productos.findMany({
            include: { categoria: true, presentaciones: true },
            orderBy: { nombre: 'asc' }
          });

          const mapped = (productos || []).map((p: any) => ({
            ...p,
            stock_actual: p.stock_actual ? String(p.stock_actual) : '0',
            stock_minimo: p.stock_minimo ? String(p.stock_minimo) : '0',
            presentaciones: (p.presentaciones || []).map((pr: any) => ({
              ...pr,
              factor_a_base: pr.factor_a_base ? String(pr.factor_a_base) : '0',
              precio_unitario: pr.precio_unitario ? String(pr.precio_unitario) : '0'
            }))
          }));

          return ok(mapped);
        } catch (err) {
          console.error('Error listar productos inventario IPC:', err);
          return { ok: false, error: 'Error al listar productos' };
        }
      }

      // INVENTARIO - movimientos listar ----------------------------------
      if (reqPath.startsWith("/api/inventario/movimientos-listar") && method === "GET") {
        try {
          const url = new URL(`http://x${rawPath}`);
          const productoId = url.searchParams.get('producto_id');
          const where: any = {};
          if (productoId) where.producto_id = Number(productoId);

          const movimientos = await prisma.inventario_movimientos.findMany({
            where,
            orderBy: { fecha: 'desc' },
            include: { presentacion: true, producto: true }
          });

          return ok(movimientos);
        } catch (err) {
          console.error('Error listar movimientos IPC:', err);
          return { ok: false, error: 'Error al listar movimientos' };
        }
      }

      // INVENTARIO - ajustar stock ---------------------------------------
      if (reqPath === "/api/inventario/ajustar-stock" && method === "POST") {
        try {
          const { producto_id, presentacion_id, cantidad, tipo, razon } = body || {};
          if (!producto_id || !cantidad || !tipo) return { ok: false, error: 'Faltan campos requeridos' };

          const qty = Number(cantidad);
          if (isNaN(qty) || qty === 0) return { ok: false, error: 'Cantidad inválida' };

          const producto = await prisma.productos.findUnique({ where: { id: Number(producto_id) } });
          if (!producto) return { ok: false, error: 'Producto no encontrado' };

          let nuevoStock = Number(producto.stock_actual || 0);
          if (tipo === 'entrada') nuevoStock += qty;
          else if (tipo === 'salida') nuevoStock -= qty;
          else if (tipo === 'ajuste') nuevoStock = qty;

          const stockValue = PrismaLib && PrismaLib.Decimal ? new PrismaLib.Decimal(nuevoStock) : Number(nuevoStock);
          await prisma.productos.update({ where: { id: Number(producto_id) }, data: { stock_actual: stockValue } });

          const movimiento = await prisma.inventario_movimientos.create({
            data: {
              producto_id: Number(producto_id),
              presentacion_id: presentacion_id ? Number(presentacion_id) : null,
              tipo_movimiento: tipo,
              cantidad_base: qty,
              comentario: razon || '',
              fecha: new Date()
            }
          });

          return ok({ message: 'Stock actualizado', movimiento });
        } catch (err) {
          console.error('Error ajustar stock IPC:', err);
          return { ok: false, error: 'Error al ajustar stock' };
        }
      }

      // SALES - productos (lista para ventas) -------------------------------
      if (reqPath === "/api/sales/productos" && method === "GET") {
        try {
          const productos = await prisma.productos.findMany({
            where: {
              stock_actual: { gt: 0 },
            },
            include: {
              categoria: true,
              presentaciones: {
                where: { activo: true },
                orderBy: { es_default: 'desc' },
              },
            },
            orderBy: { nombre: 'asc' },
          });
          return ok(productos);
        } catch (err) {
          console.error('Error fetching sales productos:', err);
          return { ok: false, error: 'Error al obtener productos para ventas' };
        }
      }

      // SALES - crear venta ----------------------------------------------
      if (reqPath === "/api/sales" && method === "POST") {
        try {
          const { usuario_id, metodo_pago, items, descuento_porcentaje } = body || {};
          if (!usuario_id || !metodo_pago || !items || !Array.isArray(items) || items.length === 0) {
            return { ok: false, error: 'Datos incompletos' };
          }

          let subtotal = 0;
          const detalleData: any[] = [];

          for (const item of items) {
            const presentacion = await prisma.presentaciones_producto.findUnique({ where: { id: Number(item.presentacion_id) }, include: { producto: true } });
            if (!presentacion) return { ok: false, error: `Presentación ${item.presentacion_id} no encontrada` };
            const itemSubtotal = Number(presentacion.precio_unitario) * Number(item.cantidad);
            subtotal += itemSubtotal;
            detalleData.push({
              producto_id: presentacion.producto_id,
              presentacion_id: Number(item.presentacion_id),
              cantidad_presentacion: Number(item.cantidad),
              precio_unitario: presentacion.precio_unitario,
              subtotal: itemSubtotal,
            });
          }

          const descuentoPorcentajeVal = descuento_porcentaje || 0;
          const descuentoMonto = (subtotal * descuentoPorcentajeVal) / 100;
          const total = subtotal - descuentoMonto;

          const venta = await prisma.ventas.create({
            data: {
              usuario_id: Number(usuario_id),
              fecha: new Date(),
              total,
              metodo_pago,
              detalle: { create: detalleData }
            },
            include: {
              detalle: { include: { producto: true, presentacion: true } },
              usuario: { select: { id: true, nombre: true, usuario: true } }
            }
          });

          const ventaConDescuento = { ...venta, subtotal, descuento_porcentaje: descuentoPorcentajeVal, descuento_monto: descuentoMonto };

          // actualizar inventario y movimientos
          for (const item of items) {
            const presentacion = await prisma.presentaciones_producto.findUnique({ where: { id: Number(item.presentacion_id) } });
            const cantidadBase = Number(presentacion.factor_a_base) * Number(item.cantidad);

            // actualizar stock
            await prisma.productos.update({ where: { id: presentacion.producto_id }, data: { stock_actual: { decrement: cantidadBase } } });

            // crear movimiento
            await prisma.inventario_movimientos.create({ data: {
              producto_id: presentacion.producto_id,
              presentacion_id: Number(item.presentacion_id),
              tipo_movimiento: 'salida',
              cantidad_base: cantidadBase,
              fecha: new Date(),
              comentario: `Venta #${venta.id}`
            }});
          }

          return ok(ventaConDescuento);
        } catch (err) {
          console.error('Error creating sale IPC:', err);
          return { ok: false, error: 'Error al crear la venta' };
        }
      }

      // ALTA PRODUCTOS (helpers) -------------------------------------------
      if (reqPath === "/api/alta-productos/categorias-alta" && method === "POST") {
        const { nombre, descripcion } = body || {};
        if (!nombre) return { ok: false, error: "Nombre requerido" };
        const cat = await prisma.categorias.create({ data: { nombre, descripcion: descripcion || "" } });
  return ok({ id: cat.id, nombre: cat.nombre });
      }

      if (reqPath.startsWith("/api/alta-productos/productos-detalle") && method === "GET") {
        // Espera query ?id=...
        const url = new URL(`http://x${reqPath}`); // prefijo dummy para parsear
        const idStr = url.searchParams.get("id");
        const id = Number(idStr || 0);
        if (!id) return { ok: false, error: "ID inválido" };
        const prod = await prisma.productos.findUnique({
          where: { id },
          include: { presentaciones: true, categoria: true },
        });
  return ok(prod);
      }

      if (reqPath === "/api/alta-productos/presentaciones" && method === "POST") {
        const payload = Array.isArray(body) ? body : [];
        if (!payload.length) return { ok: false, error: "Datos inválidos" };
        const created = await prisma.presentaciones_producto.createMany({ data: payload });
  return ok(created);
      }

      // CONFIGURACIÓN ------------------------------------------------------
      if (reqPath.startsWith("/api/config/configuracion") && method === "GET") {
        try {
          const config = await prisma.configuracion.findFirst();
          return ok(config);
        } catch (err) {
          console.error('Error fetching configuracion:', err);
          return { ok: false, error: 'Error al obtener configuración' };
        }
      }

      if (reqPath.startsWith("/api/config/configuracion") && method === "PUT") {
        try {
          const { nombre_empresa, logo, direccion, telefono, rfc, moneda } = body || {};
          const existing = await prisma.configuracion.findFirst();
          if (!existing) {
            // If no existing config, create one
            const created = await prisma.configuracion.create({ data: { nombre_empresa: nombre_empresa || '', logo: logo || '', direccion: direccion || '', telefono: telefono || '', rfc: rfc || '', moneda: moneda || 'MXN' } });
            return ok(created);
          }
          const updated = await prisma.configuracion.update({ where: { id: existing.id }, data: { nombre_empresa, logo, direccion, telefono, rfc, moneda } });
          return ok(updated);
        } catch (err) {
          console.error('Error updating configuracion:', err);
          return { ok: false, error: 'Error al actualizar configuración' };
        }
      }

      // REPORTES ----------------------------------------------------------
      if (reqPath === "/api/reportes/ventas-dia" && method === "GET") {
        try {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayEnd = new Date();
          todayEnd.setHours(23, 59, 59, 999);

          const detalles = await prisma.detalle_venta.findMany({
            where: { venta: { fecha: { gte: todayStart, lte: todayEnd } } },
            include: { producto: true, presentacion: true, venta: true },
          });

          const agrupado: Record<string, { productoId: number; nombre: string; cantidad: number; total: number }> = {};
          detalles.forEach((d: any) => {
            const pid = d.producto_id;
            const key = String(pid);
            const cantidad = Number(d.cantidad_presentacion || 0);
            const total = Number(d.subtotal || 0);
            if (!agrupado[key]) agrupado[key] = { productoId: pid, nombre: d.producto?.nombre || 'Producto', cantidad: 0, total: 0 };
            agrupado[key].cantidad += cantidad;
            agrupado[key].total += total;
          });

          const rows = Object.values(agrupado);
          return ok({ fecha: new Date(), filas: rows });
        } catch (err) {
          console.error('Error en ventas-dia:', err);
          return { ok: false, error: 'Error al obtener reporte de ventas del día' };
        }
      }

      // REPORTES - ventas historico -------------------------------------
      if (reqPath.startsWith("/api/reportes/ventas-historico") && method === "GET") {
        try {
          // parse query params from raw path (may include ?start=...&end=...)
          const url = new URL(`http://x${rawPath}`);
          const start = url.searchParams.get('start');
          const end = url.searchParams.get('end');
          if (!start || !end) return { ok: false, error: 'start y end son requeridos (YYYY-MM-DD)' };

          const parseLocalDate = (dStr: string) => {
            const [y, m, d] = dStr.split('-').map(Number);
            return new Date(y, (m - 1), d, 0, 0, 0, 0);
          };
          const endOfDayLocal = (date: Date) => {
            return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
          };
          const nextDayLocal = (date: Date) => {
            return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
          };

          const startDate = parseLocalDate(start);
          const endDate = parseLocalDate(end);
          const endExclusive = nextDayLocal(endDate);

          const detalles = await prisma.detalle_venta.findMany({
            where: { venta: { fecha: { gte: startDate, lt: endExclusive } } },
            include: { producto: true, venta: true },
          });

          const byDayMap: Record<string, { fecha: string; cantidad: number; total: number }> = {};
          const byProductMap: Record<string, { productoId: number; nombre: string; cantidad: number; total: number }> = {};

          for (const d of detalles) {
            const vf = new Date(d.venta.fecha);
            const key = `${vf.getFullYear()}-${String(vf.getMonth() + 1).padStart(2,'0')}-${String(vf.getDate()).padStart(2,'0')}`;
            const cantidad = Number(d.cantidad_presentacion ?? 0);
            const total = Number(d.subtotal ?? d.venta?.total ?? 0);

            if (!byDayMap[key]) byDayMap[key] = { fecha: key, cantidad: 0, total: 0 };
            byDayMap[key].cantidad += cantidad;
            byDayMap[key].total += total;

            const pid = d.producto_id ?? d.producto?.id;
            const nombre = d.producto?.nombre ?? 'Producto';
            const pkey = String(pid ?? nombre);
            if (!byProductMap[pkey]) byProductMap[pkey] = { productoId: pid ?? 0, nombre, cantidad: 0, total: 0 };
            byProductMap[pkey].cantidad += cantidad;
            byProductMap[pkey].total += total;
          }

          const result = {
            start: startDate.toISOString(),
            end: endOfDayLocal(endDate).toISOString(),
            byDay: Object.values(byDayMap).sort((a,b)=>a.fecha.localeCompare(b.fecha)),
            byProduct: Object.values(byProductMap).sort((a,b)=>b.total - a.total),
          };
          return ok(result);
        } catch (err) {
          console.error('Error ventas-historico IPC:', err);
          return { ok: false, error: 'Error al obtener reporte histórico' };
        }
      }

      // GESTION PRODUCTOS - PRESENTACIONES --------------------------------
      if (reqPath === "/api/gestion-productos/presentaciones-listar" && method === "GET") {
        try {
          // parse query product_id if present
          const url = new URL(`http://x${reqPath}`);
          const productoId = url.searchParams.get('producto_id');
          const whereClause: any = {};
          if (productoId) whereClause.producto_id = Number(productoId);

          const presentaciones = await prisma.presentaciones_producto.findMany({
            where: whereClause,
            include: {
              producto: {
                select: {
                  id: true,
                  nombre: true,
                  categoria: { select: { id: true, nombre: true } },
                },
              },
            },
            orderBy: [{ es_default: 'desc' }, { nombre: 'asc' }],
          });
          return ok(presentaciones);
        } catch (err) {
          console.error('Error listando presentaciones:', err);
          return { ok: false, error: 'Error al listar presentaciones' };
        }
      }

      if (reqPath.startsWith("/api/gestion-productos/presentaciones-detalle") && method === "GET") {
        try {
          const url = new URL(`http://x${reqPath}`);
          const idStr = url.searchParams.get('id');
          const id = Number(idStr || 0);
          if (!id) return { ok: false, error: 'ID inválido' };
          const presentacion = await prisma.presentaciones_producto.findUnique({
            where: { id },
            include: { producto: { include: { categoria: { select: { id: true, nombre: true } } } } },
          });
          if (!presentacion) return { ok: false, error: 'Presentación no encontrada' };
          return ok(presentacion);
        } catch (err) {
          console.error('Error obteniendo detalle presentacion:', err);
          return { ok: false, error: 'Error al obtener la presentación' };
        }
      }

      if (reqPath === "/api/gestion-productos/presentaciones-toggle" && method === "PUT") {
        try {
          const { id } = body || {};
          if (!id) return { ok: false, error: 'ID requerido' };
          const actual = await prisma.presentaciones_producto.findUnique({ where: { id: Number(id) } });
          if (!actual) return { ok: false, error: 'Presentación no encontrada' };
          const nuevoEstado = !actual.activo;
          const updated = await prisma.presentaciones_producto.update({
            where: { id: Number(id) },
            data: { activo: nuevoEstado },
            include: { producto: { select: { id: true, nombre: true } } },
          });
          return ok({ message: `Presentación ${nuevoEstado ? 'activada' : 'desactivada'} correctamente`, presentacion: updated });
        } catch (err) {
          console.error('Error toggling presentacion:', err);
          return { ok: false, error: 'Error al cambiar estado de la presentacion' };
        }
      }

      if (reqPath === "/api/gestion-productos/presentaciones-editar" && method === "PUT") {
        try {
          const { id, nombre, unidad, factor_a_base, precio_unitario, codigo_barras, es_default } = body || {};
          if (!id || !nombre || !unidad || factor_a_base == null || precio_unitario == null) {
            return { ok: false, error: 'Faltan campos requeridos' };
          }
          if (Number(factor_a_base) <= 0) return { ok: false, error: 'Factor a base debe ser mayor que 0' };
          if (Number(precio_unitario) < 0) return { ok: false, error: 'Precio unitario no puede ser negativo' };

          if (es_default) {
            const presentacionActual = await prisma.presentaciones_producto.findUnique({ where: { id: Number(id) } });
            if (presentacionActual) {
              await prisma.presentaciones_producto.updateMany({
                where: { producto_id: presentacionActual.producto_id, id: { not: Number(id) } },
                data: { es_default: false },
              });
            }
          }

          const updated = await prisma.presentaciones_producto.update({
            where: { id: Number(id) },
            data: {
              nombre: String(nombre).trim(),
              unidad,
              factor_a_base: Number(factor_a_base),
              precio_unitario: Number(precio_unitario),
              codigo_barras: codigo_barras ? String(codigo_barras).trim() : null,
              es_default: Boolean(es_default),
            },
            include: { producto: { select: { id: true, nombre: true } } },
          });
          return ok({ message: 'Presentación actualizada correctamente', presentacion: updated });
        } catch (err: any) {
          console.error('Error editing presentacion:', err);
          if (err && err.code === 'P2002') return { ok: false, error: 'Código de barras ya existe' };
          return { ok: false, error: 'Error al actualizar la presentación' };
        }
      }

      if (reqPath === "/api/gestion-productos/presentaciones-eliminar" && method === "DELETE") {
        try {
          const { id } = body || {};
          if (!id) return { ok: false, error: 'ID requerido' };
          const presentacion = await prisma.presentaciones_producto.findUnique({ where: { id: Number(id) }, include: { producto: { select: { id: true, nombre: true } } } });
          if (!presentacion) return { ok: false, error: 'Presentación no encontrada' };

          const ventasAsociadas = await prisma.detalle_venta.count({ where: { presentacion_id: Number(id) } });
          if (ventasAsociadas > 0) return { ok: false, error: 'No se puede eliminar la presentación porque tiene ventas asociadas. Puede desactivarla en su lugar.' };

          const movimientosAsociados = await prisma.inventario_movimientos.count({ where: { presentacion_id: Number(id) } });
          if (movimientosAsociados > 0) return { ok: false, error: 'No se puede eliminar la presentación porque tiene movimientos de inventario asociados. Puede desactivarla en su lugar.' };

          await prisma.presentaciones_producto.delete({ where: { id: Number(id) } });
          return ok({ message: 'Presentación eliminada correctamente', presentacion });
        } catch (err) {
          console.error('Error eliminando presentacion:', err);
          return { ok: false, error: 'Error al eliminar la presentación' };
        }
      }

      // No match
      return { ok: false, error: `Ruta no soportada: ${reqPath} ${method}` };
    } catch (err) {
      console.error("api:call error", err);
      return { ok: false, error: (err as any)?.message || "Error interno" };
    }
  }
);
} else {
  app.setPath("userData", `${app.getPath("userData")} (development)`);
}

// Ruta global de la base de datos (se resuelve en runtime)
let dbPath = "";
let prisma: PrismaClientType | null = null;
let PrismaLib: any = null;

function getPrisma(): PrismaClientType {
  if (!prisma) {
    if (!dbPath) {
      throw new Error("DATABASE_URL no inicializada: dbPath vacío");
    }
    // Asegura que Prisma apunte a la DB del usuario
    process.env.DATABASE_URL = `file:${dbPath.replace(/\\\\/g, "/")}`;
    // Important: require at runtime to avoid webpack bundling
    // Try normal require first; if the app is packaged inside an asar the
    // @prisma/client runtime may be unpacked to app.asar.unpacked and Node's
    // resolver can't load some files from inside the asar. Fall back to the
    // unpacked path when available.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const runtimeRequire = (eval("require") as NodeRequire);
    let runtime: typeof import("@prisma/client");
    try {
      runtime = runtimeRequire("@prisma/client");
    } catch (err) {
      // Attempt to require from the unpacked asar path: resourcesPath/app.asar.unpacked/node_modules/@prisma/client
      try {
        const unpackedPath = path.join(process.resourcesPath, "app.asar.unpacked", "node_modules", "@prisma", "client");
        if (fs.existsSync(unpackedPath)) {
          runtime = runtimeRequire(unpackedPath) as typeof import("@prisma/client");
        } else {
          // Some builders place unpacked modules directly under resourcesPath/node_modules
          const altPath = path.join(process.resourcesPath, "node_modules", "@prisma", "client");
          if (fs.existsSync(altPath)) {
            runtime = runtimeRequire(altPath) as typeof import("@prisma/client");
          } else {
            throw err;
          }
        }
      } catch (err2) {
        console.error("Failed to require @prisma/client at runtime:", err2);
        throw err2;
      }
    }
    PrismaLib = runtime.Prisma;
    prisma = new runtime.PrismaClient();
  }
  return prisma;
}

(async () => {
  await app.whenReady();

  // Carpeta persistente del usuario
  const userDataPath = app.getPath("userData");
  const dbFolder = path.join(userDataPath, "db");
  dbPath = path.join(dbFolder, "jabem.db");

  // Asegurar carpeta
  if (!fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder, { recursive: true });
  }

  // Ruta de la DB semilla:
  // - En dev: el archivo del repo (main/db/jabem.dev.db)
  // - En prod: el que empaquetamos con extraResources (process.resourcesPath/db-seed/jabem.dev.db)
  const seedDbPath = isProd
    ? path.join(process.resourcesPath, "db-seed", "jabem.dev.db")
    : path.join(__dirname, "../db/jabem.dev.db");

  // Primera ejecución: copiar semilla si no existe la DB del usuario
  if (!fs.existsSync(dbPath)) {
    try {
      if (fs.existsSync(seedDbPath)) {
        fs.copyFileSync(seedDbPath, dbPath);
        console.log("✅ Base de datos inicial copiada a:", dbPath);
      } else {
        console.warn("⚠️ Seed DB no encontrada en:", seedDbPath);
      }
    } catch (err) {
      console.error("❌ Error al copiar base de datos inicial:", err);
    }
  }

  console.log("📦 Ruta activa de base de datos:", dbPath);

  // Ventana principal
  const mainWindow: BrowserWindow = createWindow("main", {
    width: 1000,
    height: 600,
    icon: path.join(__dirname, "images", "logo.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (isProd) {
    await mainWindow.loadURL("app://./home");
  } else {
    const port = process.argv[2];
    await mainWindow.loadURL(`http://localhost:${port}/home`);
    mainWindow.webContents.openDevTools();
  }
})();

app.on("window-all-closed", () => {
  app.quit();
});

// Exponer la ruta de DB si la necesitas en renderer
ipcMain.handle("get-db-path", async () => dbPath);

// Autenticación vía IPC para producción (sin Next API)
ipcMain.handle("auth:login", async (_event, payload: { usuario: string; password: string }) => {
  try {
    const prisma = getPrisma();
    const { usuario, password } = payload || ({} as any);
    if (!usuario || !password) {
      return { ok: false, error: "Parámetros inválidos" };
    }
    const user = await prisma.usuarios.findUnique({ where: { usuario } });
    if (!user) {
      return { ok: false, error: "Usuario o contraseña inválidos" };
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return { ok: false, error: "Usuario o contraseña inválidos" };
    }
    // Retorna info mínima del usuario
    return {
      ok: true,
      data: {
        id: user.id,
        nombre: user.nombre,
        usuario: user.usuario,
        rol: user.rol,
        activo: user.activo,
      },
    };
  } catch (err) {
    console.error("IPC auth:login error", err);
    return { ok: false, error: (err as any)?.message || "Error interno" };
  }
});
