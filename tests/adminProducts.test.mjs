import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearCatalogo, prepararImagen, rutaObjeto } from '../src/features/adminProducts/catalogApi.mjs';

const id = '11111111-1111-4111-8111-111111111111';
const otro = '22222222-2222-4222-8222-222222222222';
const config = { bucket: 'prueba', plantilla: 'catalogo/{uuid}.{ext}' };
const foto = new Blob([Uint8Array.of(255,216,255,224)], {type:'image/jpeg'});
const existente = { id, nombre:'Producto de prueba', descripcion:null, imagen_storage:'archivo.jpg', activo:true, fecha_actualizacion:'2026-11-22' };
const valores = { nombre:' Miel ', descripcion:' ', archivo:foto };

function entorno({ activo=true, rol=1, errorRpc, lectura=existente }={}) {
  const llamadas=[], eliminadas=[], subidas=[];
  const storage = {
    upload: async (ruta, blob, opciones) => { subidas.push({ruta,blob,opciones}); return {error:null}; },
    remove: async rutas => { eliminadas.push(...rutas); return {data:rutas.map(name=>({name}))}; },
    download: async ruta => ({ data:ruta==='ausente.jpg'?null:foto, error:null }),
  };
  const client = {
    auth:{getUser: async()=>({data:{user:{id}}})},
    from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{id,rol_id:rol,activo}})})})}),
    storage:{from(bucket){ assert.equal(bucket,'prueba'); return storage; }},
    rpc(nombre,args){
      llamadas.push({nombre,args});
      if(nombre==='admin_listar_productos') return {
        eq:()=>({maybeSingle:async()=>({data:lectura})}),
        order:()=>({limit:()=>({gt:async()=>({data:[]}),then(resolve){resolve({data:[existente]});}})}),
      };
      if(errorRpc==='red') return Promise.reject(new Error('red'));
      return Promise.resolve({data:nombre==='admin_crear_producto'?otro:null, error:errorRpc});
    },
  };
  return {api:crearCatalogo(client,config,()=>otro), llamadas,eliminadas,subidas};
}

test('el listado acepta páginas cortas y comprueba administrador activo', async()=>{
  assert.deepEqual(await entorno().api.listar(id),[existente]);
  for(const op of [{activo:false},{rol:4}]) {
    const e=entorno(op);
    await assert.rejects(e.api.listar(id),/administrador/);
    await assert.rejects(e.api.guardar(id,null,valores),/administrador/);
    assert.equal(e.llamadas.length,0);
  }
});

test('alta sube con nombre único sin sobrescribir y remite ruta relativa', async()=>{
  const e=entorno(); await e.api.guardar(id,null,valores);
  assert.equal(e.subidas[0].opciones.upsert,false);
  assert.deepEqual(e.llamadas.at(-1),{nombre:'admin_crear_producto',args:{p_nombre:'Miel',p_descripcion:null,p_imagen_storage:'catalogo/'+otro+'.jpg'}});
});

test('edición sin imagen nueva conserva la existente, aun con configuración incompleta',async()=>{
  const e=entorno(); await e.api.guardar(id,existente,{...valores,archivo:null});
  assert.equal(e.subidas.length,0); assert.equal(e.llamadas.at(-1).args.p_imagen_storage,'archivo.jpg');
  assert.equal(e.llamadas.at(-1).nombre,'admin_actualizar_producto');
});

test('permite elegir un archivo existente y rechaza uno que no puede leerse', async()=>{
  const e=entorno(); await e.api.guardar(id,null,{...valores,archivo:null,rutaExistente:'guardada.jpg'});
  assert.equal(e.subidas.length,0);
  await assert.rejects(e.api.guardar(id,null,{...valores,archivo:null,rutaExistente:'ausente.jpg'}),/leer/);
});

test('rechazo confirmado limpia solo la foto nueva y una respuesta incierta la conserva',async()=>{
  const rechazo=entorno({errorRpc:{code:'23514',message:'Regla del catálogo'}});
  await assert.rejects(rechazo.api.guardar(id,existente,valores),/Regla/);
  assert.deepEqual(rechazo.eliminadas,['catalogo/'+otro+'.jpg']);
  const red=entorno({errorRpc:'red'});
  await assert.rejects(red.api.guardar(id,null,valores),e=>e.incierto===true);
  assert.deepEqual(red.eliminadas,[]);
});

test('las operaciones de estado aceptan void, preservan el registro y detectan cambios',async()=>{
  const e=entorno(); await e.api.cambiarEstado(id,existente);
  assert.deepEqual(e.llamadas.at(-1),{nombre:'admin_cambiar_estado_producto',args:{p_producto_id:id,p_activo:false}});
  const inactivo={...existente,activo:false};const alta=entorno({lectura:inactivo});
  await alta.api.cambiarEstado(id,inactivo);assert.equal(alta.llamadas.at(-1).args.p_activo,true);
  const cambiado=entorno({lectura:{...existente,nombre:'Otro'}});await assert.rejects(cambiado.api.cambiarEstado(id,existente),/cambió/);
});

test('respeta la plantilla, el tamaño y el tipo real del archivo', async()=>{
  assert.equal(await prepararImagen(foto,{...config,extensiones:['jpeg']},()=>otro),'catalogo/'+otro+'.jpeg');
  await assert.rejects(prepararImagen(foto,{...config,maxBytes:2},()=>otro),/tamaño/);
  await assert.rejects(prepararImagen(foto,{...config,tipos:['image/png']},()=>otro),/admitida/);
  await assert.rejects(prepararImagen(new Blob(['archivo'],{type:'image/png'}),config,()=>otro),/contenido/);
  for(const ruta of ['../foto.jpg','/raiz','https://ejemplo.test/foto',''])assert.throws(()=>rutaObjeto(ruta));
});

test('sin plantilla admite un destino explícito y verifica la extensión',async()=>{
  assert.equal(await prepararImagen(foto,{bucket:'prueba'},()=>otro,'ruta-confirmada/miel.jpg'),'ruta-confirmada/miel.jpg');
  await assert.rejects(prepararImagen(foto,{bucket:'prueba'},()=>otro,'ruta-confirmada/miel.png'),/extensión/);
});
