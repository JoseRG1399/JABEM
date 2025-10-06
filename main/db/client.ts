import { PrismaClient } from "@prisma/client";
import path from "path";
import { app } from "electron";

const dbPath = path.join(app.getPath("userData"), "db", "jabem.db");

export const prisma = new PrismaClient({
  datasources: {
    db: { url: `file:${dbPath}` },
  },
});

