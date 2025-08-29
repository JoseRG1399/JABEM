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
  const alpiste = await prisma.productos.create({
    data: {
      categoria_id: catForraje.id,
      nombre: "Alpiste",
      descripcion: "Grano seleccionado de alta calidad",
      unidad_base: Unidad.kg,
      stock_actual: 100,
      stock_minimo: 10,
      codigo_barras: "1234567890123",
    },
  });

  const avena = await prisma.productos.create({
    data: {
      categoria_id: catForraje.id,
      nombre: "Avena",
      descripcion: "Avena limpia para alimentación animal",
      unidad_base: Unidad.kg,
      stock_actual: 200,
      stock_minimo: 20,
      codigo_barras: "2234567890123",
    },
  });

  const comedero = await prisma.productos.create({
    data: {
      categoria_id: catAccesorios.id,
      nombre: "Comedero plástico",
      descripcion: "Comedero resistente para mascotas",
      unidad_base: Unidad.pieza,
      stock_actual: 50,
      stock_minimo: 5,
      codigo_barras: "3234567890123",
    },
  });

  // -----------------------
  // Presentaciones
  // -----------------------
  const presentacionesAlpiste = await prisma.presentaciones_producto.createMany(
    {
      data: [
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
      ],
    }
  );

  const presentacionesAvena = await prisma.presentaciones_producto.createMany({
    data: [
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
    ],
  });

  const presentacionesComedero =
    await prisma.presentaciones_producto.createMany({
      data: [
        {
          producto_id: comedero.id,
          nombre: "Pieza",
          unidad: Unidad.pieza,
          factor_a_base: 1,
          precio_unitario: 120.0,
          es_default: true,
        },
      ],
    });

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
  await prisma.inventario_movimientos.createMany({
    data: [
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
    ],
  });

  // -----------------------
  // Venta de ejemplo
  // -----------------------
  const admin = await prisma.usuarios.findUnique({
    where: { usuario: "admin" },
  });

  if (admin) {
    await prisma.ventas.create({
      data: {
        usuario_id: admin.id,
        fecha: new Date(),
        total: 185.0,
        metodo_pago: MetodoPago.efectivo,
        detalle: {
          create: [
            {
              producto_id: alpiste.id,
              presentacion_id: presentacionesAlpisteFull[0].id,
              cantidad_presentacion: 2,
              precio_unitario: 35.0,
              subtotal: 70.0,
            },
            {
              producto_id: comedero.id,
              presentacion_id: presentacionesComederoFull[0].id,
              cantidad_presentacion: 1,
              precio_unitario: 115.0,
              subtotal: 115.0,
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
