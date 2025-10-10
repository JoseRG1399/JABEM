const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd, env = {}) {
  console.log(`> ${cmd}`);
  execSync(cmd, {
    stdio: 'inherit',
    env: { ...process.env, ...env },
    shell: true,
  });
}

(async function main() {
  try {
    const projectRoot = path.resolve(__dirname, '..');
    const schemaPath = path.join(projectRoot, 'main', 'db', 'schema.prisma');
    const seedDbPath = path.join(projectRoot, 'main', 'db', 'jabem.dev.db');

    // Limpia DB previa
    if (fs.existsSync(seedDbPath)) {
      fs.unlinkSync(seedDbPath);
      console.log(`Eliminada DB previa: ${seedDbPath}`);
    }

    // Asegura generación de cliente
    run(`npx prisma generate --schema="${schemaPath}"`);

  // Aplica las migraciones existentes al archivo seed DB (genera la estructura según migrations/)
  const DATABASE_URL = `file:${seedDbPath.replace(/\\/g, '/')}`;
  // Genera cliente antes de migrar
  run(`npx prisma generate --schema="${schemaPath}"`);
  // Aplica las migraciones desde main/db/migrations al seed DB
  run(`npx prisma migrate deploy --schema="${schemaPath}"`, { DATABASE_URL });

    // Ejecuta el seed apuntando a la nueva DB
    // Usa ts-node si el seed está en TypeScript
    run(`npx ts-node ./main/db/seed.ts`, { DATABASE_URL });

    console.log('Seed DB creada en:', seedDbPath);
  } catch (err) {
    console.error('Fallo creando seed DB:', err);
    process.exit(1);
  }
})();
