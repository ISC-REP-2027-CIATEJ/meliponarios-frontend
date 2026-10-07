import { useEffect, useRef, useState } from 'react';
import { register } from '../../services/authService';
import { buildPayload, initialData, noApiary, questions, updateAnswer, validateStep } from './registration';
import './RegisterPage.css';
const titles=['Crear cuenta','Cuéntanos sobre ti','Tu meliponario','Datos básicos','Revisa y crea tu cuenta'];
const sideTitles=['Crea tu cuenta','Cuéntanos sobre ti','Tu primer meliponario.','Últimos detalles.','Ya casi terminamos.'];
const descriptions=['Usa la misma cuenta en la web y en la app para dar seguimiento a tus meliponarios junto con el equipo técnico de CIATEJ.','Estas preguntas son generales y rápidas de responder. No necesitas datos técnicos ni fotografías.','Si tienes varios sitios, responde sobre uno para comenzar. Podrás añadir los demás más adelante.','Solo necesitamos un panorama general. El desglose técnico se completará en una etapa posterior.','Revisa que tus datos sean correctos antes de crear tu cuenta de productor.'];

export default function RegisterPage({onLogin}) {
  const [step,setStep]=useState(0);
  const [data,setData]=useState({...initialData});
  const [errors,setErrors]=useState({});
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [success,setSuccess]=useState(null);
  const [visible,setVisible]=useState({});
  const pending=useRef(false);
  const title=useRef(null);
  const requestKey=useRef(null);
  const hasChanges=Boolean(data.firstName || data.lastName || data.phone || data.email || data.password);
  useEffect(()=>{title.current?.focus(); window.scrollTo(0,0);},[step,success]);
  useEffect(()=>{
    if(!hasChanges || success) return;
    const warn=e=>{e.preventDefault();e.returnValue='';};
    window.addEventListener('beforeunload',warn);
    return ()=>window.removeEventListener('beforeunload',warn);
  },[hasChanges,success]);
  function change(key,value) { requestKey.current=null; setData(d=>updateAnswer(d,key,value));setErrors(e=>({...e,[key]:undefined}));setError(''); }
  function move(n) {setErrors({});setError('');setStep(n);}
  function leave() {if(!hasChanges || success || window.confirm('¿Volver al login? Se descartará este registro sin enviar.')) onLogin();}
  function focusError(e) {requestAnimationFrame(()=>document.getElementById(Object.keys(e)[0])?.focus());}
  async function submit(event) {
    event.preventDefault();
    if(pending.current) return;
    if(step<4) {const e=validateStep(step,data);setErrors(e);if(Object.keys(e).length){focusError(e);return;}move(step+1);return;}
    for(let s=0;s<4;s++){const e=validateStep(s,data);if(Object.keys(e).length){setStep(s);setErrors(e);setError('Revisa los campos indicados.');focusError(e);return;}}
    pending.current=true;setBusy(true);setError('');
    requestKey.current ||= crypto.randomUUID();
    try {const result=await register(buildPayload(data),requestKey.current);setSuccess(result);setData({...initialData});requestKey.current=null;}
    catch(err){setError(err.message);}
    finally{setBusy(false);pending.current=false;}
  }
  function textField(key,label,props={}) {
    return <div className="reg-field" key={key}><label htmlFor={key}>{label}</label><input id={key} name={key} value={data[key]||''} onChange={e=>change(key,e.target.value)} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key]?`${key}-error`:undefined} maxLength={150} {...props}/>{errors[key] && <p className="field-error" id={`${key}-error`}>{errors[key]}</p>}</div>;
  }
  function passwordField(key,label) {
    return <div className="reg-field"><label htmlFor={key}>{label}</label><div className="password-wrap"><input id={key} name={key} type={visible[key]?'text':'password'} autoComplete="new-password" value={data[key]} onChange={e=>change(key,e.target.value)} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key]?`${key}-error`:'password-help'} required/><button className="eye-button" type="button" aria-label={`${visible[key]?'Ocultar':'Mostrar'} ${label.toLowerCase()}`} aria-pressed={Boolean(visible[key])} onClick={()=>setVisible(v=>({...v,[key]:!v[key]}))}>{visible[key]?'◉':'◎'}</button></div>{errors[key]&&<p className="field-error" id={`${key}-error`}>{errors[key]}</p>}</div>;
  }
  function question(q) {
    const value=data[q.key];
    const locked=noApiary(data) && ['hasName','state','municipality','locality','placeType','careTeam','speciesKnowledge','colonies'].includes(q.key);
    const options=q.key==='apiaryCount' && data.hasApiary==='Todavía no' ? ['Aún ninguno'] : q.options;
    const extra=q.extra && (Array.isArray(value)?value.includes(q.extra.when):value===q.extra.when);
    return <fieldset className="question" key={q.key} disabled={locked} aria-describedby={errors[q.key]?`${q.key}-error`:undefined}><legend>{q.label}</legend>
      {q.kind==='place'? <div className="place-entry"><input id={q.key} aria-label={q.label} value={value==='Aún no aplica'?'':value||''} disabled={locked||value==='Aún no aplica'} placeholder={q.key==='municipality'?'Escribe el municipio':'Ej. San Benito'} maxLength={150} onChange={e=>change(q.key,e.target.value)}/><label className="choice"><input type="checkbox" checked={value==='Aún no aplica'} onChange={e=>change(q.key,e.target.checked?'Aún no aplica':'')}/>Aún no aplica</label></div>:
      <div className="choice-grid">{options.map((option,i)=><label className="choice" key={option}><input id={i===0?q.key:undefined} name={q.key} type={q.kind==='multi'?'checkbox':'radio'} value={option} checked={q.kind==='multi'?(value||[]).includes(option):value===option} onChange={()=>{
        if(q.kind!=='multi') return change(q.key,option);
        const old=value||[];
        const next=old.includes(option)?old.filter(x=>x!==option):option==='Aún por definir'?['Aún por definir']:[...old.filter(x=>x!=='Aún por definir'),option];
        change(q.key,next);
      }}/>{option}</label>)}</div>}
      {locked && <p className="reg-help">No aplica mientras no tengas un meliponario.</p>}
      {errors[q.key]&&<p className="field-error" id={`${q.key}-error`}>{errors[q.key]}</p>}
      {extra && textField(q.extra.key,q.extra.label,{required:q.extra.required})}
    </fieldset>;
  }
  function card(heading,target,rows) {return <section className="review-card"><header><h3>{heading}</h3><button type="button" className="text-button" onClick={()=>move(target)} disabled={busy}>Editar</button></header><dl>{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{Array.isArray(value)?value.join(', '):value||'Sin responder'}</dd></div>)}</dl></section>;}
  return <main className="registration-layout"><aside className="registration-aside"><div className="brand">◒ KaabMap</div><div><p className="eyebrow">CIATEJ · SURESTE</p><h2>{sideTitles[step]}</h2><p>{descriptions[step]}</p>{step===0&&<ul><li>Registra tus datos personales para iniciar tu perfil.</li><li>Un trabajador de campo añadirá la información técnica posteriormente.</li></ul>}</div><small className="copyright">© 2026 CIATEJ · UNIDAD SURESTE</small></aside>
    <section className="registration-main"><div className="registration-content">
      {!success && <div className="step-progress"><span>PASO {step+1} DE 5</span><progress value={step+1} max="5" aria-label={`Paso ${step+1} de 5`}/></div>}
      <h1 ref={title} tabIndex="-1">{success?'Cuenta creada':titles[step]}</h1>
      {success?<div role="status"><p>{success.emailVerificationRequired?'Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.':'Tu registro fue confirmado por el servidor. Ya puedes iniciar sesión.'}</p><button className="primary" onClick={onLogin}>Ir al login</button></div>:
      <form noValidate onSubmit={submit} aria-busy={busy}>
        <fieldset className="registration-fields" disabled={busy}>
          {step===0 && <><p className="reg-intro">Regístrate como productor y gestiona tus recursos desde cualquier dispositivo.</p><h2 className="reg-section-title">Tus datos</h2><div className="personal-grid">{textField('firstName','Nombre(s)',{autoComplete:'given-name',required:true})}{textField('lastName','Apellidos',{autoComplete:'family-name',required:true})}</div>{textField('phone','Teléfono',{type:'tel',autoComplete:'tel',placeholder:'999 123 4567',required:true,maxLength:25})}<h2 className="reg-section-title">Acceso a tu cuenta</h2>{textField('email','Correo electrónico',{type:'email',autoComplete:'email',autoCapitalize:'none',spellCheck:false,required:true})}<div className="personal-grid">{passwordField('password','Contraseña')}{passwordField('confirmPassword','Confirmar contraseña')}</div><p id="password-help" className="reg-help">Utiliza entre 8 y 128 caracteres. Puedes usar una frase larga, espacios y símbolos.</p></>}
          {step>0 && step<4 && <><p className="reg-intro">Preguntas {(step-1)*5+1}–{step*5} de 15</p>{questions.slice((step-1)*5,step*5).map(question)}</>}
          {step===4 && <><p className="reg-intro">Verifica la información antes de enviarla.</p>{card('Datos personales',0,[['Nombre(s)',data.firstName],['Apellidos',data.lastName],['Teléfono',data.phone]])}{card('Acceso a tu cuenta',0,[['Correo electrónico',data.email],['Contraseña','No se muestra por seguridad']])}{[1,2,3].map(s=><div key={s}>{card(titles[s],s,questions.slice((s-1)*5,s*5).flatMap(q=>[[q.label,data[q.key]],...(q.extra&&data[q.extra.key]?[[q.extra.label,data[q.extra.key]]]:[])]))}</div>)}<p className="reg-help">La información técnica del meliponario se completará en una etapa posterior.</p></>}
        </fieldset>
        {error&&<p className="error-box" role="alert">{error}</p>}
        <div className="registration-actions">{step>0 && <button className="secondary" type="button" onClick={()=>move(step-1)} disabled={busy}>Atrás</button>}<button className="primary" type="submit" disabled={busy}>{busy?'Creando cuenta…':step===4?'Crear cuenta':step===3?'Revisar mis datos':'Continuar'}</button></div>
        <p className="login-return">¿Ya tienes cuenta? <button className="text-button" type="button" onClick={leave} disabled={busy}>Iniciar sesión</button></p>
        <p className="draft-note">Las respuestas se conservan entre pasos. Si cierras o recargas la página antes de enviar, se perderán.</p>
      </form>}
    </div></section></main>;
}
