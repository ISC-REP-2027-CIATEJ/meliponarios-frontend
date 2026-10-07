export const questions = [
  {key:'relationship', label:'1. ¿Cuál es tu relación con el meliponario?', options:['Propietario/a','Responsable de su cuidado','Representante de un grupo','Estoy por comenzar']},
  {key:'hasApiary', label:'2. ¿Actualmente cuidas o tienes un meliponario?', options:['Sí','Estoy iniciando','Todavía no']},
  {key:'apiaryCount', label:'3. ¿Cuántos meliponarios tienes a tu cargo?', options:['1','2','3 o más','Aún ninguno']},
  {key:'hasName', label:'4. ¿Tu primer meliponario tiene nombre?', options:['Sí','No tiene nombre','Aún no aplica'], extra:{when:'Sí',key:'apiaryName',label:'Nombre del meliponario (opcional)'}},
  {key:'state', label:'5. ¿En qué estado está tu primer meliponario?', options:['Yucatán','Campeche','Quintana Roo','Otro','Aún no aplica'], extra:{when:'Otro',key:'otherState',label:'Escribe el estado',required:true}},
  {key:'municipality', label:'6. ¿En qué municipio está?', kind:'place'},
  {key:'locality', label:'7. ¿En qué localidad o comunidad está?', kind:'place'},
  {key:'placeType', label:'8. ¿En qué tipo de lugar se encuentra?', options:['Patio de casa','Parcela o finca','Espacio comunitario','Otro','Aún no aplica'], extra:{when:'Otro',key:'otherPlace',label:'Especifica el lugar',required:true}},
  {key:'careTeam', label:'9. ¿Lo cuidas por tu cuenta o con otras personas?', options:['Por mi cuenta','Con mi familia','En grupo','Otro','Aún no aplica'], extra:{when:'Otro',key:'otherCareTeam',label:'Especifica con quién',required:true}},
  {key:'experience', label:'10. ¿Desde hace cuánto cuidas abejas sin aguijón?', options:['Estoy empezando','Menos de 1 año','1–5 años','Más de 5 años']},
  {key:'speciesKnowledge', label:'11. ¿Conoces las especies que tienes?', options:['Sí','Algunas','No sé','Aún no tengo']},
  {key:'colonies', label:'12. Aproximadamente, ¿cuántas colonias cuidas?', options:['1–5','6–10','11–20','Más de 20','No sé','Aún ninguna']},
  {key:'purposes', label:'13. ¿Para qué mantienes tu meliponario?', kind:'multi', options:['Autoconsumo','Producción para venta','Conservación','Aprendizaje o educación','Otro','Aún por definir'], extra:{when:'Otro',key:'otherPurpose',label:'Especifica la finalidad',required:true}},
  {key:'association', label:'14. ¿Formas parte de un grupo o asociación de productores?', options:['Sí','No','Prefiero no responder'], extra:{when:'Sí',key:'associationName',label:'Nombre del grupo (opcional)'}},
  {key:'contactTime', label:'15. ¿En qué horario prefieres que te contacte el equipo?', options:['Mañana','Tarde','Cualquiera','Por acordar']},
];
export const initialData = {firstName:'',lastName:'',phone:'',email:'',password:'',confirmPassword:'',purposes:[]};
export const noApiary = d => d.hasApiary === 'Todavía no' || d.apiaryCount === 'Aún ninguno';
const naFields = ['hasName','state','municipality','locality','placeType','careTeam'];
export function updateAnswer(d,key,value) {
  const next={...d,[key]:value};
  if(key==='state' && value!==d.state) { next.municipality=''; next.locality=''; }
  if(key==='municipality' && value!==d.municipality) next.locality='';
  if (key==='hasApiary' && value==='Todavía no') next.apiaryCount='Aún ninguno';
  if (noApiary(next)) {
    for(const k of naFields) next[k]='Aún no aplica';
    next.speciesKnowledge='Aún no tengo'; next.colonies='Aún ninguna';
  } else if(noApiary(d)) {
    for(const k of naFields) next[k]='';
    next.speciesKnowledge=''; next.colonies='';
  }
  for(const q of questions) if(q.extra && !(Array.isArray(next[q.key]) ? next[q.key].includes(q.extra.when) : next[q.key]===q.extra.when)) next[q.extra.key]='';
  return next;
}
export function validateStep(step,d) {
  const e={};
  if(step===0) {
    if(!d.firstName.trim()) e.firstName='Escribe tu nombre.';
    if(!d.lastName.trim()) e.lastName='Escribe tus apellidos.';
    if(!/^\+?[\d\s()-]{10,25}$/.test(d.phone.trim()) || d.phone.replace(/\D/g,'').length<10 || d.phone.replace(/\D/g,'').length>15) e.phone='Escribe un teléfono de 10 a 15 dígitos.';
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) e.email='Escribe un correo válido.';
    if(Array.from(d.password).length<8 || Array.from(d.password).length>128) e.password='Utiliza entre 8 y 128 caracteres.';
    if(!d.confirmPassword || d.password!==d.confirmPassword) e.confirmPassword='Las contraseñas deben coincidir.';
  } else {
    for(const q of questions.slice((step-1)*5,step*5)) {
      const value=d[q.key];
      if(!value || (Array.isArray(value) ? !value.length : !value.trim())) e[q.key]='Responde esta pregunta.';
      if(q.extra?.required && (Array.isArray(value) ? value.includes(q.extra.when) : value===q.extra.when) && !d[q.extra.key]?.trim()) e[q.extra.key]='Completa este campo.';
    }
  }
  return e;
}
export function buildPayload(d) {
  const answers={};
  for(const q of questions) {
    answers[q.key]=typeof d[q.key]==='string' ? d[q.key].trim() : d[q.key];
    if(q.extra && (Array.isArray(d[q.key]) ? d[q.key].includes(q.extra.when) : d[q.key]===q.extra.when)) answers[q.extra.key]=d[q.extra.key]?.trim() || null;
  }
  return {profile:{firstName:d.firstName.trim(),lastName:d.lastName.trim(),phone:d.phone.trim()},credentials:{email:d.email.trim(),password:d.password},questionnaire:{version:1,answers}};
}
