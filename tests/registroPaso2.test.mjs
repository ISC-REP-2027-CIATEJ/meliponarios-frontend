import test from 'node:test';
import assert from 'node:assert/strict';
import { crearFormulario, eliminarBorrador, guardarRegistro, leerRegistros } from '../src/features/ownerMeliponarios/model.js';
import { obtenerCatalogosRegistro } from '../src/features/ownerMeliponarios/catalogos.js';
import { crearProducto, normalizarProducto, presentacionProducto, validarProducto } from '../src/features/ownerMeliponarios/productos.js';
import { abrirRegistroPropio, crearPuntosPropios } from '../src/features/ownerMeliponarios/privateMap.js';

const catalogos = await obtenerCatalogosRegistro();
const cliente = {id:'propietario-1',roleId:5};
function storage() { const map=new Map(); return {map,getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)}; }
function full() { return {...crearFormulario(),nombre:'Registro de prueba',municipioId:catalogos.municipios[0].id,localidadId:catalogos.localidades[0].id,coordenadas:[20.97,-89.62],abejas:[{tipoId:catalogos.abejas[0].id,cajas:1,jobones:0}],vendeMiel:true}; }
const miel = () => normalizarProducto({...crearProducto('miel'),cantidad:250,presentacion:'Frasco'});
const save = (store,form=crearFormulario(),extra={}) => guardarRegistro({userId:cliente.id,form,catalogos,...extra},store);

