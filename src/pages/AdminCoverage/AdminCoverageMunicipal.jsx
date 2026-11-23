import { useEffect, useMemo, useRef, useState } from 'react';
import { planMunicipal, zonasDestino } from '../../features/territory/territoryCoverageModel.mjs';
import Icon from '../Explore/Icon';

export function DialogoCobertura({ tituloId, cancelar, children }) {
  const dialogo = useRef(null);
  useEffect(() => {
    const elemento = dialogo.current;
    elemento.showModal();
    return () => { if (elemento.open) elemento.close(); };
  }, []);

  return <dialog ref={dialogo} className="za-dialog ct-dialog" aria-labelledby={tituloId}
    onCancel={event => { event.preventDefault(); cancelar(); }}>
    {children}
  </dialog>;
}

export function CrearZonaDialog({ cancelar, guardar, guardando, error }) {
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');

  function enviar(event) {
    event.preventDefault();
    if (!guardando && codigo.trim() && nombre.trim()) guardar({ codigo: codigo.trim(), nombre: nombre.trim(), descripcion: descripcion.trim() });
  }

  return <DialogoCobertura tituloId="ct-crear-zona" cancelar={cancelar}>
    <h2 id="ct-crear-zona">Crear zona</h2>
    <p className="ct-hint">Usa un código único y un nombre que identifique la zona.</p>
    <form className="ct-dialog-form" onSubmit={enviar}>
      <div className="za-field">
        <label htmlFor="ct-codigo-zona">Código</label>
        <input id="ct-codigo-zona" className="za-control" value={codigo} required
          disabled={guardando} onChange={event => setCodigo(event.target.value)}/>
      </div>
      <div className="za-field">
        <label htmlFor="ct-nombre-zona">Nombre</label>
        <input id="ct-nombre-zona" className="za-control" value={nombre} required
          disabled={guardando} onChange={event => setNombre(event.target.value)}/>
      </div>
      <label className="za-field">Descripción (opcional)
        <textarea className="za-control" value={descripcion} disabled={guardando} onChange={e => setDescripcion(e.target.value)}/>
      </label>
      {error && <p className="za-notice za-notice--error" role="alert">{error}</p>}
      <div className="za-dialog-actions">
        <button className="za-button za-button--soft" type="button" disabled={guardando} onClick={cancelar}>Cancelar</button>
        <button className="za-button za-button--primary" type="submit" disabled={guardando || !codigo.trim() || !nombre.trim()}>
          {guardando ? 'Guardando…' : 'Crear zona'}
        </button>
      </div>
    </form>
  </DialogoCobertura>;
}

