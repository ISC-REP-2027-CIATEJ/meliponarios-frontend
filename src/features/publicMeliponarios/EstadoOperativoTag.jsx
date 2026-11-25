import { estadosOperativos } from '../ownerMeliponarios/estadoOperativo.mjs';

export default function EstadoOperativoTag({ item }) {
  const etiqueta = estadosOperativos[item?.estadoOperativo];
  return etiqueta ? <span className="km-tag">{etiqueta}</span> : null;
}
