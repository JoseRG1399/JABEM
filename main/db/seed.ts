import {
  PrismaClient,
  Rol,
  MetodoPago,
  Unidad,
  TipoMovimiento,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // -----------------------
  // Usuario admin por defecto
  // -----------------------
  const password_hash = await bcrypt.hash("admin123", 10);
  await prisma.usuarios.upsert({
    where: { usuario: "admin" },
    update: {},
    create: {
      nombre: "Administrador",
      usuario: "admin",
      password_hash,
      rol: Rol.admin,
      activo: true,
    },
  });

  // -----------------------
  // Configuración base
  // -----------------------
  await prisma.configuracion.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nombre_empresa: "La Forrajera Feliz",
      logo: "",
      direccion: "Toluca, MX",
      telefono: "722-123-4567",
      rfc: null,
      moneda: "MXN",
    },
  });

  // -----------------------
  // Categorías
  // -----------------------
  const catForraje = await prisma.categorias.upsert({
    where: { id: 1 },
    update: {},
    create: { nombre: "forraje", descripcion: "Forrajes y granos" },
  });

  const catAccesorios = await prisma.categorias.upsert({
    where: { id: 2 },
    update: {},
    create: { nombre: "accesorios", descripcion: "Accesorios para animales" },
  });

  // -----------------------
  // Productos
  // -----------------------
  const alpiste = await prisma.productos.upsert({
    where: { codigo_barras: "1234567890123" },
    update: {
      categoria_id: catForraje.id,
      nombre: "Alpiste",
      descripcion: "Grano seleccionado de alta calidad",
      unidad_base: Unidad.kg,
      stock_actual: 100,
      stock_minimo: 10,
      precio_compra: 20.0,
    } as any,
    create: ({
      categoria_id: catForraje.id,
      nombre: "Alpiste",
      descripcion: "Grano seleccionado de alta calidad",
      unidad_base: Unidad.kg,
      stock_actual: 100,
      stock_minimo: 10,
      codigo_barras: "1234567890123",
      precio_compra: 20.0,
    } as any),
  });

  const avena = await prisma.productos.upsert({
    where: { codigo_barras: "2234567890123" },
    update: {
      categoria_id: catForraje.id,
      nombre: "Avena",
      descripcion: "Avena limpia para alimentación animal",
      unidad_base: Unidad.kg,
      stock_actual: 200,
      stock_minimo: 20,
      precio_compra: 15.0,
    } as any,
    create: ({
      categoria_id: catForraje.id,
      nombre: "Avena",
      descripcion: "Avena limpia para alimentación animal",
      unidad_base: Unidad.kg,
      stock_actual: 200,
      stock_minimo: 20,
      codigo_barras: "2234567890123",
      precio_compra: 15.0,
    } as any),
  });

  const comedero = await prisma.productos.upsert({
    where: { codigo_barras: "3234567890123" },
    update: {
      categoria_id: catAccesorios.id,
      nombre: "Comedero plástico",
      descripcion: "Comedero resistente para mascotas",
      unidad_base: Unidad.pieza,
      stock_actual: 50,
      stock_minimo: 5,
      precio_compra: 70.0,
    } as any,
    create: ({
      categoria_id: catAccesorios.id,
      nombre: "Comedero plástico",
      descripcion: "Comedero resistente para mascotas",
      unidad_base: Unidad.pieza,
      stock_actual: 50,
      stock_minimo: 5,
      codigo_barras: "3234567890123",
      precio_compra: 70.0,
    } as any),
  });

  // -----------------------
  // Presentaciones
  // -----------------------
  // Presentaciones Alpiste: ensure entries exist (create if missing)
  const presentacionesAlpisteData = [
    {
      producto_id: alpiste.id,
      nombre: "Kg suelto",
      unidad: Unidad.kg,
      factor_a_base: 1,
      precio_unitario: 35.0,
      es_default: true,
    },
    {
      producto_id: alpiste.id,
      nombre: "Bulto 25kg",
      unidad: Unidad.bulto,
      factor_a_base: 25,
      precio_unitario: 850.0,
    },
  ];

  for (const p of presentacionesAlpisteData) {
    const exists = await prisma.presentaciones_producto.findFirst({
      where: { producto_id: p.producto_id, nombre: p.nombre },
    });
    if (!exists) {
      await prisma.presentaciones_producto.create({ data: p as any });
    }
  }

  const presentacionesAvenaData = [
    {
      producto_id: avena.id,
      nombre: "Kg suelto",
      unidad: Unidad.kg,
      factor_a_base: 1,
      precio_unitario: 28.0,
      es_default: true,
    },
    {
      producto_id: avena.id,
      nombre: "Bulto 20kg",
      unidad: Unidad.bulto,
      factor_a_base: 20,
      precio_unitario: 540.0,
    },
  ];

  for (const p of presentacionesAvenaData) {
    const exists = await prisma.presentaciones_producto.findFirst({
      where: { producto_id: p.producto_id, nombre: p.nombre },
    });
    if (!exists) {
      await prisma.presentaciones_producto.create({ data: p as any });
    }
  }

  const presentacionesComederoData = [
    {
      producto_id: comedero.id,
      nombre: "Pieza",
      unidad: Unidad.pieza,
      factor_a_base: 1,
      precio_unitario: 120.0,
      es_default: true,
    },
  ];

  for (const p of presentacionesComederoData) {
    const exists = await prisma.presentaciones_producto.findFirst({
      where: { producto_id: p.producto_id, nombre: p.nombre },
    });
    if (!exists) {
      await prisma.presentaciones_producto.create({ data: p as any });
    }
  }

  // -----------------------
  // Obtener IDs de presentaciones
  // -----------------------
  const presentacionesAlpisteFull =
    await prisma.presentaciones_producto.findMany({
      where: { producto_id: alpiste.id },
    });

  const presentacionesAvenaFull = await prisma.presentaciones_producto.findMany(
    {
      where: { producto_id: avena.id },
    }
  );

  const presentacionesComederoFull =
    await prisma.presentaciones_producto.findMany({
      where: { producto_id: comedero.id },
    });

  // -----------------------
  // Inventario movimientos
  // -----------------------
  const movimientosData = [
    {
      producto_id: alpiste.id,
      presentacion_id: presentacionesAlpisteFull[0].id,
      tipo_movimiento: TipoMovimiento.entrada,
      cantidad_base: 100,
      fecha: new Date(),
      comentario: "Ingreso inicial de Alpiste",
    },
    {
      producto_id: avena.id,
      presentacion_id: presentacionesAvenaFull[0].id,
      tipo_movimiento: TipoMovimiento.entrada,
      cantidad_base: 200,
      fecha: new Date(),
      comentario: "Ingreso inicial de Avena",
    },
    {
      producto_id: comedero.id,
      presentacion_id: presentacionesComederoFull[0].id,
      tipo_movimiento: TipoMovimiento.entrada,
      cantidad_base: 50,
      fecha: new Date(),
      comentario: "Ingreso inicial de Comederos",
    },
  ];

  for (const m of movimientosData) {
    const exists = await prisma.inventario_movimientos.findFirst({
      where: {
        producto_id: m.producto_id,
        presentacion_id: m.presentacion_id,
        tipo_movimiento: m.tipo_movimiento,
        cantidad_base: m.cantidad_base,
      },
    });
    if (!exists) {
      await prisma.inventario_movimientos.create({ data: m as any });
    }
  }

  // -----------------------
  // Venta de ejemplo
  // -----------------------
  const admin = await prisma.usuarios.findUnique({
    where: { usuario: "admin" },
  });

  if (admin) {
    // Venta sin descuento
    await prisma.ventas.create({
      data: {
        usuario_id: admin.id,
        fecha: new Date(),
        subtotal: 185.0,
        descuento_porcentaje: 0,
        descuento_monto: 0,
        total: 185.0,
        metodo_pago: MetodoPago.efectivo,
        detalle: {
          create: [
            {
              producto_id: alpiste.id,
              presentacion_id: presentacionesAlpisteFull[0].id,
              cantidad_presentacion: 2,
              precio_unitario: 35.0,
              precio_compra: alpiste.precio_compra ?? 0,
              subtotal: 70.0,
            },
            {
              producto_id: comedero.id,
              presentacion_id: presentacionesComederoFull[0].id,
              cantidad_presentacion: 1,
              precio_unitario: 115.0,
              precio_compra: comedero.precio_compra ?? 0,
              subtotal: 115.0,
            },
          ],
        },
      },
    });

    // Venta con descuento del 10%
    await prisma.ventas.create({
      data: {
        usuario_id: admin.id,
        fecha: new Date(),
        subtotal: 150.0,
        descuento_porcentaje: 10,
        descuento_monto: 15.0,
        total: 135.0,
        metodo_pago: MetodoPago.efectivo,
        detalle: {
          create: [
            {
              producto_id: alpiste.id,
              presentacion_id: presentacionesAlpisteFull[0].id,
              cantidad_presentacion: 3,
              precio_unitario: 35.0,
              precio_compra: alpiste.precio_compra ?? 0,
              subtotal: 105.0,
            },
            {
              producto_id: comedero.id,
              presentacion_id: presentacionesComederoFull[0].id,
              cantidad_presentacion: 1,
              precio_unitario: 45.0,
              precio_compra: comedero.precio_compra ?? 0,
              subtotal: 45.0,
            },
          ],
        },
      },
    });
  }
}

main()
  .then(async () => {
    console.log("Seed listo ✅");
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
