import path from 'path'
import { app, ipcMain } from 'electron'
import bcrypt from 'bcryptjs'
import serve from 'electron-serve'
import { createWindow } from './helpers'

const isProd = process.env.NODE_ENV === 'production'

if (isProd) {
  serve({ directory: 'app' })
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`)
}

function setDatabaseUrl() {
  const packaged = app.isPackaged
  if (packaged) {
    const userData = app.getPath('userData')
    const dbPath = path.join(userData, 'jabem.db')
    process.env.DATABASE_URL = `file:${dbPath}`
  } else {
    // Dev: point to repo SQLite file
    const dbPath = path.join(process.cwd(), 'main', 'db', 'main', 'db', 'jabem.dev.db')
    process.env.DATABASE_URL = `file:${dbPath}`
  }
}

async function getPrisma() {
  const mod = await import('./db/client')
  return mod.prisma
}

;(async () => {
  await app.whenReady()
  setDatabaseUrl()

  const mainWindow = createWindow('main', {
    width: 1000,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  if (isProd) {
    await mainWindow.loadURL('app://./home')
  } else {
    const port = process.argv[2]
    await mainWindow.loadURL(`http://localhost:${port}/home`)
    mainWindow.webContents.openDevTools()
  }
})()

app.on('window-all-closed', () => {
  app.quit()
})

ipcMain.on('message', async (event, arg) => {
  event.reply('message', `${arg} World!`)
})

ipcMain.handle('auth:login', async (_event, payload: { usuario: string; password: string }) => {
  const prisma = await getPrisma()
  const { usuario, password } = payload || { usuario: '', password: '' }
  if (!usuario || !password) {
    return { ok: false, error: 'Credenciales inválidas' }
  }

  try {
    const user = await prisma.usuarios.findUnique({ where: { usuario } })
    if (!user || !user.activo) {
      return { ok: false, error: 'Usuario o contraseña incorrectos' }
    }

    const isValid = await bcrypt.compare(password, user.password_hash)
    if (!isValid) {
      return { ok: false, error: 'Usuario o contraseña incorrectos' }
    }

    return {
      ok: true,
      user: { id: user.id, nombre: user.nombre, usuario: user.usuario, rol: user.rol },
    }
  } catch (err) {
    return { ok: false, error: 'Error interno' }
  }
})