export function FormularioMunicipio({ municipio, localidades, zonas, zonaInicial, habilitado, guardando, preparar }) {
  const [destinoId, setDestinoId] = useState(zonaInicial);
  const [motivo, setMotivo] = useState('');
  const destinos = zonasDestino(zonas, null);
  const destino = destinos.find(zona => zona.id === destinoId);
  const plan = useMemo(() => planMunicipal(localidades, destinoId), [localidades, destinoId]);
  const motivoCompleto = Boolean(motivo.trim());
  const hayCambios = plan.sinZona + plan.enOtras > 0;
  const editable = habilitado && localidades.length > 0 && !guardando;
  const puedeRevisar = editable && destino && hayCambios && motivoCompleto;

  function enviar(event) {
    event.preventDefault();
    if (!puedeRevisar) return;
    preparar({
      alcance: 'municipio', municipio: municipio.nombre, hacia: destino, plan,
      valores: {
        municipioId: municipio.id, zonaId: destino.id,
        estadoEsperado: plan.estadoEsperado, motivo: motivo.trim(),
      },
    });
  }

  return <section className="za-panel ct-municipality" aria-labelledby="ct-municipio-titulo">
    <header className="za-panel-heading">
      <span className="za-panel-icon"><Icon name="map" size={22}/></span>
      <div>
        <h2 id="ct-municipio-titulo">{municipio.nombre}</h2>
        <p>{localidades.length} {localidades.length === 1 ? 'localidad registrada' : 'localidades registradas'}</p>
      </div>
    </header>
    <div className="ct-municipality-grid">
      <div className="za-directory">
        <h3>Cobertura actual</h3>
        {localidades.length ? <>
          <p className="ct-coverage-count"><strong>{plan.sinZona}</strong> sin zona</p>
          <ul className="ct-zone-origins">
            {plan.origenes.map(zona => <li key={zona.id}>
              <span>{zona.nombre}{!zona.activo && ' (inactiva)'}</span><strong>{zona.total}</strong>
            </li>)}
            {destino && plan.enDestino > 0 && <li>
              <span>{destino.nombre}</span><strong>{plan.enDestino}</strong>
            </li>}
          </ul>
          <p className="ct-hint">Usa <strong>Por localidad</strong> para repartir el municipio entre varias zonas.</p>
        </> : <p className="ct-hint">Este municipio todavía no tiene localidades registradas.</p>}
      </div>
      <form className="za-form" onSubmit={enviar}>
        <h3>Asignar municipio completo</h3>
        <div className="za-field">
          <label htmlFor="ct-destino-municipal">Zona de destino</label>
          <select className="za-control" id="ct-destino-municipal" value={destino?.id ?? ''} required
            disabled={!editable || !destinos.length} onChange={event => setDestinoId(event.target.value)}>
            <option value="">Selecciona una zona</option>
            {destinos.map(zona => <option key={zona.id} value={zona.id}>{zona.nombre} · {zona.codigo}</option>)}
          </select>
          {editable && !destinos.length && <p className="ct-hint">Crea una zona activa desde la cabecera.</p>}
        </div>
        {destino && <ImpactoMunicipal plan={plan}/>}
        {destino && !hayCambios && <p className="za-empty">Las localidades de este municipio ya están en esa zona.</p>}
        <div className="za-field">
          <label htmlFor="ct-motivo-municipal">Motivo del cambio</label>
          <textarea className="za-control" id="ct-motivo-municipal" value={motivo} required disabled={!editable}
            onChange={event => setMotivo(event.target.value)}/>
        </div>
        <button className="za-button za-button--primary za-submit" type="submit" disabled={!puedeRevisar}>
          Revisar asignación municipal
        </button>
      </form>
    </div>
  </section>;
}

function ImpactoMunicipal({ plan }) {
  return <dl className="ct-impacto" aria-label="Localidades afectadas">
    <div><dt>Se incorporan</dt><dd>{plan.sinZona}</dd></div>
    <div><dt>Se trasladan</dt><dd>{plan.enOtras}</dd></div>
    <div><dt>Ya en destino</dt><dd>{plan.enDestino}</dd></div>
  </dl>;
}

export function ConfirmarMunicipio({ cambio, guardando, cancelar, guardar }) {
  const [trasladar, setTrasladar] = useState(false);
  const requiereTraslado = cambio.plan.enOtras > 0;
  return <DialogoCobertura tituloId="ct-confirmar-municipio" cancelar={cancelar}>
    <h2 id="ct-confirmar-municipio">Confirmar asignación municipal</h2>
    <p>Vas a asignar <strong>{cambio.municipio}</strong> a <strong>{cambio.hacia.nombre}</strong>. El municipio tiene {cambio.plan.total} localidades en esta consulta.</p>
    <ImpactoMunicipal plan={cambio.plan}/>
    <p className="ct-reason">{cambio.valores.motivo}</p>
    {requiereTraslado && <label className="ct-traslado-opcion">
      <input type="checkbox" checked={trasladar} disabled={guardando}
        onChange={event => setTrasladar(event.target.checked)}/>
      <span>Trasladar también {cambio.plan.enOtras} {cambio.plan.enOtras === 1 ? 'localidad' : 'localidades'} de otras zonas.</span>
    </label>}
    <div className="za-dialog-actions">
      <button className="za-button za-button--soft" type="button" disabled={guardando} onClick={cancelar}>Cancelar</button>
      <button className="za-button za-button--primary" type="button" disabled={guardando || (requiereTraslado && !trasladar)}
        onClick={() => guardar(trasladar)}>
        {guardando ? 'Guardando…' : 'Asignar municipio'}
      </button>
    </div>
  </DialogoCobertura>;
}
