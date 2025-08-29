import { app, BrowserWindow } from "electron";
import path from "path";

function setDatabaseUrl() {
  // En dev puedes usar .env; en prod guardamos el .db en userData
  const isProd = app.isPackaged;
  if (isProd) {
    const userData = app.getPath("userData");
    const dbPath = path.join(userData, "jabem.db");
    process.env.DATABASE_URL = `file:${dbPath}`;
  } else {
    // Ruta local del repo (para desarrollo)
    const dbPath = path.join(__dirname, "db", "jabem.dev.db");
    process.env.DATABASE_URL = `file:${dbPath}`;
  }
}

async function createWindow() {
  setDatabaseUrl(); // <-- MUY IMPORTANTE: antes de usar Prisma

  const win = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // ... carga de URL de Nextron y registro de IPCs
}

app.whenReady().then(createWindow);
