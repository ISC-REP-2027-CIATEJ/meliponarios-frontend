// Ejecutar por el usuario desde la raíz del proyecto, tras copiar este paso.
// Solo integra dos componentes del mapa. No cambia Login, Administración ni .env.
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.cwd();
const pkg = JSON.parse(await readFile(join(root,'package.json'),'utf8'));
if (pkg.name !== 'meliponarios-frontend') throw new Error('Ejecuta este paso desde la raíz de meliponarios-frontend.');
for (const file of ['src/components/ClientNavigation.jsx','src/pages/Owner/OwnerProducts.jsx','src/pages/Map/OwnMapLayer.jsx','src/features/ownerMeliponarios/privateMap.js']) await readFile(join(root,file),'utf8');
function once(source,before,after,name) {
  if (source.split(before).length !== 2) throw new Error(`No encontré una única sección de ${name}. No se modificó ningún componente. Comparte este mensaje para adaptar el paso a tu versión.`);
  return source.replace(before,after);
}
const prepared = [];
for (const file of ['src/pages/Map/MapPage.jsx','src/pages/Map/MapCanvas.jsx']) {
  const before = await readFile(join(root,file),'utf8');
  let after = before.replace(/\r\n/g,'\n');
  if (file.endsWith('/MapPage.jsx') && !after.includes('const propios = useOwnMapRecords(user, sessionReady);')) {
    after = "import { OwnMapNotice, PrivateMapSelection } from './OwnMapLayer';\nimport { useOwnMapRecords } from './useOwnMapRecords';\nimport { abrirRegistroPropio } from '../../features/ownerMeliponarios/privateMap';\n" + after;
    after = once(after,
      '  const resultados = useMemo(() => filtrarMeliponarios(meliponariosPublicosDemo, filtros), [filtros]);',
      "  const propios = useOwnMapRecords(user, sessionReady);\n  const resultados = useMemo(() => [...filtrarMeliponarios(meliponariosPublicosDemo, filtros), ...filtrarMeliponarios(propios.puntos, { ...filtros, activos: false })], [filtros, propios.puntos]);\n  const municipiosVisibles = useMemo(() => [...new Set([...municipios, ...propios.puntos.map(point => point.municipio)])].sort(), [propios.puntos]);\n  const abejasVisibles = useMemo(() => [...new Set([...especies, ...propios.puntos.flatMap(point => point.especies)])].sort(), [propios.puntos]);",'resultados del mapa');
    after = once(after,'  function abrirDetalle() {', "  function abrirDetalle() {\n    const rutaPropia = abrirRegistroPropio(seleccionado);\n    if (rutaPropia) { window.location.assign(rutaPropia); return; }",'apertura de un registro');
    after = once(after,'      <section aria-label="Buscar meliponarios en el mapa"','      <OwnMapNotice state={propios}/>\n      <section aria-label="Buscar meliponarios en el mapa"','aviso de privacidad');
    after = once(after,'{municipios.map(m =>','{municipiosVisibles.map(m =>','municipios del filtro');
    after = once(after,'{especies.map(e =>','{abejasVisibles.map(e =>','tipos de abejas del filtro');
    after = once(after,'              <div className="p-5">\n                <div className="flex flex-wrap items-start justify-between gap-3">','              <div className="p-5">\n                <PrivateMapSelection point={seleccionado}/>\n                <div className="flex flex-wrap items-start justify-between gap-3">','ficha del mapa');
    after = once(after,'>Conocer más del meliponario <Icon name="arrow"/>', ">{seleccionado.privadoDemo ? 'Ver mi registro' : 'Conocer más del meliponario'} <Icon name=\"arrow\"/>",'botón del detalle');
    after = once(after,'disabled={!onOpenDetail}>','disabled={!seleccionado.privadoDemo && !onOpenDetail}>','disponibilidad del detalle');
    after = once(after,'{m.nombre}</span><span className="mt-1 block text-xs', '{m.nombre}</span>{m.privadoDemo && <span className="mt-1 block text-xs font-bold text-[#796329]">Solo tú · {m.etiquetaPrivada}</span>}<span className="mt-1 block text-xs','etiqueta de la tarjeta');
  }
  if (file.endsWith('/MapCanvas.jsx')) {
    if (!after.includes('zoomAnimation: false')) after = once(after,'{ zoomControl: false, minZoom:','{ zoomControl: false, zoomAnimation: false, minZoom:','ciclo de vida del mapa');
    if (!after.includes('const privado = items.some')) {
      after = once(after,'        const punto = items[0];','        const punto = items[0];\n        const privado = items.some(item => item.privadoDemo);','marcadores privados');
      after = once(after,": punto.nombre;",": punto.privadoDemo ? `Privado: ${punto.nombre}. ${punto.etiquetaPrivada}` : punto.nombre;",'nombre accesible del marcador');
      after = once(after,'className: `kaab-marker ${agrupado',"className: `kaab-marker ${privado ? 'kaab-privado' : ''} ${agrupado",'estilo del marcador');
    }
  }
  if (before.includes('\r\n')) after = after.replace(/\n/g,'\r\n');
  prepared.push({file,before,after});
}
const changes = prepared.filter(item => item.before !== item.after);
for (const {file,before} of changes) if (await readFile(join(root,file),'utf8') !== before) throw new Error('Un componente cambió durante la preparación. Vuelve a ejecutar el paso.');
if (!changes.length) console.log('El paso 2 ya está integrado; no se duplicaron cambios.');
else {
  const backup = resolve(tmpdir(),'KaabMap-respaldo-registro-paso2-' + new Date().toISOString().replace(/[:.]/g,'-'));
  for (const {file} of changes) { const target=join(backup,file); await mkdir(join(target,'..'),{recursive:true}); await copyFile(join(root,file),target); }
  for (const {file,after} of changes) { await writeFile(join(root,file),after,'utf8'); console.log('Integrado: '+file); }
  console.log('Respaldo de los dos componentes: '+backup);
  console.log('Comprueba pruebas, lint, build y git diff antes de confirmar el avance.');
}
