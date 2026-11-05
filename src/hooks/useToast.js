import { useCallback, useEffect, useRef, useState } from 'react';

const ALERTA_INICIAL = { visible: false, titulo: '', mensaje: '', tipo: 'error' };

/**
 * Estado de notificaciones flotantes con autocierre y limpieza del temporizador.
 * Evita repetir el mismo bloque de estado en cada página.
 */
export default function useToast(duracion = 6000) {
  const [alerta, setAlerta] = useState(ALERTA_INICIAL);
  const temporizador = useRef(null);

  const limpiarTemporizador = useCallback(() => {
    if (temporizador.current) {
      clearTimeout(temporizador.current);
      temporizador.current = null;
    }
  }, []);

  const cerrar = useCallback(() => {
    limpiarTemporizador();
    setAlerta((prev) => ({ ...prev, visible: false }));
  }, [limpiarTemporizador]);

  const mostrar = useCallback(
    (titulo, mensaje, tipo = 'error') => {
      limpiarTemporizador();
      setAlerta({ visible: true, titulo, mensaje, tipo });
      temporizador.current = setTimeout(() => {
        setAlerta((prev) => ({ ...prev, visible: false }));
      }, duracion);
    },
    [duracion, limpiarTemporizador],
  );

  useEffect(() => limpiarTemporizador, [limpiarTemporizador]);

  return { alerta, mostrar, cerrar };
}
