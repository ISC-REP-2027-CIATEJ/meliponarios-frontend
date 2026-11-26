import test from 'node:test';
import assert from 'node:assert/strict';
import { crearBajasApi } from '../src/features/adminDeactivations/bajasApi.mjs';
const id=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
function preparar() {
  const f={rol:1,activo:true,usuario:id(1),lecturas:0,escrituras:[],fallo:null,filas:[],version:2,retiroAusente:false};
  const api=crearBajasApi({
    auth:{getUser:async()=>({data:{user:{id:f.usuario}}})},
    from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{id:id(1),rol_id:f.rol,activo:f.activo}})}),
    rpc(nombre,args){
      if(nombre==='admin_estado_retiro_baja')return {maybeSingle:async()=>f.retiroAusente
        ?{error:{code:'PGRST202'}}
        :{data:{meliponario_id:id(3),version_contrato:f.version,estado_operativo:'inactivo',visibilidad:'privado',publicacion_bloqueada:true}}};

      if(nombre==='admin_resolver_desactivacion_meliponario'){
        f.escrituras.push(args);
        if(f.fallo==='red')throw Error('Sin conexión');
        return Promise.resolve(f.fallo?{error:{code:f.fallo}}:{data:args.p_solicitud_id});
      }
      assert.equal(nombre,'admin_bandeja_desactivaciones_meliponario');
      return {order(){return this;},range(offset){f.lecturas++;return Promise.resolve({data:offset?[]:f.filas});}};
    },
  });
  return {f,api};
}
test('la bandeja consume sus campos documentados sin trasladar datos privados de cuenta',async()=>{
  const {f,api}=preparar();
  f.filas=[{solicitud_id:id(2),meliponario_id:id(3),nombre_meliponario:'Unidad',cliente_nombre:'Ana',cliente_apellidos:'Pérez',
    motivo:'Solicitud del propietario',fecha_solicitud:'2026-11-24T12:00:00Z',correo:'PRIVADO'}];
  const r=await api.pendientes(id(1));
  assert.equal(r[0].cliente,'Ana Pérez');assert.equal(f.lecturas,2);
  assert.ok(!JSON.stringify(r).includes('PRIVADO'));
});
test('ambas decisiones utilizan exactamente la firma confirmada y el comentario recortado',async()=>{
  for(const decision of ['aprobar','rechazar']){
    const {f,api}=preparar();
    assert.equal(await api.resolver(id(1),id(2),decision,' Comentario de resolución '),id(2));
    assert.deepEqual(f.escrituras,[{p_solicitud_id:id(2),p_decision:decision,p_comentario:'Comentario de resolución'}]);
  }
});
test('valores inválidos, cuenta inactiva y otro rol impiden resolver',async()=>{
  const {f,api}=preparar();
  await assert.rejects(api.resolver(id(1),id(2),'aprobada','Comentario suficiente'));
  await assert.rejects(api.resolver(id(1),id(2),'aprobar','corto'));
  f.rol=3;
  await assert.rejects(api.resolver(id(1),id(2),'aprobar','Comentario suficiente'));
  f.rol=1;f.activo=false;
  await assert.rejects(api.resolver(id(1),id(2),'rechazar','Comentario suficiente'));
  assert.equal(f.escrituras.length,0);
});
test('una resolución concurrente y una respuesta perdida exigen comprobar la solicitud',async()=>{
  const {f,api}=preparar();
  f.fallo='22023';
  await assert.rejects(api.resolver(id(1),id(2),'aprobar','Comentario suficiente'),/ya fue resuelta/);
  f.fallo='red';
  await assert.rejects(api.resolver(id(1),id(2),'aprobar','Comentario suficiente'),e=>e.incierto===true);
});

test('sin contrato de retiro actualizado, no se aprueba ni se escribe una baja',async()=>{
  const {f,api}=preparar();
  f.retiroAusente=true;
  await assert.rejects(api.resolver(id(1),id(2),'aprobar','Comentario suficiente'),e=>e.sinEscritura===true);
  assert.equal(f.escrituras.length,0);
  assert.equal(await api.resolver(id(1),id(2),'rechazar','Comentario suficiente'),id(2));
});
test('la comprobación de retiro consulta únicamente como administrador activo',async()=>{
  const {f,api}=preparar();
  assert.deepEqual(await api.estadoRetiro(id(1),id(2)),{registro:id(3),estado:'inactivo',privado:true,bloqueado:true});
  f.rol=5;await assert.rejects(api.estadoRetiro(id(1),id(2)),/administrador/);
});
