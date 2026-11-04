import { useEffect, useState } from 'react';
import { obtenerFichaPublica, obtenerFotosPublicas, obtenerMeliponariosPublicos } from './publicService';

// Cada entrada a la pantalla o recarga consulta el servidor, sin esperar una sesión.
export function usePublicMeliponarios() {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ items: [], loading: true, error: '' });
  useEffect(() => {
    let active = true;
    obtenerMeliponariosPublicos().then(items => { if (active) setState({ items, loading: false, error: '' }); })
      .catch(error => { if (active) setState({ items: [], loading: false, error: error.message }); });
    return () => { active = false; };
  }, [revision]);
  function recargar() { setState({ items: [], loading: true, error: '' }); setRevision(n => n + 1); }
  return { ...state, recargar };
}

export function usePublicFicha(id) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ id, item: null, loading: true, error: '' });
  useEffect(() => {
    let active = true;
    obtenerFichaPublica(id).then(item => { if (active) setState({ id, item, loading: false, error: '' }); })
      .catch(error => { if (active) setState({ id, item: null, loading: false, error: error.message }); });
    return () => { active = false; };
  }, [id, revision]);
  function recargar() { setState({ id, item: null, loading: true, error: '' }); setRevision(n => n + 1); }
  return { ...(state.id === id ? state : { item: null, loading: true, error: '' }), recargar };
}

export function usePublicPhotos(id) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ id, fotos: [], faltantes: 0, loading: Boolean(id), error: '' });
  useEffect(() => {
    if (!id) return;
    let active = true;
    obtenerFotosPublicas(id, revision > 0).then(result => {
      if (active) setState({ id, ...result, loading: false, error: '' });
    }).catch(error => {
      if (active) setState({ id, fotos: [], faltantes: 0, loading: false, error: error.message });
    });
    return () => { active = false; };
  }, [id, revision]);
  function recargar() { setState({ id, fotos: [], faltantes: 0, loading: Boolean(id), error: '' }); setRevision(n => n + 1); }
  return { ...(state.id === id ? state : { fotos: [], faltantes: 0, loading: Boolean(id), error: '' }), recargar };
}
