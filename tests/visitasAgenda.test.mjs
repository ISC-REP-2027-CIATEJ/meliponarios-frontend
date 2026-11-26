import test from 'node:test';
import assert from 'node:assert/strict';
import { crearVisitasApi } from '../src/features/visits/visitasApi.mjs';
import { fechaValida,hoyMexico,sumarDias,rangoVisible,avanzar,horaVisible } from '../src/features/visits/fechasVisita.mjs';
const id=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
const fecha=sumarDias(hoyMexico(),1);
function simular(rol=4) {
  const f={rol,activo:true,usuario:id(1),llamadas:[],respuestas:{},perder:false};
  const cliente={
    auth:{getUser:async()=>({data:{user:{id:f.usuario}}})},
    from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{id:id(1),rol_id:f.rol,activo:f.activo}})}),
    rpc(nombre,args){
      f.llamadas.push({nombre,args});
      if(nombre==='trabajador_programar_visita_tecnica'){
        if(f.perder)throw Error('Conexión interrumpida');
        return Promise.resolve({data:args.p_asignacion_id});
      }
      const rows=f.respuestas[nombre] || [];
      return {order(){return this;},range(offset){return Promise.resolve({data:offset?[]:rows});}};
    },
  };
  return {f,api:crearVisitasApi(cliente)};
}
test('las fechas civiles cruzan meses, años y el cambio de día en México sin desplazar la visita',()=>{
  assert.equal(hoyMexico(new Date('2026-11-24T02:00:00Z')),'2026-11-23');
  assert.equal(hoyMexico(new Date('2026-11-24T08:00:00Z')),'2026-11-24');
  assert.equal(avanzar('2026-12-31',1,'mes'),'2027-01-01');
  assert.equal(sumarDias('2026-12-31',1),'2027-01-01');
  assert.equal(fechaValida('2026-02-30'),false);
  assert.equal(horaVisible(null),'Hora pendiente');
  assert.equal(horaVisible('09:30:00'),'09:30');
  assert.deepEqual(rangoVisible('2026-11-24','semana'),{inicio:'2026-11-23',fin:'2026-11-29'});
  for(let m=1;m<=12;m++){
    const r=rangoVisible('2026-'+String(m).padStart(2,'0')+'-15');
    assert.equal((Date.parse(r.fin)-Date.parse(r.inicio))/86400000,41);
  }
});
test('cada rol usa su calendario y omite campos internos al presentar el resultado',async()=>{
  for(const [rol,nombre] of [[3,'coord_calendario_visitas_tecnicas'],[4,'mis_visitas_tecnicas_calendario'],[5,'cliente_mis_visitas_tecnicas']]){
    const {f,api}=simular(rol);
    f.respuestas[nombre]=[{asignacion_id:id(2),meliponario_id:id(3),nombre_meliponario:'Meliponario',
      fecha_programada:fecha,hora_programada:null,tipo_visita:'seguimiento',estado_asignacion:'asignada',
      trabajador_nombre:'Ana',motivo_asignacion:'Nota operativa',correo:'PRIVADO'}];
    const r=await api.calendario(id(1),rol,fecha,fecha);
    assert.equal(f.llamadas[0].nombre,nombre);
    assert.equal(r[0].fecha,fecha);assert.equal(r[0].hora,null);
    assert.ok(!JSON.stringify(r).includes('PRIVADO'));
    if(rol===5){assert.equal(r[0].motivo,'');assert.equal(r[0].trabajador,'');}
  }
});
test('el intervalo admite 63 días y rechaza el día adicional antes de consultar',async()=>{
  const {f,api}=simular();
  await api.calendario(id(1),4,fecha,sumarDias(fecha,62));
  f.llamadas=[];
  await assert.rejects(api.calendario(id(1),4,fecha,sumarDias(fecha,63)),/63 días/);
  assert.equal(f.llamadas.length,0);
});
test('la programación envía hora y motivo vacíos como nulos y solo escribe con trabajador activo',async()=>{
  const {f,api}=simular();
  await api.programar(id(1),id(2),fecha,'','');
  assert.deepEqual(f.llamadas[0],{nombre:'trabajador_programar_visita_tecnica',args:{p_asignacion_id:id(2),p_fecha_programada:fecha,p_hora_programada:null,p_motivo:null}});
  f.rol=3;f.llamadas=[];
  await assert.rejects(api.programar(id(1),id(2),fecha,'10:00','Cambio acordado'));
  assert.equal(f.llamadas.length,0);
  f.rol=4;f.activo=false;
  await assert.rejects(api.programar(id(1),id(2),fecha,'10:00',''));
});
test('fecha pasada, hora inválida y motivo incompleto impiden escribir',async()=>{
  const {f,api}=simular();
  for(const [dia,hora,motivo] of [[sumarDias(hoyMexico(),-1),'',''],[fecha,'25:00',''],[fecha,'','corto']]){
    await assert.rejects(api.programar(id(1),id(2),dia,hora,motivo));
  }
  assert.equal(f.llamadas.length,0);
});
test('una respuesta perdida requiere comprobar antes de reintentar',async()=>{
  const {f,api}=simular();f.perder=true;
  await assert.rejects(api.programar(id(1),id(2),fecha,'',''),e=>e.incierto===true);
});
test('la agenda conserva visitas sin fecha y los comentarios de corrección',async()=>{
  const {f,api}=simular();
  f.respuestas.mis_visitas_tecnicas_trabajador_detalle=[{asignacion_id:id(2),meliponario_id:id(3),nombre_meliponario:'Prueba',
    fecha_programada:null,hora_programada:null,comentario_correccion:'Verificar ubicación'}];
  const rows=await api.asignadas(id(1));
  assert.equal(rows[0].fecha,null);assert.equal(rows[0].correccion,'Verificar ubicación');
});
test('el cliente y el trabajador carecen de acceso a historiales del coordinador',async()=>{
  for(const rol of [4,5]){
    const {api,f}=simular(rol);
    await assert.rejects(api.horarios(id(1),id(3)));
    assert.equal(f.llamadas.length,0);
  }
});
