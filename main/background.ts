import path from "path";
import fs from "fs";
import { app, BrowserWindow, ipcMain } from "electron";
import serve from "electron-serve";
import { createWindow } from "./helpers";
// Use type-only imports to avoid bundling at build time
import type { PrismaClient as PrismaClientType } from "@prisma/client";
import bcrypt from "bcryptjs";

const isProd = process.env.NODE_ENV === "production";

// Forward main-process console output to renderer windows for easier debugging
// The renderer can subscribe via: window.ipc.on('main-log', (payload) => console.log('main-log', payload))
(() => {
  try {
    const origConsole = {
      log: console.log.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      debug: (console as any).debug ? (console as any).debug.bind(console) : console.log.bind(console),
      info: (console as any).info ? (console as any).info.bind(console) : console.log.bind(console),
    };

    const safeSerialize = (v: any) => {
      try {
        if (typeof v === 'bigint') return v.toString();
        if (v instanceof Error) return { message: v.message, stack: v.stack };
        // Prisma Decimal and other objects often break structured clone; try toJSON / toString
        if (v && typeof v === 'object') {
          if (typeof (v as any).toJSON === 'function') return (v as any).toJSON();
          if (typeof (v as any).toString === 'function' && !(v instanceof Array)) {
            // Avoid calling toString on arrays of objects
            const s = (v as any).toString();
            // If toString returns [object Object], fallback to JSON stringify
            if (s && !/^\[object/.test(s)) return s;
          }
        }
        return JSON.parse(JSON.stringify(v, (_k, val) => {
          if (typeof val === 'bigint') return val.toString();
          if (val && typeof (val as any).toJSON === 'function') return (val as any).toJSON();
          return val;
        }));
      } catch (e) {
        try { return String(v); } catch (e2) { return '[unserializable]'; }
      }
    };

    ['log','error','warn','debug','info'].forEach((level) => {
      (console as any)[level] = (...args: any[]) => {
        try { (origConsole as any)[level](...args); } catch (e) { /* ignore */ }
        try {
          const payload = args.map(a => safeSerialize(a));
          const windows = BrowserWindow.getAllWindows();
          for (const w of windows) {
            if (w && w.webContents && !w.isDestroyed()) {
              try { w.webContents.send('main-log', { level, args: payload }); } catch (e) { /* ignore send errors */ }
            }
          }
        } catch (e) {
          /* ignore forwarding errors */
        }
      };
    });
  } catch (e) {
    // If anything fails here, don't block startup
    console.warn('Could not install main->renderer console forwarder', e);
  }
})();

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
      // Wait for DB bootstrap (migrations + seeder) to complete in startup
      try {
        if (typeof (global as any).__dbReadyPromise === 'object' && (global as any).__dbReadyPromise) {
          await (global as any).__dbReadyPromise;
        }
      } catch (e) {
        // ignore waiting errors and continue to try to use Prisma; we'll return helpful errors below if DB missing
      }
      let prisma: any = null;
      try {
        prisma = getPrisma();
      } catch (e) {
        console.error('getPrisma() failed inside api:call handler:', e);
        return { ok: false, error: 'DB not initialized: ' + ((e && (e as any).message) || String(e)) };
      }
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
        // Allow precio_compra to be passed from the renderer
        const precio_compra_raw = (body && (body.precio_compra ?? body.precioCompra)) ?? 0;
        const precio_compra_value = Number(precio_compra_raw) || 0;
        const prod = await prisma.productos.create({
          data: {
            nombre,
            descripcion,
            categoria_id: Number(categoria_id),
            unidad_base,
            stock_actual: PrismaLib && PrismaLib.Decimal ? new PrismaLib.Decimal(stock_actual || 0) : Number(stock_actual || 0),
            stock_minimo: PrismaLib && PrismaLib.Decimal ? new PrismaLib.Decimal(stock_minimo || 0) : Number(stock_minimo || 0),
            // precio_compra stored as Decimal in DB
            precio_compra: PrismaLib && PrismaLib.Decimal ? new PrismaLib.Decimal(precio_compra_value) : precio_compra_value,
            codigo_barras: codigo_barras || null,
          },
        });
  return ok({ id: prod.id });
      }

      if (reqPath === "/api/productregister/productos-editar" && method === "PUT") {
        const {
          id,
          nombre,
          descripcion,
          categoria_id,
          unidad_base,
          stock_actual,
          stock_minimo,
          codigo_barras,
        } = body || {};
        if (!id) return { ok: false, error: 'ID requerido' };
        try {
          const data: any = {};
          if (nombre !== undefined) data.nombre = nombre;
          if (descripcion !== undefined) data.descripcion = descripcion;
          if (categoria_id !== undefined) data.categoria_id = Number(categoria_id);
          if (unidad_base !== undefined) data.unidad_base = unidad_base;
          if (stock_actual !== undefined) data.stock_actual = PrismaLib && PrismaLib.Decimal ? new PrismaLib.Decimal(stock_actual || 0) : Number(stock_actual || 0);
          if (stock_minimo !== undefined) data.stock_minimo = PrismaLib && PrismaLib.Decimal ? new PrismaLib.Decimal(stock_minimo || 0) : Number(stock_minimo || 0);
          if (codigo_barras !== undefined) data.codigo_barras = codigo_barras || null;
          if ((body && (body.precio_compra ?? body.precioCompra)) !== undefined) {
            const precioVal = Number((body.precio_compra ?? body.precioCompra) || 0);
            data.precio_compra = PrismaLib && PrismaLib.Decimal ? new PrismaLib.Decimal(precioVal) : precioVal;
          }
          const updated = await prisma.productos.update({ where: { id: Number(id) }, data });
          return ok({ id: updated.id });
        } catch (e: any) {
          console.error('Error updating product (api:call):', e);
          return { ok: false, error: e?.message || 'Error actualizando producto' };
        }
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
          // Enhanced diagnostics: log DB path, basic connectivity probe and full stack
          try { console.error('Error fetching sales productos:', err); } catch (e) { /* ignore */ }
          try { console.error('DB path (main):', dbPath); } catch (e) { /* ignore */ }

          // Try a lightweight probe to see if the DB is reachable
          try {
            const probe = await prisma.$queryRaw`SELECT 1 as ok`;
            console.debug('DB probe result:', probe);
          } catch (probeErr) {
            console.error('DB probe failed:', probeErr);
          }

          const message = (err && (err as any).message) ? (err as any).message : 'Error al obtener productos para ventas';
          const stack = (err && (err as any).stack) ? (err as any).stack : undefined;
          if (stack) console.error('Stack:', stack);
          return { ok: false, error: message };
        }
      }

      // SALES - crear venta ----------------------------------------------
      if (reqPath === "/api/sales" && method === "POST") {
        try {
          const { usuario_id, metodo_pago, items, descuento_porcentaje } = body || {};
          if (!usuario_id || !metodo_pago || !items || !Array.isArray(items) || items.length === 0) {
            return { ok: false, error: 'Datos incompletos' };
          }

          // 1) Cargar todas las presentaciones involucradas en una sola consulta
          const presentacionIds = Array.from(new Set(items.map((it: any) => Number(it.presentacion_id))));
          const presentaciones = await prisma.presentaciones_producto.findMany({ where: { id: { in: presentacionIds } }, include: { producto: true } });
          const presMap: Record<number, any> = {};
          presentaciones.forEach((p: any) => (presMap[p.id] = p));

          // Verificar que todas las presentaciones existan
          for (const pid of presentacionIds) {
            if (!presMap[pid]) return { ok: false, error: `Presentación ${pid} no encontrada` };
          }

          // 2) Calcular demanda agregada por producto en unidades base
          const demandaPorProducto: Record<number, number> = {};
          let subtotal = 0;
          const detalleData: any[] = [];

          for (const item of items) {
            const pid = Number(item.presentacion_id);
            const pres = presMap[pid];
            const cantidadPresentacion = Number(item.cantidad) || 0;
            const factorBase = Number(pres.factor_a_base) || 1;
            const cantidadBase = factorBase * cantidadPresentacion;

            // acumular demanda por producto
            demandaPorProducto[pres.producto_id] = (demandaPorProducto[pres.producto_id] || 0) + cantidadBase;

            const itemSubtotal = Number(pres.precio_unitario) * cantidadPresentacion;
            subtotal += itemSubtotal;

            detalleData.push({
              producto_id: pres.producto_id,
              presentacion_id: pid,
              cantidad_presentacion: cantidadPresentacion,
              precio_unitario: Number(pres.precio_unitario),
              // store precio_compra at time of sale so historical reports remain accurate
              precio_compra: Number((pres.producto && (pres.producto.precio_compra ?? pres.producto.precioCompra)) || 0),
              subtotal: itemSubtotal,
            });
          }

          // 3) Consultar stocks actuales de los productos afectados
          const productIds = Object.keys(demandaPorProducto).map((s) => Number(s));
          const productos = await prisma.productos.findMany({ where: { id: { in: productIds } } });
          const prodMap: Record<number, any> = {};
          productos.forEach((p: any) => (prodMap[p.id] = p));

          // 4) Detectar insuficiencias
          const insuficientes: Array<{ producto_id: number; nombre: string; disponible: number; requerido: number }> = [];
          for (const prodId of productIds) {
            const disponible = Number(prodMap[prodId]?.stock_actual || 0);
            const requerido = Number(demandaPorProducto[prodId] || 0);
            if (requerido > disponible) {
              insuficientes.push({ producto_id: prodId, nombre: prodMap[prodId]?.nombre || 'Producto', disponible, requerido });
            }
          }

          if (insuficientes.length > 0) {
            return { ok: false, error: 'Stock insuficiente', details: insuficientes };
          }

          // 5) Todo ok: crear venta + detalle y actualizar stock + movimientos dentro de una transacción
          const descuentoPorcentajeVal = descuento_porcentaje || 0;
          const descuentoMonto = (subtotal * descuentoPorcentajeVal) / 100;
          const total = subtotal - descuentoMonto;

          const result = await prisma.$transaction(async (tx) => {
            const createdVenta = await tx.ventas.create({
              data: {
                usuario_id: Number(usuario_id),
                fecha: new Date(),
                subtotal,
                descuento_porcentaje: descuentoPorcentajeVal,
                descuento_monto: descuentoMonto,
                total,
                metodo_pago,
                detalle: { create: detalleData }
              },
              include: {
                detalle: { include: { producto: true, presentacion: true } },
                usuario: { select: { id: true, nombre: true, usuario: true } }
              }
            });

            // actualizar stock por producto (decrementando la cantidad en base)
            for (const prodId of productIds) {
              const requerido = Number(demandaPorProducto[prodId] || 0);
              if (requerido === 0) continue;
              await tx.productos.update({ where: { id: prodId }, data: { stock_actual: { decrement: requerido } } });
            }

            // crear movimientos por cada detalle (por presentacion)
            for (const d of detalleData) {
              const pres = presMap[d.presentacion_id];
              const cantidadBase = (Number(pres.factor_a_base) || 1) * Number(d.cantidad_presentacion || 0);
              await tx.inventario_movimientos.create({ data: {
                producto_id: d.producto_id,
                presentacion_id: d.presentacion_id,
                tipo_movimiento: 'salida',
                cantidad_base: cantidadBase,
                fecha: new Date(),
                comentario: `Venta #${createdVenta.id}`
              }});
            }

            return createdVenta;
          });

          const ventaConDescuento = { ...result, subtotal, descuento_porcentaje: descuentoPorcentajeVal, descuento_monto: descuentoMonto };
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

          // Obtener ventas del día con sus detalles
          const ventas = await prisma.ventas.findMany({
            where: { fecha: { gte: todayStart, lte: todayEnd } },
            include: { 
              detalle: { 
                include: { producto: true, presentacion: true } 
              } 
            },
          });

          // Agregar información de descuentos por producto
          const agrupado: Record<string, { 
            productoId: number; 
            nombre: string; 
            cantidad: number; 
            precioVenta: number; // precio antes de descuento
            descuentoPorcentaje: number; // descuento promedio ponderado
            precioFinal: number; // precio después de descuento
            costo: number; 
            ganancia: number;
            margenPorcentaje: number;
          }> = {};

          let totalSinDescuento = 0;
          let totalConDescuento = 0;

          ventas.forEach((venta: any) => {
            const ventaSubtotal = Number(venta.subtotal || 0);
            const ventaDescuentoPct = Number(venta.descuento_porcentaje || 0);
            const ventaTotal = Number(venta.total || 0);

            totalSinDescuento += ventaSubtotal;
            totalConDescuento += ventaTotal;

            venta.detalle.forEach((d: any) => {
              try {
                const pid = d.producto_id;
                const key = String(pid);
                const cantidadPresentacion = Number(d.cantidad_presentacion || 0);
                const subtotalDetalle = Number(d.subtotal || 0);
                
                // Calcular el precio de venta unitario antes de descuento
                const precioVentaUnitario = cantidadPresentacion > 0 ? subtotalDetalle / cantidadPresentacion : 0;
                
                // Calcular descuento aplicado a este detalle (proporcional)
                const descuentoDetalle = ventaDescuentoPct > 0 ? (subtotalDetalle * ventaDescuentoPct) / 100 : 0;
                const totalFinalDetalle = subtotalDetalle - descuentoDetalle;
                const precioFinalUnitario = cantidadPresentacion > 0 ? totalFinalDetalle / cantidadPresentacion : 0;

                // Costo
                const factorBase = Number(d.presentacion?.factor_a_base ?? 1);
                const cantidadBase = factorBase * cantidadPresentacion;
                const precioCompra = Number((d.precio_compra ?? (d.producto as any)?.precio_compra) ?? 0);
                const costoTotal = cantidadBase * precioCompra;

                if (!agrupado[key]) {
                  agrupado[key] = { 
                    productoId: pid, 
                    nombre: d.producto?.nombre || 'Producto', 
                    cantidad: 0, 
                    precioVenta: 0,
                    descuentoPorcentaje: 0,
                    precioFinal: 0,
                    costo: 0, 
                    ganancia: 0,
                    margenPorcentaje: 0
                  };
                }

                const item = agrupado[key];
                
                // Promedios ponderados
                const nuevaCantidad = item.cantidad + cantidadPresentacion;
                item.precioVenta = ((item.precioVenta * item.cantidad) + (precioVentaUnitario * cantidadPresentacion)) / nuevaCantidad;
                item.precioFinal = ((item.precioFinal * item.cantidad) + (precioFinalUnitario * cantidadPresentacion)) / nuevaCantidad;
                item.cantidad = nuevaCantidad;
                item.costo += costoTotal;
                
                // Calcular descuento promedio ponderado
                if (item.precioVenta > 0) {
                  item.descuentoPorcentaje = ((item.precioVenta - item.precioFinal) / item.precioVenta) * 100;
                }
                
                item.ganancia = (item.precioFinal * item.cantidad) - item.costo;
                item.margenPorcentaje = item.precioFinal > 0 ? (item.ganancia / (item.precioFinal * item.cantidad)) * 100 : 0;
              } catch (e) {
                console.error('Error procesando detalle_venta (ventas-dia) id=', (d && d.id) || null, e);
              }
            });
          });

          const filas = Object.values(agrupado);
          const diferenciaDinero = totalSinDescuento - totalConDescuento;
          const perdidaMargenPorcentaje = totalSinDescuento > 0 ? (diferenciaDinero / totalSinDescuento) * 100 : 0;

          return ok({ 
            fecha: new Date(), 
            filas,
            resumenDescuentos: {
              totalSinDescuento,
              totalConDescuento,
              diferenciaDinero,
              perdidaMargenPorcentaje
            }
          });
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
          const nextDayLocal = (date: Date) => {
            return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
          };

          const startDate = parseLocalDate(start);
          const endDate = parseLocalDate(end);
          const endExclusive = nextDayLocal(endDate);

          // Obtener ventas del período con sus detalles
          const ventas = await prisma.ventas.findMany({
            where: { fecha: { gte: startDate, lt: endExclusive } },
            include: { 
              detalle: { 
                include: { producto: true, presentacion: true } 
              } 
            },
          });

          const byDayMap: Record<string, { fecha: string; cantidad: number; totalSinDescuento: number; totalConDescuento: number }> = {};
          const byProductMap: Record<string, { 
            productoId: number; 
            nombre: string; 
            cantidad: number; 
            precioVenta: number;
            descuentoPorcentaje: number;
            precioFinal: number;
            costo: number; 
            ganancia: number;
            margenPorcentaje: number;
          }> = {};

          let totalSinDescuento = 0;
          let totalConDescuento = 0;

          for (const venta of ventas) {
            try {
              const ventaSubtotal = Number(venta.subtotal || 0);
              const ventaDescuentoPct = Number(venta.descuento_porcentaje || 0);
              const ventaTotal = Number(venta.total || 0);

              totalSinDescuento += ventaSubtotal;
              totalConDescuento += ventaTotal;

              // Agrupar por día
              const vf = new Date(venta.fecha);
              const dayKey = `${vf.getFullYear()}-${String(vf.getMonth() + 1).padStart(2,'0')}-${String(vf.getDate()).padStart(2,'0')}`;
              if (!byDayMap[dayKey]) {
                byDayMap[dayKey] = { fecha: dayKey, cantidad: 0, totalSinDescuento: 0, totalConDescuento: 0 };
              }

              venta.detalle.forEach((d: any) => {
                const cantidadPresentacion = Number(d.cantidad_presentacion || 0);
                const subtotalDetalle = Number(d.subtotal || 0);
                
                byDayMap[dayKey].cantidad += cantidadPresentacion;
                byDayMap[dayKey].totalSinDescuento += subtotalDetalle;
                byDayMap[dayKey].totalConDescuento += subtotalDetalle * (1 - ventaDescuentoPct / 100);

                // Agrupar por producto
                const pid = d.producto_id;
                const nombre = d.producto?.nombre || 'Producto';
                const pkey = String(pid);

                if (!byProductMap[pkey]) {
                  byProductMap[pkey] = { 
                    productoId: pid, 
                    nombre, 
                    cantidad: 0, 
                    precioVenta: 0,
                    descuentoPorcentaje: 0,
                    precioFinal: 0,
                    costo: 0, 
                    ganancia: 0,
                    margenPorcentaje: 0
                  };
                }

                const item = byProductMap[pkey];
                
                // Calcular precios
                const precioVentaUnitario = cantidadPresentacion > 0 ? subtotalDetalle / cantidadPresentacion : 0;
                const descuentoDetalle = ventaDescuentoPct > 0 ? (subtotalDetalle * ventaDescuentoPct) / 100 : 0;
                const totalFinalDetalle = subtotalDetalle - descuentoDetalle;
                const precioFinalUnitario = cantidadPresentacion > 0 ? totalFinalDetalle / cantidadPresentacion : 0;

                // Costo
                const factorBase = Number(d.presentacion?.factor_a_base ?? 1);
                const cantidadBase = factorBase * cantidadPresentacion;
                const precioCompra = Number((d.precio_compra ?? (d.producto as any)?.precio_compra) ?? 0);
                const costoTotal = cantidadBase * precioCompra;

                // Promedios ponderados
                const nuevaCantidad = item.cantidad + cantidadPresentacion;
                if (nuevaCantidad > 0) {
                  item.precioVenta = ((item.precioVenta * item.cantidad) + (precioVentaUnitario * cantidadPresentacion)) / nuevaCantidad;
                  item.precioFinal = ((item.precioFinal * item.cantidad) + (precioFinalUnitario * cantidadPresentacion)) / nuevaCantidad;
                }
                item.cantidad = nuevaCantidad;
                item.costo += costoTotal;
                
                // Calcular descuento promedio ponderado
                if (item.precioVenta > 0) {
                  item.descuentoPorcentaje = ((item.precioVenta - item.precioFinal) / item.precioVenta) * 100;
                }
                
                item.ganancia = (item.precioFinal * item.cantidad) - item.costo;
                item.margenPorcentaje = item.precioFinal > 0 ? (item.ganancia / (item.precioFinal * item.cantidad)) * 100 : 0;
              });
            } catch (e) {
              console.error('Error procesando venta (ventas-historico) id=', (venta && venta.id) || null, e);
            }
          }

          const diferenciaDinero = totalSinDescuento - totalConDescuento;
          const perdidaMargenPorcentaje = totalSinDescuento > 0 ? (diferenciaDinero / totalSinDescuento) * 100 : 0;

          const result = {
            start: startDate.toISOString(),
            end: new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999).toISOString(),
            byDay: Object.values(byDayMap).sort((a,b)=>a.fecha.localeCompare(b.fecha)),
            byProduct: Object.values(byProductMap).sort((a,b)=>(b.precioFinal * b.cantidad) - (a.precioFinal * a.cantidad)),
            resumenDescuentos: {
              totalSinDescuento,
              totalConDescuento,
              diferenciaDinero,
              perdidaMargenPorcentaje
            }
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

  // Install a global promise that resolves when DB bootstrap (copy seed, migrations, seeder, inline seed) completes.
  // This allows early IPC handlers to await DB readiness and avoid querying missing tables during startup.
  let _resolveDbReady: () => void;
  let _rejectDbReady: (err: any) => void;
  (global as any).__dbReadyPromise = new Promise<void>((resolve, reject) => { _resolveDbReady = resolve; _rejectDbReady = reject; });

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
  // Helper: try to apply SQL migration files (if present) to the target DB using Prisma
  async function applyMigrationSqlFilesIfPresent(targetDbPath: string) {
    try {
      const migrationsFolders = [] as string[];
      // In production we expect migrations bundled under resourcesPath/migrations
      const prodMigrationsPath = path.join(process.resourcesPath, 'migrations');
      if (fs.existsSync(prodMigrationsPath)) migrationsFolders.push(prodMigrationsPath);
      // In development use the repo migrations folder
      const devMigrationsPath = path.join(__dirname, '..', 'db', 'migrations');
      if (fs.existsSync(devMigrationsPath)) migrationsFolders.push(devMigrationsPath);

      if (migrationsFolders.length === 0) return;

      // Use a lightweight runtime Prisma client pointed at the target DB to execute SQL files
      process.env.DATABASE_URL = `file:${targetDbPath.replace(/\\/g, '/')}`;
      const runtimeRequire = (eval('require') as NodeRequire);
      let runtime: typeof import('@prisma/client');
      try {
        runtime = runtimeRequire('@prisma/client');
      } catch (err) {
        // If runtime client not available, skip migrations (will fallback to schema fixes)
        console.warn('Prisma client not available to run SQL migrations at startup, skipping automatic SQL migration runner.');
        return;
      }
      const tmpPrisma = new runtime.PrismaClient();

      for (const folder of migrationsFolders) {
        try {
          const files = fs.readdirSync(folder).filter(f => f.endsWith('.sql')).sort();
          for (const f of files) {
            const sql = fs.readFileSync(path.join(folder, f), 'utf8');
            if (!sql || !sql.trim()) continue;
            console.log('🔁 Applying migration SQL file:', path.join(folder, f));
            try {
              // Execute the SQL in a single statement; SQLite supports multiple statements in a call
              await tmpPrisma.$executeRawUnsafe(sql);
            } catch (e) {
              console.error('Error applying migration file', f, e);
            }
          }
        } catch (e) {
          console.error('Error reading migration folder', folder, e);
        }
      }

      await tmpPrisma.$disconnect();
    } catch (e) {
      console.error('applyMigrationSqlFilesIfPresent error:', e);
    }
  }

  // Helper: run the JS/TS seeder script (idempotent) if present. This will attempt to require the project's seed file
  async function runSeederIfPresent(targetDbPath: string) {
    try {
      // Ensure Prisma client will connect to the target DB when seeder runs
      process.env.DATABASE_URL = `file:${targetDbPath.replace(/\\/g, '/')}`;
      const seederPathProd = path.join(process.resourcesPath, 'db-seed', 'seed.js');
      const seederPathDev = path.join(__dirname, '..', 'db', 'seed.js');
      let seederToRun: string | null = null;
      if (fs.existsSync(seederPathProd)) seederToRun = seederPathProd;
      else if (fs.existsSync(seederPathDev)) seederToRun = seederPathDev;

      if (!seederToRun) return;

      console.log('🧪 Running seeder:', seederToRun);
      try {
        // Use a child process to run the seeder to avoid TypeScript/ESM loader issues
        // Use eval('require') to avoid bundlers statically resolving child_process
        const runtimeRequireLocal = (eval('require') as NodeRequire);
        const spawn = runtimeRequireLocal('child_process').spawnSync;
        const nodeExe = process.execPath;
        const res = spawn(nodeExe, [seederToRun], { stdio: 'inherit' });
        if (res.error) console.error('Seeder execution error:', res.error);
        else if (res.status !== 0) console.warn('Seeder exited with non-zero status:', res.status);
      } catch (e) {
        console.error('Error executing seeder:', e);
      }
    } catch (e) {
      console.error('runSeederIfPresent error:', e);
    }
  }

  // Helper: ensure minimal seed data exists (idempotent) so ventas can run
  async function ensureSeedDataIfEmpty(targetDbPath: string) {
    try {
      process.env.DATABASE_URL = `file:${targetDbPath.replace(/\\/g, '/')}`;
      const runtimeRequireLocal = (eval('require') as NodeRequire);
      let runtime: typeof import('@prisma/client');
      try {
        runtime = runtimeRequireLocal('@prisma/client');
      } catch (e) {
        // If no prisma client available, skip - the runtime ALTER fallbacks remain
        console.warn('Prisma client not available for inline seeding at startup. Skipping inline seeder.');
        return;
      }
      const tmpPrisma = new runtime.PrismaClient();

      try {
        const confCount = await tmpPrisma.configuracion.count();
        if (confCount === 0) {
          console.log('🌱 Seed: creando configuración por defecto');
          await tmpPrisma.configuracion.create({ data: { nombre_empresa: 'Mi Tienda', logo: '', direccion: '', telefono: '', rfc: '', moneda: 'MXN' } });
        }

        const categoriasCount = await tmpPrisma.categorias.count();
        let categoriaId = undefined as number | undefined;
        if (categoriasCount === 0) {
          const cat = await tmpPrisma.categorias.create({ data: { nombre: 'General', descripcion: 'Categoría por defecto' } });
          categoriaId = cat.id;
          console.log('🌱 Seed: categoria creada', cat.id);
        } else {
          const existCat = await tmpPrisma.categorias.findFirst();
          categoriaId = existCat ? existCat.id : undefined;
        }

        const productosCount = await tmpPrisma.productos.count();
        if (productosCount === 0) {
          console.log('🌱 Seed: creando producto de ejemplo con presentacion');
          const prod = await tmpPrisma.productos.create({ data: {
            nombre: 'Producto de ejemplo', descripcion: 'Producto generado automáticamente', categoria_id: Number(categoriaId || 1), unidad_base: 'pieza', stock_actual: 100, stock_minimo: 0, precio_compra: 0, codigo_barras: null
          }});
          await tmpPrisma.presentaciones_producto.create({ data: {
            producto_id: prod.id, nombre: 'Unidad', unidad: 'pieza', factor_a_base: 1, precio_unitario: 1, codigo_barras: null, activo: true, es_default: true
          }});
        }

        const usuariosCount = await tmpPrisma.usuarios.count();
        if (usuariosCount === 0) {
          console.log('🌱 Seed: creando usuario admin por defecto');
          const pwHash = await bcrypt.hash('admin', 10);
          await tmpPrisma.usuarios.create({ data: { nombre: 'Administrador', usuario: 'admin', password_hash: pwHash, rol: 'admin', activo: true } });
        }
      } catch (e) {
        console.error('Error running inline seed operations:', e);
      } finally {
        await tmpPrisma.$disconnect();
      }
    } catch (e) {
      console.error('ensureSeedDataIfEmpty error:', e);
    }
  }

  // Primera ejecución: copiar semilla si no existe la DB del usuario
  if (!fs.existsSync(dbPath)) {
    try {
      if (fs.existsSync(seedDbPath)) {
        // Copy seed DB first
        fs.copyFileSync(seedDbPath, dbPath);
        console.log('✅ Base de datos inicial copiada a:', dbPath);

        // After copying the seed DB, attempt to apply any bundled migration SQL files
        await applyMigrationSqlFilesIfPresent(dbPath);

  // After migrations, attempt to run JS seeder (if present) to ensure data consistency
  await runSeederIfPresent(dbPath);
  // Also ensure minimal inline seed data exists so ventas can function on fresh installs
  await ensureSeedDataIfEmpty(dbPath);
      } else {
        console.warn('⚠️ Seed DB no encontrada en:', seedDbPath);
      }
    } catch (err) {
      console.error('❌ Error al copiar base de datos inicial:', err);
    }
  }

  console.log("📦 Ruta activa de base de datos:", dbPath);

  // Asegurar compatibilidad de esquema en runtime: si la DB existe pero falta
  // la columna `precio_compra` añadimos la columna vía SQL para evitar fallos
  // en versiones antiguas del DB que no tengan la nueva columna.
  try {
    const prismaRuntime = getPrisma();
    try {
      // PRAGMA devuelve filas con { cid, name, type, notnull, dflt_value, pk }
      const cols: any[] = await prismaRuntime.$queryRaw`PRAGMA table_info('Productos')` as any[];
      const hasPrecio = Array.isArray(cols) && cols.some((c: any) => String(c.name).toLowerCase() === 'precio_compra');
      if (!hasPrecio) {
        console.log('🔧 Columna precio_compra no encontrada en Productos. Agregando columna...');
        // ALTER TABLE para añadir columna con valor por defecto 0.
        await prismaRuntime.$executeRawUnsafe("ALTER TABLE Productos ADD COLUMN precio_compra NUMERIC DEFAULT 0");
        console.log('✅ Columna precio_compra añadida correctamente.');
      }
      // Also ensure Detalle_venta has precio_compra column (for historical sales cost preservation)
      try {
        const detalleCols: any[] = await prismaRuntime.$queryRaw`PRAGMA table_info('Detalle_venta')` as any[];
        const hasDetallePrecio = Array.isArray(detalleCols) && detalleCols.some((c: any) => String(c.name).toLowerCase() === 'precio_compra');
        if (!hasDetallePrecio) {
          console.log('🔧 Columna precio_compra no encontrada en Detalle_venta. Agregando columna...');
          await prismaRuntime.$executeRawUnsafe("ALTER TABLE Detalle_venta ADD COLUMN precio_compra NUMERIC DEFAULT 0");
          console.log('✅ Columna precio_compra añadida en Detalle_venta correctamente.');
        }
      } catch (e2) {
        console.error('Error comprobando/actualizando Detalle_venta.precio_compra:', e2);
      }
    } catch (schemaErr) {
      console.error('Error comprobando/actualizando esquema en runtime:', schemaErr);
    }
  } catch (e) {
    // Si getPrisma falla, lo registramos pero no bloqueamos el inicio
    console.error('No se pudo inicializar Prisma para comprobación de esquema:', e);
  }

  // DB bootstrap finished (successful or not) -> resolve the global promise so handlers proceed
  try {
    if (typeof _resolveDbReady === 'function') _resolveDbReady();
  } catch (e) { /* ignore */ }

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
