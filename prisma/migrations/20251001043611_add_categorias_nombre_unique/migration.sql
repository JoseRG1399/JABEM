-- CreateTable
CREATE TABLE "Usuarios" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Configuracion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre_empresa" TEXT NOT NULL,
    "logo" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "rfc" TEXT,
    "moneda" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Categorias" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Productos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "categoria_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "unidad_base" TEXT NOT NULL,
    "stock_actual" DECIMAL NOT NULL DEFAULT 0,
    "stock_minimo" DECIMAL NOT NULL DEFAULT 0,
    "codigo_barras" TEXT,
    CONSTRAINT "Productos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "Categorias" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Presentaciones_producto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "producto_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "factor_a_base" DECIMAL NOT NULL,
    "precio_unitario" DECIMAL NOT NULL,
    "codigo_barras" TEXT,
    "es_default" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Presentaciones_producto_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "Productos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ventas" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usuario_id" INTEGER NOT NULL,
    "fecha" DATETIME NOT NULL,
    "total" DECIMAL NOT NULL,
    "metodo_pago" TEXT NOT NULL,
    CONSTRAINT "Ventas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Detalle_venta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "venta_id" INTEGER NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "presentacion_id" INTEGER NOT NULL,
    "cantidad_presentacion" DECIMAL NOT NULL,
    "precio_unitario" DECIMAL NOT NULL,
    "subtotal" DECIMAL NOT NULL,
    CONSTRAINT "Detalle_venta_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "Ventas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Detalle_venta_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "Productos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Detalle_venta_presentacion_id_fkey" FOREIGN KEY ("presentacion_id") REFERENCES "Presentaciones_producto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Inventario_movimientos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "producto_id" INTEGER NOT NULL,
    "presentacion_id" INTEGER,
    "tipo_movimiento" TEXT NOT NULL,
    "cantidad_base" DECIMAL NOT NULL,
    "fecha" DATETIME NOT NULL,
    "comentario" TEXT NOT NULL,
    CONSTRAINT "Inventario_movimientos_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "Productos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Inventario_movimientos_presentacion_id_fkey" FOREIGN KEY ("presentacion_id") REFERENCES "Presentaciones_producto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuarios_usuario_key" ON "Usuarios"("usuario");

-- CreateIndex
CREATE UNIQUE INDEX "Categorias_nombre_key" ON "Categorias"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Productos_codigo_barras_key" ON "Productos"("codigo_barras");

-- CreateIndex
CREATE INDEX "Productos_categoria_id_idx" ON "Productos"("categoria_id");

-- CreateIndex
CREATE UNIQUE INDEX "Presentaciones_producto_codigo_barras_key" ON "Presentaciones_producto"("codigo_barras");

-- CreateIndex
CREATE INDEX "Presentaciones_producto_producto_id_idx" ON "Presentaciones_producto"("producto_id");

-- CreateIndex
CREATE INDEX "Ventas_usuario_id_idx" ON "Ventas"("usuario_id");

-- CreateIndex
CREATE INDEX "Ventas_fecha_idx" ON "Ventas"("fecha");

-- CreateIndex
CREATE INDEX "Detalle_venta_venta_id_idx" ON "Detalle_venta"("venta_id");

-- CreateIndex
CREATE INDEX "Detalle_venta_producto_id_idx" ON "Detalle_venta"("producto_id");

-- CreateIndex
CREATE INDEX "Detalle_venta_presentacion_id_idx" ON "Detalle_venta"("presentacion_id");

-- CreateIndex
CREATE INDEX "Inventario_movimientos_producto_id_idx" ON "Inventario_movimientos"("producto_id");

-- CreateIndex
CREATE INDEX "Inventario_movimientos_fecha_idx" ON "Inventario_movimientos"("fecha");
