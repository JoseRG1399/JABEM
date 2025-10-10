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
    "precio_compra" DECIMAL NOT NULL DEFAULT 0,
    "subtotal" DECIMAL NOT NULL,
    CONSTRAINT "Detalle_venta_presentacion_id_fkey" FOREIGN KEY ("presentacion_id") REFERENCES "Presentaciones_producto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Detalle_venta_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "Productos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Detalle_venta_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "Ventas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Detalle_venta" ("cantidad_presentacion", "id", "precio_unitario", "presentacion_id", "producto_id", "subtotal", "venta_id") SELECT "cantidad_presentacion", "id", "precio_unitario", "presentacion_id", "producto_id", "subtotal", "venta_id" FROM "Detalle_venta";
DROP TABLE "Detalle_venta";
ALTER TABLE "new_Detalle_venta" RENAME TO "Detalle_venta";
CREATE INDEX "Detalle_venta_venta_id_idx" ON "Detalle_venta"("venta_id");
CREATE INDEX "Detalle_venta_producto_id_idx" ON "Detalle_venta"("producto_id");
CREATE INDEX "Detalle_venta_presentacion_id_idx" ON "Detalle_venta"("presentacion_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
