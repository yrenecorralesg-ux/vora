const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const DESKTOP_DIR = __dirname;
const PKG_PATH = path.join(DESKTOP_DIR, 'package.json');
const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
const VERSION = pkg.version || '1.0.1';
const BASE_URL = (process.env.VORA_DESKTOP_BASE_URL || 'https://vora-weld-mu.vercel.app').replace(/\/+$/, '');

const TENANTS = [
  {
    slug: 'test-interno',
    name: 'Test Interno',
    fileSlug: 'Test-Interno',
  },
  {
    slug: 'inv-impacto',
    name: 'Inv. Impacto',
    fileSlug: 'Inv-Impacto',
  },
  {
    slug: 'stunt-riders',
    name: 'Stunt Riders',
    fileSlug: 'Stunt-Riders',
  },
];

const filterArg = process.argv[2] ? process.argv[2].trim().toLowerCase() : null;
const targets = filterArg ? TENANTS.filter((t) => t.slug === filterArg) : TENANTS;
if (targets.length === 0) {
  console.error(`Empresa no reconocida: ${filterArg}. Opciones: ${TENANTS.map((t) => t.slug).join(', ')}`);
  process.exit(1);
}

const builderCli = require.resolve('electron-builder/cli.js', { paths: [DESKTOP_DIR] });
const asarModPath = (() => {
  try {
    return require.resolve('@electron/asar', { paths: [DESKTOP_DIR] });
  } catch {
    return null;
  }
})();

const tenantConfigPath = path.join(DESKTOP_DIR, 'tenant.config.json');
const builderConfigPath = path.join(DESKTOP_DIR, '.builder-tenant.json');

function cleanupTempFiles() {
  for (const filePath of [tenantConfigPath, builderConfigPath]) {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // Ignorar al limpiar temporales
    }
  }
}

const builtArtifacts = [];

try {
  for (const tenant of targets) {
    const appUrl = `${BASE_URL}/t/${tenant.slug}/login`;
    const artifactTemplate = `VORA-${tenant.fileSlug}-Portable-\${version}-\${arch}.exe`;
    const expectedFilename = `VORA-${tenant.fileSlug}-Portable-${VERSION}-x64.exe`;
    const expectedOutputPath = path.join(DESKTOP_DIR, 'dist', expectedFilename);

    console.log(`\n=== Compilando portable para ${tenant.name} (${appUrl}) ===`);

    fs.writeFileSync(
      tenantConfigPath,
      JSON.stringify(
        {
          slug: tenant.slug,
          name: tenant.name,
          baseUrl: BASE_URL,
          appUrl,
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );

    fs.writeFileSync(
      builderConfigPath,
      JSON.stringify(
        {
          extends: null,
          appId: `com.venesoftca.vora.desktop.${tenant.slug}`,
          productName: `VORA ${tenant.name}`,
          directories: {
            output: 'dist',
            buildResources: 'build',
          },
          files: ['main.js', 'preload.js', 'offline.html', 'tenant.config.json', 'build/**/*'],
          win: {
            target: [{ target: 'portable', arch: ['x64'] }],
            icon: 'build/icon.png',
          },
          portable: {
            artifactName: artifactTemplate,
          },
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );

    execFileSync(process.execPath, [builderCli, '--win', 'portable', '--config', builderConfigPath], {
      cwd: DESKTOP_DIR,
      stdio: 'inherit',
    });

    if (!fs.existsSync(expectedOutputPath)) {
      throw new Error(`No se generó el ejecutable esperado: ${expectedOutputPath}`);
    }

    if (asarModPath) {
      const asarPath = path.join(DESKTOP_DIR, 'dist', 'win-unpacked', 'resources', 'app.asar');
      // Ejecutar lectura en subproceso limpio para evitar caché en memoria de @electron/asar entre builds.
      const embeddedRaw = execFileSync(
        process.execPath,
        [
          '-e',
          `const a = require(${JSON.stringify(asarModPath)}); process.stdout.write(a.extractFile(${JSON.stringify(asarPath)}, 'tenant.config.json'));`,
        ],
        { cwd: DESKTOP_DIR, encoding: 'utf8' },
      );
      const embedded = JSON.parse(embeddedRaw);
      if (embedded.slug !== tenant.slug || embedded.appUrl !== appUrl) {
        throw new Error(`Configuración embebida inválida en ${expectedFilename}: ${embeddedRaw}`);
      }
      console.log(`✓ Verificado tenant.config.json en app.asar: ${embedded.appUrl}`);
    }

    const stat = fs.statSync(expectedOutputPath);
    builtArtifacts.push({
      slug: tenant.slug,
      name: tenant.name,
      appUrl,
      path: expectedOutputPath,
      size: stat.size,
    });
  }
} finally {
  cleanupTempFiles();
}

console.log('\n=== Ejecutables generados ===');
for (const item of builtArtifacts) {
  console.log(`- ${item.name} (${item.appUrl}): ${item.path} (${item.size} bytes)`);
}
