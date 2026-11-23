import { useEffect, useMemo, useState } from 'react';
import { isCliente, leerRegistros } from '../../features/ownerMeliponarios/model';
import { crearPuntosPropios } from '../../features/ownerMeliponarios/privateMap';

const EMPTY = [];
export function useOwnMapRecords(user, sessionReady) {
  const userId = sessionReady && isCliente(user) ? user.id : null;
  const [state, setState] = useState({ ownerId: null, records: EMPTY, catalog: null, error: '' });
  useEffect(() => {
    if (!userId) return;
    let active = true;
    let request = 0;
    function refresh() {
      const current = ++request;
      import('../../features/ownerMeliponarios/catalogos').then(module => module.obtenerCatalogosRegistro()).then(catalog => {
        const records = leerRegistros(userId);
        if (active && current === request) setState({ownerId:userId, records, catalog, error:''});
      }).catch(error => { if (active && current === request) setState({ownerId:userId,records:EMPTY,catalog:null,error:error.message || 'No pudimos recuperar tus registros locales.'}); });
    }
    refresh();
    window.addEventListener('storage',refresh); window.addEventListener('focus',refresh); window.addEventListener('kaabmap:owner-records-changed',refresh);
    return () => { active = false; request++; window.removeEventListener('storage',refresh); window.removeEventListener('focus',refresh); window.removeEventListener('kaabmap:owner-records-changed',refresh); };
  }, [userId]);
  const current = userId && state.ownerId === userId;
  const puntos = useMemo(() => current ? crearPuntosPropios(state.records,user,state.catalog) : EMPTY, [current,state.records,state.catalog,user]);
  return { puntos, total: current ? state.records.length : 0, error: current ? state.error : '', visible: Boolean(userId), loading: Boolean(userId && !current) };
}
