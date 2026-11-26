import test from 'node:test';
import assert from 'node:assert/strict';
import { crearBorradoresApi } from '../src/features/ownerMeliponarios/borradoresApi.mjs';
const id=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
function preparar(){
  const f={usuario:id(1),rol:5,activo:true,error:null,red:false,respuesta:id(2),llamadas:[]};
  const api=crearBorradoresApi({
    auth:{getUser:async()=>({data:{user:{id:f.usuario}}})},
    from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{id:id(1),rol_id:f.rol,activo:f.activo}})}),
    rpc(nombre,args){
      f.llamadas.push({nombre,args});
      if(nombre==='cliente_estado_borrador_eliminable')return {maybeSingle:async()=>({data:{meliponario_id:id(2),puede_eliminar:true,motivo_bloqueo:'',cantidad_fotos:0},error:f.error})};
      if(f.red)throw Error('Sin conexión');
      return Promise.resolve({data:f.respuesta,error:f.error});
    }
  });
  return {f,api};
}
test('consulta el borrador con la identidad propia y muestra solo el resultado de elegibilidad',async()=>{
  const {f,api}=preparar();
  assert.deepEqual(await api.consultar(id(1),id(2)),{puedeEliminar:true,fotos:0,motivo:''});
  assert.deepEqual(f.llamadas,[{nombre:'cliente_estado_borrador_eliminable',args:{p_meliponario_id:id(2)}}]);
});
test('eliminación usa únicamente la RPC y requiere confirmación del identificador eliminado',async()=>{
  const {f,api}=preparar();
  assert.equal(await api.eliminar(id(1),id(2)),id(2));
  assert.deepEqual(f.llamadas,[{nombre:'cliente_eliminar_borrador_meliponario',args:{p_meliponario_id:id(2)}}]);
  f.respuesta=null;
  await assert.rejects(api.eliminar(id(1),id(2)),e=>e.incierto===true);
});
test('sesión distinta, cuenta inactiva y rol ajeno detienen la operación antes de llamar la RPC',async()=>{
  const {f,api}=preparar();
  f.usuario=id(3);await assert.rejects(api.eliminar(id(1),id(2)),/sesión/);
  f.usuario=id(1);f.activo=false;await assert.rejects(api.eliminar(id(1),id(2)),/activa/);
  f.activo=true;f.rol=1;await assert.rejects(api.eliminar(id(1),id(2)),/Cliente/);
  assert.equal(f.llamadas.length,0);
});
test('servicio ausente y registro cambiado se informan sin fingir una eliminación',async()=>{
  const {f,api}=preparar();
  f.error={code:'PGRST202'};await assert.rejects(api.consultar(id(1),id(2)),/no está habilitada/);
  f.error={code:'22023'};await assert.rejects(api.eliminar(id(1),id(2)),/debe conservarse/);
  f.error={code:'23503'};await assert.rejects(api.eliminar(id(1),id(2)),/No se eliminó/);
});
test('una respuesta perdida se marca como incierta y nunca se reenvía automáticamente',async()=>{
  const {f,api}=preparar();f.red=true;
  await assert.rejects(api.eliminar(id(1),id(2)),e=>e.incierto===true);
  assert.equal(f.llamadas.length,1);
});

