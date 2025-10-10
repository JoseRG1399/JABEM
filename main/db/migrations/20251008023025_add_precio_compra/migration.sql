-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Productos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "categoria_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "unidad_base" TEXT NOT NULL,
    "stock_actual" DECIMAL NOT NULL DEFAULT 0,
    "stock_minimo" DECIMAL NOT NULL DEFAULT 0,
    "precio_compra" DECIMAL NOT NULL DEFAULT 0,
    "codigo_barras" TEXT,
    CONSTRAINT "Productos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "Categorias" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Productos" ("categoria_id", "codigo_barras", "descripcion", "id", "nombre", "stock_actual", "stock_minimo", "unidad_base") SELECT "categoria_id", "codigo_barras", "descripcion", "id", "nombre", "stock_actual", "stock_minimo", "unidad_base" FROM "Productos";
DROP TABLE "Productos";
ALTER TABLE "new_Productos" RENAME TO "Productos";
CREATE UNIQUE INDEX "Productos_codigo_barras_key" ON "Productos"("codigo_barras");
CREATE INDEX "Productos_categoria_id_idx" ON "Productos"("categoria_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
