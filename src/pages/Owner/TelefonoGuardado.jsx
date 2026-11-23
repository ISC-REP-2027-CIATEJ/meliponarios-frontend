import { useEffect, useRef, useState } from 'react';
import { guardarTelefonoPublico } from '../../features/ownerMeliponarios/telefonoPublico.mjs';
import { supabase } from '../../lib/supabase';

export default function TelefonoGuardado({ userId, record, bloqueado, onActividad, onGuardado }) {
  const [valor, cambiar] = useState(record.telefonoPublico || '');
  const [guardado, confirmar] = useState(record.telefonoPublico || '');
  const [ocupado, esperar] = useState(false);
  const [aviso, avisar] = useState('');
  const [error, fallar] = useState('');
  const candado = useRef(false);
  const sucio = valor !== guardado;
  const normalizable = !sucio && /^[0-9]{10}$/.test(valor.replace(/[\s()-]/g, '')) && valor.length !== 10;
  useEffect(() => {
    onActividad({ dirty: sucio, busy: ocupado });
    if (!sucio && !ocupado) return;
    const proteger = e => {
      if (e.type === 'beforeunload') { e.preventDefault(); e.returnValue = ''; }
      else if (candado.current || !window.confirm('¿Salir sin guardar el teléfono?')) e.preventDefault();
    };
    window.addEventListener('beforeunload', proteger);
    window.addEventListener('kaabmap:before-owner-leave', proteger);
    return () => {
      window.removeEventListener('beforeunload', proteger);
      window.removeEventListener('kaabmap:before-owner-leave', proteger);
    };
  }, [sucio, ocupado, onActividad]);
  async function guardar() {
    if (candado.current || bloqueado) return;
    candado.current = true; esperar(true); avisar(''); fallar('');
    try {
      const telefono = await guardarTelefonoPublico(supabase, userId, record.id, valor);
      confirmar(telefono); cambiar(telefono); onGuardado(record.id, telefono);
      avisar('Teléfono guardado. Actualiza Mis meliponarios para consultar la visibilidad.');
    } catch (e) { fallar(e.message); }
    finally { candado.current = false; esperar(false); }
  }
  return <section className="km-panel km-inset mb-5" id="contacto">
    <label htmlFor="telefono-guardado" className="text-lg font-bold">Teléfono público de contacto</label>
    <p className="my-2 text-sm">Cuando se publique la ficha, los visitantes podrán usar este número. Incluye los 10 dígitos con lada.</p>
    {bloqueado && <p className="my-2 text-sm">Termina de guardar los cambios pendientes para editar el teléfono.</p>}
    <input id="telefono-guardado" className="owner-field" type="tel" inputMode="tel" value={valor} disabled={bloqueado || ocupado}
      onChange={e => { cambiar(e.target.value); avisar(''); fallar(''); }}/>
    <div className="mt-3 flex gap-3"><button className="km-button km-button--primary" disabled={(!sucio && !normalizable) || bloqueado || ocupado} onClick={guardar}>Guardar teléfono</button>
      {sucio && <button className="km-button" disabled={ocupado} onClick={() => { cambiar(guardado); fallar(''); }}>Descartar cambio</button>}</div>
    {error && <p role="alert">{error}</p>}{aviso && <p role="status">{aviso}</p>}
  </section>;
}
