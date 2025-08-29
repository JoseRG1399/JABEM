/*
  Warnings:

  - You are about to drop the column `cantidad` on the `Detalle_venta` table. All the data in the column will be lost.
  - You are about to drop the column `cantidad` on the `Inventario_movimientos` table. All the data in the column will be lost.
  - You are about to drop the column `precio_unitario` on the `Productos` table. All the data in the column will be lost.
  - You are about to drop the column `unidad` on the `Productos` table. All the data in the column will be lost.
  - You are about to alter the column `stock_actual` on the `Productos` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Decimal`.
  - You are about to alter the column `stock_minimo` on the `Productos` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Decimal`.
  - Added the required column `cantidad_presentacion` to the `Detalle_venta` table without a default value. This is not possible if the table is not empty.
  - Added the required column `presentacion_id` to the `Detalle_venta` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cantidad_base` to the `Inventario_movimientos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unidad_base` to the `Productos` table without a default value. This is not possible if the table is not empty.

*/
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

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Detalle_venta" (
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
INSERT INTO "new_Detalle_venta" ("id", "precio_unitario", "producto_id", "subtotal", "venta_id") SELECT "id", "precio_unitario", "producto_id", "subtotal", "venta_id" FROM "Detalle_venta";
DROP TABLE "Detalle_venta";
ALTER TABLE "new_Detalle_venta" RENAME TO "Detalle_venta";
CREATE INDEX "Detalle_venta_venta_id_idx" ON "Detalle_venta"("venta_id");
CREATE INDEX "Detalle_venta_producto_id_idx" ON "Detalle_venta"("producto_id");
CREATE INDEX "Detalle_venta_presentacion_id_idx" ON "Detalle_venta"("presentacion_id");
CREATE TABLE "new_Inventario_movimientos" (
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
INSERT INTO "new_Inventario_movimientos" ("comentario", "fecha", "id", "producto_id", "tipo_movimiento") SELECT "comentario", "fecha", "id", "producto_id", "tipo_movimiento" FROM "Inventario_movimientos";
DROP TABLE "Inventario_movimientos";
ALTER TABLE "new_Inventario_movimientos" RENAME TO "Inventario_movimientos";
CREATE INDEX "Inventario_movimientos_producto_id_idx" ON "Inventario_movimientos"("producto_id");
CREATE INDEX "Inventario_movimientos_fecha_idx" ON "Inventario_movimientos"("fecha");
CREATE TABLE "new_Productos" (
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
INSERT INTO "new_Productos" ("categoria_id", "codigo_barras", "descripcion", "id", "nombre", "stock_actual", "stock_minimo") SELECT "categoria_id", "codigo_barras", "descripcion", "id", "nombre", "stock_actual", "stock_minimo" FROM "Productos";
DROP TABLE "Productos";
ALTER TABLE "new_Productos" RENAME TO "Productos";
CREATE UNIQUE INDEX "Productos_codigo_barras_key" ON "Productos"("codigo_barras");
CREATE INDEX "Productos_categoria_id_idx" ON "Productos"("categoria_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Presentaciones_producto_codigo_barras_key" ON "Presentaciones_producto"("codigo_barras");

-- CreateIndex
CREATE INDEX "Presentaciones_producto_producto_id_idx" ON "Presentaciones_producto"("producto_id");
