import { useCallback, useRef, useState } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

import Modal from '../components/Modal';
import ConfirmContext from './ConfirmContext';

export function ConfirmProvider({ children }) {
  const [dialogo, setDialogo] = useState(null);
  const resolver = useRef(null);

  const cerrar = useCallback((confirmado) => {
    setDialogo(null);
    resolver.current?.(confirmado);
    resolver.current = null;
  }, []);

  const confirmar = useCallback((opciones) => {
    if (resolver.current) resolver.current(false);
    return new Promise((resolve) => {
      resolver.current = resolve;
      setDialogo({
        titulo: opciones.titulo || '¿Confirmas esta acción?',
        mensaje: opciones.mensaje || '',
        confirmarTexto: opciones.confirmarTexto || 'Confirmar',
        cancelarTexto: opciones.cancelarTexto || 'Cancelar',
        peligroso: opciones.peligroso !== false,
      });
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      <Modal
        abierto={Boolean(dialogo)}
        onClose={() => cerrar(false)}
        titulo={dialogo?.titulo || ''}
        subtitulo="Revisa los detalles antes de continuar."
        icono={
          dialogo?.peligroso ? (
            <ShieldAlert size={20} className="text-rose-400" />
          ) : (
            <AlertTriangle size={20} className="text-amber-300" />
          )
        }
      >
        {dialogo && (
          <>
            <p className="whitespace-pre-line break-words text-sm leading-relaxed text-slate-300">
              {dialogo.mensaje}
            </p>
            <div className="flex flex-col-reverse gap-2 border-t border-slate-800 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => cerrar(false)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                {dialogo.cancelarTexto}
              </button>
              <button
                type="button"
                onClick={() => cerrar(true)}
                className={`rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                  dialogo.peligroso
                    ? 'bg-rose-600 shadow-rose-950/30 hover:bg-rose-500 focus-visible:ring-rose-400'
                    : 'bg-blue-600 shadow-blue-950/30 hover:bg-blue-500 focus-visible:ring-blue-400'
                }`}
              >
                {dialogo.confirmarTexto}
              </button>
            </div>
          </>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}
