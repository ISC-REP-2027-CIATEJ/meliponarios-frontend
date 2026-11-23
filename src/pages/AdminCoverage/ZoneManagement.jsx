import { useState } from 'react';
import { DialogoCobertura } from './AdminCoverageMunicipal';

export function DirectorioZonas({ zonas, guardando, editar }) {
  const [estado, setEstado] = useState('activas');
  const [zonaId, setZonaId] = useState('');
  const lista = zonas.filter(z => z.activo === (estado === 'activas'));
  const zona = lista.find(z => z.id === zonaId) ?? lista[0];
  return <section className="za-panel eq-panel eq-zone-admin" aria-labelledby="ct-directorio-zonas">
    <div className="eq-between"><h2 id="ct-directorio-zonas">Administrar zonas</h2>
      <div className="za-switch" role="group" aria-label="Estado de zona">
        {['activas','archivadas'].map(s => <button key={s} type="button" aria-pressed={s === estado}
          disabled={guardando} onClick={() => { setEstado(s); setZonaId(''); }}>{s === 'activas' ? 'Activas' : 'Archivadas'}</button>)}
      </div></div>
    {zona ? <><label>Zona<select className="za-control" value={zona.id} disabled={guardando} onChange={e => setZonaId(e.target.value)}>
      {lista.map(z => <option key={z.id} value={z.id}>{z.nombre} · {z.codigo}</option>)}</select></label>
      {zona.descripcion && <p>{zona.descripcion}</p>}
      <div className="eq-actions">
        <button className="za-button za-button--soft" disabled={guardando} onClick={() => editar(zona, 'editar')}>Editar zona</button>
        <button className="za-button za-button--primary" disabled={guardando} onClick={() => editar(zona, zona.activo ? 'archivar' : 'restaurar')}>
          {zona.activo ? 'Archivar zona' : 'Restaurar zona'}</button></div></>
      : <p className="za-empty">Sin zonas {estado}.</p>}
  </section>;
}

export function EditarZonaDialog({ original, operacion, cancelar, guardar, guardando, error }) {
  const [datos, setDatos] = useState({ codigo: original.codigo, nombre: original.nombre,
    descripcion: original.descripcion || '', activo: operacion === 'restaurar' || (operacion === 'editar' && original.activo) });
  const titulo = { editar: 'Editar zona', archivar: 'Archivar zona', restaurar: 'Restaurar zona' }[operacion];
  const cambiar = (campo, valor) => setDatos(anterior => ({ ...anterior, [campo]: valor }));
  return <DialogoCobertura tituloId="ct-editar-zona" cancelar={cancelar}>
    <h2 id="ct-editar-zona">{titulo}</h2>
    <form className="eq-form" onSubmit={e => { e.preventDefault(); if (!guardando) guardar(datos); }}>
      {operacion === 'editar' ? <>
        <label>Código<input required className="za-control" value={datos.codigo} onChange={e => cambiar('codigo',e.target.value)}/></label>
        <label>Nombre<input required className="za-control" value={datos.nombre} onChange={e => cambiar('nombre',e.target.value)}/></label>
        <label>Descripción (opcional)<textarea className="za-control" value={datos.descripcion} onChange={e => cambiar('descripcion',e.target.value)}/></label>
      </> : <p><strong>{original.nombre}</strong> {operacion === 'archivar'
        ? 'quedará archivada y dejará de ofrecerse como destino de cobertura.' : 'volverá a estar disponible como destino de cobertura.'}</p>}
      {error && <p role="alert" className="za-notice za-notice--error">{error}</p>}
      <div className="za-dialog-actions">
        <button className="za-button za-button--soft" type="button" disabled={guardando} onClick={cancelar}>Cancelar</button>
        <button className="za-button za-button--primary" disabled={guardando || !datos.codigo.trim() || !datos.nombre.trim()}>
          {guardando ? 'Guardando…' : operacion === 'editar' ? 'Guardar cambios' : titulo}</button>
      </div>
    </form></DialogoCobertura>;
}

export function RetiroMunicipal({ municipio, localidades, zonas, preparar, guardando }) {
  const [zonaId, setZonaId] = useState('');
  const [motivo, setMotivo] = useState('');
  const ocupadas = new Set(localidades.map(l => l.zona?.id).filter(Boolean));
  const zona = zonas.find(z => z.id === zonaId && ocupadas.has(z.id));
  if (!ocupadas.size) return null;
  const total = zona ? localidades.filter(l => l.zona?.id === zona.id).length : 0;
  return <section className="za-panel eq-panel eq-zone-admin"><h2>Retirar cobertura municipal</h2>
    <form className="eq-form" onSubmit={e => {
      e.preventDefault();
      if (zona && total && motivo.trim() && !guardando) preparar({
        alcance: 'retiroMunicipal', municipio: municipio.nombre, desde: zona, total,
        valores: { municipioId: municipio.id, zonaId: zona.id, motivo: motivo.trim(),
          estadoEsperado: Object.fromEntries(localidades.map(l => [l.id, l.zona?.id ?? null])) },
      });
    }}>
      <label>Zona que dejará de cubrir el municipio<select className="za-control" value={zona?.id ?? ''} onChange={e => setZonaId(e.target.value)}>
        <option value="">Selecciona una zona</option>{zonas.filter(z => ocupadas.has(z.id)).map(z =>
          <option key={z.id} value={z.id}>{z.nombre} · {z.codigo}</option>)}</select></label>
      {zona && <p>{total} localidades de {municipio.nombre} pertenecen actualmente a {zona.nombre}.</p>}
      <label>Motivo del retiro<textarea required className="za-control" value={motivo} onChange={e => setMotivo(e.target.value)}/></label>
      <button className="za-button za-button--soft" disabled={!zona || !motivo.trim() || guardando}>Revisar retiro</button>
    </form></section>;
}
