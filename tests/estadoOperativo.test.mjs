import test from 'node:test';
import assert from 'node:assert/strict';
import { crearEstadoOperativo } from '../src/features/ownerMeliponarios/estadoOperativo.mjs';
import { filtrarPublicos, normalizarFichaPublica } from '../src/features/publicMeliponarios/publicApi.mjs';

const usuario='10000000-0000-4000-8000-000000000001';
const registro='10000000-0000-4000-8000-000000000002';
function preparar() {
  const f={estado:'activo',sesion:usuario,rpc:[],lecturas:0,fallaLectura:false,fallo:null};
  const cliente={
    auth:{getUser:async()=>({data:{user:{id:f.sesion}}})},
    from(tabla){
      assert.equal(tabla,'meliponarios');
      return {select(campos){assert.equal(campos,'id,responsable_principal_id,estado_operativo');return this;},
        eq(){return this;},async maybeSingle(){
          f.lecturas++;
          return f.fallaLectura?{error:{}}:{data:{id:registro,responsable_principal_id:usuario,estado_operativo:f.estado}};
        }};
    },
    async rpc(nombre,args) {
      f.rpc.push({nombre,args});
      if(f.fallo==='red'){f.estado=args.p_estado_operativo;throw Error('Sin conexión');}
      if(f.fallo==='permiso')return {error:{code:'42501'}};
      f.estado=args.p_estado_operativo; f.fallaLectura=f.fallo==='lectura';
      return {data:'confirmado'};
    },
  };
  return {...f,base:f,api:crearEstadoOperativo(cliente)};
}
test('guarda cada estado mediante la RPC y comprueba el dato persistido',async()=>{
  for(const estado of ['activo','inactivo','temporalmente_suspendido','fuera_de_operacion']){
    const {base,api}=preparar();
    assert.deepEqual(await api.guardar(usuario,registro,'activo',estado),{id:registro,estadoOperativo:estado});
    assert.equal(base.lecturas,2);
    assert.deepEqual(base.rpc,[{nombre:'cliente_actualizar_estado_operativo',args:{p_meliponario_id:registro,p_estado_operativo:estado}}]);
  }
});
test('una sesión distinta o un estado inventado impiden la escritura',async()=>{
  const {base,api}=preparar();base.sesion=registro;
  await assert.rejects(api.guardar(usuario,registro,'activo','inactivo'));
  base.sesion=usuario;
  await assert.rejects(api.guardar(usuario,registro,'activo','publico'));
  assert.equal(base.rpc.length,0);
});
test('un cambio previo en otra sesión obliga a revisar el estado actual',async()=>{
  const {base,api}=preparar();base.estado='inactivo';
  await assert.rejects(api.guardar(usuario,registro,'activo','fuera_de_operacion'),e=>e.actual.estadoOperativo==='inactivo');
  assert.equal(base.rpc.length,0);
});
test('una respuesta perdida permite comprobar el estado sin repetir el cambio',async()=>{
  const {base,api}=preparar();base.fallo='red';
  await assert.rejects(api.guardar(usuario,registro,'activo','inactivo'),e=>e.incierto===true);
  assert.equal((await api.consultar(usuario,registro)).estadoOperativo,'inactivo');
  assert.equal(base.rpc.length,1);
});
test('un fallo de lectura posterior se identifica como guardado por comprobar',async()=>{
  const {base,api}=preparar();base.fallo='lectura';
  await assert.rejects(api.guardar(usuario,registro,'activo','inactivo'),e=>e.incierto===true);
});
test('un rechazo de permiso no se presenta como guardado confirmado',async()=>{
  const {base,api}=preparar();base.fallo='permiso';
  await assert.rejects(api.guardar(usuario,registro,'activo','inactivo'),/permiso/);
  assert.equal(base.estado,'activo');
});
test('el filtro de activos distingue actividad de aprobación técnica',()=>{
  const raw={id:registro,nombre:'Meliponario',ofrece_venta_miel:false,ofrece_visitas:true,informacion_tecnica_verificada:true,
    telefono_contacto:'0123456789',latitud:20,longitud:-89};
  for(const estado of ['inactivo','temporalmente_suspendido',null,'desconocido']){
    const ficha=normalizarFichaPublica({...raw,estado_operativo:estado});
    assert.equal(filtrarPublicos([ficha],{activos:true}).length,0);
  }
  const activo=normalizarFichaPublica({...raw,estado_operativo:'activo'});
  assert.equal(filtrarPublicos([activo],{activos:true}).length,1);
});
