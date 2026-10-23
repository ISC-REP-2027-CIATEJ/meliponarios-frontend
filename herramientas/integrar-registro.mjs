// Ejecutar desde la raíz de meliponarios-frontend, después de copiar src/.
// Conserva el código existente de Administración y no lee archivos .env.
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.cwd();
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
if (pkg.name !== 'meliponarios-frontend') throw new Error('Abre Git Bash en la raíz de meliponarios-frontend antes de ejecutar este paso.');
for (const name of ['src/pages/Owner/OwnerMeliponariosPage.jsx', 'src/features/ownerMeliponarios/routes.js', 'src/components/ClientNavigation.jsx']) await readFile(join(root, name), 'utf8');

function once(source, pattern, replacement, file, description) {
  const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'))];
  if (matches.length !== 1) throw new Error(`${file}: no encontré una única sección de ${description}. No se modificó ningún archivo. Comparte este mensaje para adaptar el paso a tu versión.`);
  return source.replace(pattern, replacement);
}
function addImport(source, line) { return source.includes(line) ? source : line + '\n' + source; }
const targets = ['src/App.jsx', 'src/pages/Explore/ExplorePage.jsx', 'src/pages/Map/MapPage.jsx', 'src/pages/Detail/DetailPage.jsx'];
const prepared = [];
for (const file of targets) {
  const before = await readFile(join(root, file), 'utf8');
  let after = before;
  if (file === 'src/App.jsx') {
    after = addImport(after, "import { esRutaCliente } from './features/ownerMeliponarios/routes';");
    if (!after.includes('const OwnerMeliponariosPage = lazy(')) {
      after = once(after, /import\s*\{([^}]+)\}\s*from\s*["']react["'];?/, (_, names) => `import { ${[...new Set([...names.split(',').map(name => name.trim()), 'lazy', 'Suspense'])].join(', ')} } from 'react';`, file, 'importaciones de React');
      after = once(after, /function paginaActual\(\)/, "const OwnerMeliponariosPage = lazy(() => import('./pages/Owner/OwnerMeliponariosPage'));\n\nfunction paginaActual()", file, 'inicio de las rutas');
    }
    if (!after.includes('esRutaCliente(pagina)')) {
      after = once(after, /function paginaActual\(\)\s*\{[\s\S]*?\n\}/, block => once(block, /return\s+/, 'return esRutaCliente(pagina) || ', file, 'rutas'), file, 'paginaActual');
    }
    if (!after.includes('<OwnerMeliponariosPage')) {
      const branch = '\n  if (esRutaCliente(page))\n    return <Suspense fallback={<main role="status" className="min-h-screen bg-[#f8f7f1] p-10 text-[#163e2c]">Preparando tu espacio…</main>}><OwnerMeliponariosPage route={page} user={user} sessionReady={sessionReady} onLogout={cerrarSesion}/></Suspense>;\n';
      after = once(after, /[ \t]*if \(page\.startsWith\(["']meliponario\/["']\)\)/, found => branch + found, file, 'pantalla de detalle');
    }
    if (!after.includes("new CustomEvent('kaabmap:before-owner-leave'")) {
      const guard = "let hashAnterior = window.location.hash;\n    const actualizar = () => {\n      const destino = window.location.hash;\n      const continuar = () => {\n        hashAnterior = destino;\n        window.history.replaceState(null, '', window.location.pathname + window.location.search + destino);\n        setPage(paginaActual());\n        return true;\n      };\n      const event = new CustomEvent('kaabmap:before-owner-leave', { cancelable: true, detail: { continuar } });\n      if (!window.dispatchEvent(event)) {\n        window.history.replaceState(null, '', window.location.pathname + window.location.search + hashAnterior);\n        return;\n      }\n      continuar();\n    };";
      after = once(after, /const actualizar = \(\) => setPage\(paginaActual\(\)\);/, guard, file, 'cambio de ruta');
    }
  } else if (file.includes('/Explore/')) {
    after = addImport(after, "import { ClientAccountLinks, ClientRegistrationButton } from '../../components/ClientNavigation';");
    if (!after.includes('<ClientAccountLinks')) after = once(after, /\{errorCuenta &&/, '<ClientAccountLinks user={user}/>\n                  {errorCuenta &&', file, 'menú de cuenta');
    if (!after.includes('<ClientRegistrationButton')) after = once(after, /<span\b[^>]*>Datos e imágenes de demostración<\/span>/, badge => `<div className="flex flex-wrap items-center gap-3"><ClientRegistrationButton user={user} sessionReady={sessionReady}/>${badge}</div>`, file, 'encabezado de Explorar');
  } else {
    after = addImport(after, "import { ClientAccountLinks } from '../../components/ClientNavigation';");
    if (!after.includes('<ClientAccountLinks')) {
      const end = after.indexOf(file.includes('/Map/') ? 'export default function MapPage' : 'function CabeceraDetalle');
      if (end < 0) throw new Error(`${file}: no se encontró el control de cuenta esperado. No se modificó ningún archivo.`);
      const account = after.slice(0, end);
      after = once(account, /\{error &&/, '<ClientAccountLinks user={user}/>\n      {error &&', file, 'menú de cuenta') + after.slice(end);
    }
  }
  prepared.push({ file, before, after });
}
// Todas las comprobaciones terminan antes de escribir. El respaldo contiene
// solo estos cuatro componentes; nunca incluye la configuración local.
const changes = prepared.filter(item => item.before !== item.after);
for (const { file, before } of changes) if (await readFile(join(root, file), 'utf8') !== before) throw new Error(`${file} cambió durante la preparación. Vuelve a ejecutar el paso.`);
if (!changes.length) console.log('El registro ya está integrado. No hizo falta cambiar archivos.');
else {
  const backup = resolve(tmpdir(), 'KaabMap-respaldo-registro-' + new Date().toISOString().replace(/[:.]/g, '-'));
  for (const { file } of changes) { const dest = join(backup, file); await mkdir(join(dest, '..'), { recursive: true }); await copyFile(join(root, file), dest); }
  for (const { file, after } of changes) { await writeFile(join(root, file), after, 'utf8'); console.log('Integrado: ' + file); }
  console.log('Respaldo de los archivos anteriores: ' + backup);
  console.log('Ahora ejecuta npm run lint y npm run build. Revisa git diff antes de confirmar.');
}
