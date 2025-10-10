-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Ventas" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usuario_id" INTEGER NOT NULL,
    "fecha" DATETIME NOT NULL,
    "subtotal" DECIMAL NOT NULL DEFAULT 0,
    "descuento_porcentaje" DECIMAL NOT NULL DEFAULT 0,
    "descuento_monto" DECIMAL NOT NULL DEFAULT 0,
    "total" DECIMAL NOT NULL,
    "metodo_pago" TEXT NOT NULL,
    CONSTRAINT "Ventas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Ventas" ("fecha", "id", "metodo_pago", "total", "usuario_id") SELECT "fecha", "id", "metodo_pago", "total", "usuario_id" FROM "Ventas";
DROP TABLE "Ventas";
ALTER TABLE "new_Ventas" RENAME TO "Ventas";
CREATE INDEX "Ventas_usuario_id_idx" ON "Ventas"("usuario_id");
CREATE INDEX "Ventas_fecha_idx" ON "Ventas"("fecha");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
