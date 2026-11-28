import { useId } from 'react';
import { COLORES_GRAFICA, TIPOS_GRAFICA } from '../../features/research/researchCharts.mjs';
import { numero } from '../../features/research/inventarioModel.mjs';

function rutaPastel(inicio, proporcion) {
  if (proporcion >= 1 - 1e-9) return 'M 100 20 A 80 80 0 1 1 100 180 A 80 80 0 1 1 100 20 Z';
  const fin = inicio + proporcion * Math.PI * 2;
  const x1 = 100 + Math.cos(inicio) * 80, y1 = 100 + Math.sin(inicio) * 80;
  const x2 = 100 + Math.cos(fin) * 80, y2 = 100 + Math.sin(fin) * 80;
  return `M 100 100 L ${x1} ${y1} A 80 80 0 ${proporcion > .5 ? 1 : 0} 1 ${x2} ${y2} Z`;
}

export default function ResearchChart({ grafica, elegido, elegir, cambiarTipo, medida, cambiarMedida }) {
  const id = useId();
  const { filas, titulo, unidad, tipo, nota } = grafica;
  const maximo = Math.max(1, ...filas.map(fila => fila.total ?? 0));
  const suma = filas.reduce((total, fila) => total + (fila.total ?? 0), 0);
  const totalVisible = filas.some(fila => fila.total !== null) ? numero(suma) : 'Sin dato';
  const seleccionar = fila => elegir(elegido === fila.id ? '' : fila.id);
  const etiqueta = fila => `${fila.nombre}: ${numero(fila.total)} ${unidad.toLocaleLowerCase('es')}`;
  const activarTecla = (event, fila) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); seleccionar(fila); }
  };
  return (
    <section className="research-card research-chart-card" data-chart={grafica.id}>
      <header className="research-chart-heading">
        <div><h2 id={id}>{titulo}</h2><p>{unidad}</p></div>
        <label className="research-chart-select"><span className="sr-only">Ver {titulo} como</span>
          <select aria-label={'Ver ' + titulo + ' como'} value={tipo} onChange={event => cambiarTipo(event.target.value)}>
            {Object.entries(TIPOS_GRAFICA).map(([valor, nombre]) => <option key={valor} value={valor}>{nombre}</option>)}
          </select>
        </label>
      </header>
      {cambiarMedida && <div className="research-measure" aria-label="Medida del inventario">
        {['cajas', 'jobones'].map(valor => <button type="button" key={valor} aria-pressed={medida === valor} onClick={() => cambiarMedida(valor)}>{valor === 'cajas' ? 'Cajas' : 'Jobones'}</button>)}
      </div>}
      {!filas.length ? <p className="research-empty-small">Sin resultados con estos filtros.</p> : <>
        {tipo === 'horizontal' && <div className="research-bars" aria-labelledby={id}>
          {filas.map(fila => <button type="button" className="research-bar" key={fila.id} aria-pressed={elegido === fila.id} aria-label={etiqueta(fila)} onClick={() => seleccionar(fila)}>
            <span className="research-bar-heading"><span>{fila.nombre}{fila.cientifico && <i>{fila.cientifico}</i>}</span><strong>{numero(fila.total)}</strong></span>
            <span className="research-bar-track" aria-hidden="true"><span style={{ width: `${(fila.total ?? 0) / maximo * 100}%` }}/></span>
            {fila.faltantes > 0 && <small className="research-chart-missing">{fila.faltantes} registros sin dato</small>}
          </button>)}
        </div>}
        {tipo === 'vertical' && <div className="research-vertical-scroll"><div className="research-vertical" style={{ minWidth: Math.max(300, filas.length * 85) }}>
          {filas.map((fila, indice) => <button type="button" className="research-column" key={fila.id} aria-label={etiqueta(fila)} aria-pressed={elegido === fila.id} onClick={() => seleccionar(fila)}>
            <span className="research-column-track"><span className="research-column-fill" style={{ height: `${(fila.total ?? 0) / maximo * 82}%`, background: COLORES_GRAFICA[indice % COLORES_GRAFICA.length] }}><strong>{numero(fila.total)}</strong></span></span>
            <span className="research-column-name">{fila.nombre}</span>
          </button>)}
        </div></div>}
        {['dona', 'pastel'].includes(tipo) && <div className="research-distribution">
          <svg className="research-donut" viewBox="0 0 200 200" role="group" aria-label={titulo + '. Selecciona una categoría para filtrar.'}>
            <circle cx="100" cy="100" r="70" fill={tipo === 'pastel' ? '#edf2ec' : 'none'} stroke="#edf2ec" strokeWidth={tipo === 'pastel' ? 24 : 24}/>
            {filas.map((fila, indice) => {
              if (!(fila.total > 0) || !suma) return null;
              const radio = tipo === 'pastel' ? 42 : 70;
              const circunferencia = 2 * Math.PI * radio;
              const longitud = fila.total / suma * circunferencia;
              const offset = filas.slice(0, indice).reduce((total, anterior) => total + (anterior.total ?? 0), 0) / suma * circunferencia;
              if (tipo === 'pastel') return <path key={fila.id} d={rutaPastel(offset / circunferencia * Math.PI * 2 - Math.PI / 2, fila.total / suma)}
                fill={COLORES_GRAFICA[indice % COLORES_GRAFICA.length]} role="button" tabIndex="0" aria-label={etiqueta(fila)} aria-pressed={elegido === fila.id}
                onClick={() => seleccionar(fila)} onKeyDown={event => activarTecla(event, fila)}><title>{etiqueta(fila)}</title></path>;
              return <circle key={fila.id} cx="100" cy="100" r={radio} fill="none" stroke={COLORES_GRAFICA[indice % COLORES_GRAFICA.length]} strokeWidth={tipo === 'pastel' ? 84 : 24}
                strokeDasharray={`${longitud} ${circunferencia - longitud}`} strokeDashoffset={-offset} transform="rotate(-90 100 100)"
                role="button" tabIndex="0" aria-label={etiqueta(fila)} aria-pressed={elegido === fila.id} onClick={() => seleccionar(fila)} onKeyDown={event => activarTecla(event, fila)}>
                <title>{etiqueta(fila)}</title>
              </circle>;
            })}
            {tipo === 'dona' && <><text x="100" y="100" textAnchor="middle" className="research-donut-number">{totalVisible}</text><text x="100" y="119" textAnchor="middle" className="research-donut-label">{grafica.id === 'especies' ? 'presencias' : grafica.id === 'inventario' ? medida : 'meliponarios'}</text></>}
          </svg>
          <ul className="research-legend">{filas.map((fila, indice) => <li key={fila.id}><button type="button" aria-pressed={elegido === fila.id} onClick={() => seleccionar(fila)}>
            <span className="research-swatch" style={{ backgroundColor: COLORES_GRAFICA[indice % COLORES_GRAFICA.length] }}/><span>{fila.nombre}</span><strong>{numero(fila.total)}</strong><small>{fila.total !== null && suma ? (fila.total / suma * 100).toFixed(1) + '%' : '—'}</small>
          </button></li>)}</ul>
        </div>}
        {tipo === 'tabla' && <div className="research-values-scroll"><table className="research-values-table"><caption className="sr-only">{titulo}</caption>
          <thead><tr><th scope="col">Categoría</th><th scope="col">{unidad}</th></tr></thead><tbody>
            {filas.map(fila => <tr key={fila.id}><th scope="row"><button type="button" aria-pressed={elegido === fila.id} onClick={() => seleccionar(fila)}>{fila.nombre}</button>{fila.cientifico && <i>{fila.cientifico}</i>}</th><td>{numero(fila.total)}{fila.faltantes > 0 && <small>{fila.faltantes} sin dato</small>}</td></tr>)}
          </tbody></table></div>}
      </>}
      <p className="research-footnote">{nota}</p>
    </section>
  );
}
