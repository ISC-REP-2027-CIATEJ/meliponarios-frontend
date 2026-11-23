import { useCallback, useEffect, useRef, useState } from "react";
import { recursoAudio } from "./detailHelpers";

// Un solo reproductor evita que se superpongan sonidos de distintas especies.
export default function useSpeciesAudio() {
  const audio = useRef(null);
  const token = useRef(0);
  const [activo, setActivo] = useState(null);
  const [cargando, setCargando] = useState(null);
  const [error, setError] = useState("");
  const detener = useCallback(() => {
    token.current++;
    if (audio.current) {
      audio.current.onended = null;
      audio.current.onerror = null;
      audio.current.pause();
      audio.current = null;
    }
    setActivo(null);
    setCargando(null);
  }, []);
  useEffect(
    () => () => {
      token.current++;
      if (audio.current) {
        audio.current.onended = null;
        audio.current.onerror = null;
        audio.current.pause();
      }
    },
    [],
  );
  async function reproducir(nombre, ruta) {
    if (!ruta) return;
    if (activo === nombre || cargando === nombre) {
      detener();
      return;
    }
    detener();
    setError("");
    setCargando(nombre);
    const solicitud = token.current;
    const player = new Audio(recursoAudio(ruta));
    audio.current = player;
    const fallar = () => {
      if (token.current !== solicitud) return;
      detener();
      setError(
        "No se pudo reproducir la grabación. Comprueba el archivo o inténtalo de nuevo.",
      );
    };
    player.onended = () => {
      if (token.current === solicitud) detener();
    };
    player.onerror = fallar;
    try {
      await player.play();
      if (token.current === solicitud) {
        setCargando(null);
        setActivo(nombre);
      } else player.pause();
    } catch {
      fallar();
    }
  }
  return { activo, cargando, error, reproducir, detener };
}