test('se elimina un borrador vacío y se conserva otro borrador del mismo dueño',()=>{
  const store=storage(); const a=save(store); const b=save(store,{...crearFormulario(),nombre:'Otro'});
  eliminarBorrador({userId:cliente.id,id:a.id},store);
  assert.deepEqual(leerRegistros(cliente.id,store).map(item=>item.id),[b.id]);
});
test('eliminar no acepta solicitudes enviadas ni registros de otra cuenta',()=>{
  const store=storage(); const sent=save(store,full(),{enviar:true});
  assert.throws(()=>eliminarBorrador({userId:cliente.id,id:sent.id},store),/solicitud enviada/);
  assert.throws(()=>eliminarBorrador({userId:'otra-cuenta',id:sent.id},store),/No encontramos/);
  assert.equal(leerRegistros(cliente.id,store).length,1);
});
test('eliminar vuelve a leer el almacenamiento y conserva altas posteriores',()=>{
  const store=storage(); const first=save(store); const later=save(store);
  eliminarBorrador({userId:cliente.id,id:first.id},store);
  assert.equal(leerRegistros(cliente.id,store)[0].id,later.id);
  assert.throws(()=>eliminarBorrador({userId:cliente.id,id:first.id},store),/No encontramos/);
});
test('un fallo de escritura al eliminar conserva el borrador',()=>{
  const store=storage(); const draft=save(store); store.setItem=()=>{throw Error('bloqueado');};
  assert.throws(()=>eliminarBorrador({userId:cliente.id,id:draft.id},store),/No se pudo eliminar/);
  assert.equal(leerRegistros(cliente.id,store)[0].id,draft.id);
});
test('los registros del paso 1 sin productos siguen legibles y editables',()=>{
  const store=storage(); const record=save(store); delete record.productos;
  const key=[...store.map.keys()][0]; store.map.set(key,JSON.stringify([record]));
  const loaded=leerRegistros(cliente.id,store)[0]; assert.deepEqual(crearFormulario(loaded).productos,[]);
  save(store,{...crearFormulario(loaded),productos:[miel()]},{id:loaded.id});
  assert.equal(leerRegistros(cliente.id,store)[0].productos[0].cantidad,250);
});
test('productos opcionales, presentaciones distintas y copia independiente',()=>{
  const product=miel(); assert.equal(validarProducto(product),'');
  assert.equal(presentacionProducto(product),'Frasco · 250 mL');
  assert.equal(validarProducto({...product,cantidad:50},[product]),'');
  assert.notEqual(validarProducto({...product,id:'otro'},[product]),'');
  const form=crearFormulario({...full(),productos:[product]}); form.productos[0].nombre='Cambio';
  assert.equal(product.nombre,'Miel');
  assert.equal(presentacionProducto(crearProducto('miel')),'');
});
test('no se aceptan cantidades inválidas ni imágenes arbitrarias',()=>{
  for(const cantidad of [0,-1,NaN,Infinity,' ',null,1000001]) assert.notEqual(validarProducto({...miel(),cantidad}), '');
  assert.equal(validarProducto({...miel(),cantidad:''}),'');
  assert.notEqual(validarProducto({...miel(),imagenId:'https://example.test/imagen.jpg'}),'');
  assert.notEqual(validarProducto({...miel(),imagenId:'jabon'}),'');
  assert.notEqual(validarProducto({...miel(),nombre:''}),'');
});
test('guardar conserva productos, los normaliza y mantiene el bloqueo tras el envío',()=>{
  const store=storage(); const record=save(store,{...full(),productos:[{...miel(),cantidad:'250',archivo:'no debe guardarse'}]});
  assert.equal(record.productos[0].cantidad,250); assert.equal('archivo' in record.productos[0],false);
  const sent=save(store,crearFormulario(record),{id:record.id,enviar:true});
  assert.equal(sent.productos.length,1);
  assert.throws(()=>save(store,{...crearFormulario(sent),productos:[]},{id:sent.id}),/bloqueados/);
});
test('productos corruptos no se sobrescriben y se rechazan IDs duplicados',()=>{
  const store=storage(); const record=save(store,{...full(),productos:[miel()]});
  const key=[...store.map.keys()][0]; const raw=JSON.stringify([{...record,productos:[record.productos[0],null]}]); store.map.set(key,raw);
  assert.throws(()=>leerRegistros(cliente.id,store),/formato inválido/); assert.equal(store.map.get(key),raw);
  const other=storage(); const p=miel(); assert.throws(()=>save(other,{...full(),productos:[p,{...p,cantidad:50}]}),/identificador repetido/);
});
test('el mapa privado solo incorpora registros del dueño y nunca de otro rol',()=>{
  const store=storage(); const record=save(store,full()); const stranger={...record,id:'ajeno',ownerId:'otra-cuenta'};
  assert.equal(crearPuntosPropios([record,stranger],cliente,catalogos).length,1);
  for(const user of [null,{id:cliente.id,roleId:1},{id:'otra-cuenta',roleId:5}]) assert.equal(crearPuntosPropios([record],user,catalogos).length,0);
});
test('borradores y solicitudes válidos aparecen sin convertirlos en activos o aprobados',()=>{
  const store=storage(); const draft=save(store,full()); const sent=save(store,full(),{enviar:true});
  const points=crearPuntosPropios([draft,sent],cliente,catalogos);
  assert.deepEqual(points.map(p=>p.estado),['Borrador','Pendiente']);
  assert.ok(points.every(p=>p.privadoDemo)); assert.match(points[1].etiquetaPrivada,/no aprobada/);
  assert.equal(abrirRegistroPropio(points[0]),'#mi-meliponario/'+encodeURIComponent(draft.id));
  assert.equal(abrirRegistroPropio({id:'publico'}),null);
  assert.equal(draft.estado,'borrador'); assert.equal(sent.estado,'enviado_demo');
});
test('el mapa omite coordenadas incompletas, estados desconocidos y conteos técnicos',()=>{
  const store=storage(); const record=save(store,{...full(),productos:[miel()]});
  assert.deepEqual(crearPuntosPropios([{...record,coordenadas:[20,'']}],cliente,catalogos),[]);
  assert.deepEqual(crearPuntosPropios([{...record,estado:'aprobado_inventado'}],cliente,catalogos),[]);
  const point=crearPuntosPropios([record],cliente,catalogos)[0];
  assert.equal('abejas' in point,false); assert.equal('ownerId' in point,false); assert.equal('cajas' in point,false);
  assert.deepEqual(point.productos,['Miel · Frasco · 250 mL']); assert.equal(point.ofertaVisualDemo,'miel');
});
