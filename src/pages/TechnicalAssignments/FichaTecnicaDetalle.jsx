import { useState } from 'react';
import Icon from '../Explore/Icon';
import { etiquetaFicha, formatoDatoFicha, limpiarFicha } from '../../features/technicalAssignments/fichaPresentacion.mjs';
import './FichaTecnicaDetalle.css';

function Dato({ valor, clave = '', nivel = 0 }) {
  if (Array.isArray(valor)) {
    if (!valor.length) return <span className="ft-muted">Sin registros</span>;
    const simples = valor.every(v => v === null || typeof v !== 'object');
    return simples ? <ul className="ft-options" role="list">{valor.map((v, i) =>
      <li key={i}>{formatoDatoFicha(v, clave)}</li>)}</ul>
      : <div className="ft-collection">{valor.map((v, i) =>
        <article className="ft-item" key={i}><Dato valor={v} clave={clave} nivel={nivel + 1}/></article>)}</div>;
  }
  if (valor && typeof valor === 'object') {
    const entries = Object.entries(valor);
    if (!entries.length) return <span className="ft-muted">Sin información para mostrar</span>;
    return <dl className={nivel ? 'ft-fields ft-fields--nested' : 'ft-fields'}>{entries.map(([key, v]) =>
      <div className={v && typeof v === 'object' ? 'ft-field ft-field--wide' : 'ft-field'} key={key}>
        <dt>{etiquetaFicha(key)}</dt><dd><Dato valor={v} clave={key} nivel={nivel + 1}/></dd>
      </div>)}</dl>;
  }
  return <span className={valor === null || valor === '' ? 'ft-muted' : undefined}>{formatoDatoFicha(valor, clave)}</span>;
}

export default function FichaTecnicaDetalle({ detalle, fila }) {
  const [tab, setTab] = useState('respuestas');
  const ficha = limpiarFicha(detalle.ficha);
  const respuestas = limpiarFicha(detalle.respuestas);
  const visita = ficha?.visita || ficha?.formulario || ficha || {};
  const datos = [
    ['Trabajador de campo', fila.trabajadorNombre || fila.trabajador_nombre || 'Nombre no disponible'],
    ['Fecha de la visita', visita.fecha_visita ? formatoDatoFicha(visita.fecha_visita, 'fecha_visita') : 'Sin fecha registrada'],
    ['Enviada el', visita.fecha_envio ? formatoDatoFicha(visita.fecha_envio, 'fecha_envio') : 'Sin fecha de envío'],
  ];
  return <section className="ft-detail" aria-label="Información de la ficha técnica">
    <header className="ft-summary">
      <span className="km-icon-tile"><Icon name="records" size={23}/></span>
      <div className="ft-summary-title"><p className="ft-eyebrow">Revisión de campo</p>
        <h4>Ficha técnica del meliponario</h4></div>
      <span className="km-tag">{formatoDatoFicha(fila.estado)}</span>
    </header>
    <dl className="ft-metadata">{datos.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <nav className="ft-tabs" aria-label="Secciones de la ficha técnica">
      <button type="button" className="km-button" aria-pressed={tab === 'respuestas'} onClick={() => setTab('respuestas')}><Icon name="records" size={17}/>Cuestionario</button>
      <button type="button" className="km-button" aria-pressed={tab === 'datos'} onClick={() => setTab('datos')}><Icon name="bee" size={17}/>Visita e inventario</button>
    </nav>
    <section className="ft-section" aria-label={tab === 'respuestas' ? 'Respuestas del trabajador' : 'Datos de la visita e inventario'}>
      <div className="ft-section-heading"><h4>{tab === 'respuestas' ? 'Respuestas del trabajador' : 'Datos verificados en campo'}</h4>
        <p>{tab === 'respuestas' ? 'Consulta todas las opciones elegidas y las especificaciones de «Otro».' : 'Información e inventario registrados durante esta visita.'}</p></div>
      <Dato valor={tab === 'respuestas' ? respuestas : ficha}/>
    </section>
  </section>;
}

