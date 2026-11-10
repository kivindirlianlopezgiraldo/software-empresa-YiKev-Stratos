import { useState } from 'react';
import { CheckCircle2, ClipboardCheck, Play, ShieldAlert, XCircle } from 'lucide-react';

import { ejecutarPruebasPermisos } from '../lib/pruebasPermisos';

export default function PruebasSistema() {
  const [resultados, setResultados] = useState(null);
  const [ejecutadoEn, setEjecutadoEn] = useState('');

  const ejecutar = () => {
    setResultados(ejecutarPruebasPermisos());
    setEjecutadoEn(new Date().toLocaleString('es-CO'));
  };

  const fallidas = resultados?.filter((resultado) => !resultado.correcto).length ?? 0;
  const correctas = resultados?.length ? resultados.length - fallidas : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <div className="mb-2 flex items-center gap-2 text-cyan-400">
            <ClipboardCheck size={19} aria-hidden="true" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
              Administración
            </span>
          </div>
          <h1 className="text-2xl font-black text-white">Pruebas configuradas</h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">
            Verifica que los permisos definidos para cada rol coincidan con el comportamiento
            esperado.
          </p>
        </div>
        <button
          type="button"
          onClick={ejecutar}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-cyan-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        >
          <Play size={15} aria-hidden="true" />
          Ejecutar pruebas
        </button>
      </header>

      <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4 text-amber-200">
        <ShieldAlert size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-[11px] leading-relaxed">
          Estas pruebas solo evalúan la matriz de permisos en esta sesión. No inician sesión con
          otros usuarios, no consultan contraseñas y no modifican datos.
        </p>
      </div>

      {resultados ? (
        <>
          <section
            aria-label="Resumen de pruebas"
            aria-live="polite"
            className="grid grid-cols-1 gap-3 sm:grid-cols-3"
          >
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Pruebas
              </h2>
              <p className="mt-1 font-mono text-2xl font-black text-white">{resultados.length}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-4">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                Correctas
              </h2>
              <p className="mt-1 font-mono text-2xl font-black text-emerald-300">{correctas}</p>
            </div>
            <div
              className={`rounded-2xl border p-4 ${
                fallidas
                  ? 'border-red-500/20 bg-red-950/20'
                  : 'border-slate-800 bg-slate-900'
              }`}
            >
              <h2
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  fallidas ? 'text-red-300' : 'text-slate-400'
                }`}
              >
                Fallidas
              </h2>
              <p
                className={`mt-1 font-mono text-2xl font-black ${
                  fallidas ? 'text-red-300' : 'text-white'
                }`}
              >
                {fallidas}
              </p>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
              <h2 id="tabla-resultados-titulo" className="text-xs font-bold text-white">
                Resultados por rol y permiso
              </h2>
              <span className="text-[10px] text-slate-400">Ejecutado: {ejecutadoEn}</span>
            </div>
            <div
              className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400"
              tabIndex={0}
              role="region"
              aria-labelledby="tabla-resultados-titulo"
              aria-describedby="ayuda-desplazamiento-tabla"
            >
              <p id="ayuda-desplazamiento-tabla" className="sr-only">
                La tabla puede desplazarse horizontalmente. Usa las teclas de flecha izquierda y
                derecha cuando esta región tenga el foco.
              </p>
              <table className="w-full min-w-[620px] text-left text-[11px]">
                <caption className="sr-only">Resultados de las pruebas configuradas de permisos</caption>
                <thead className="bg-slate-950 text-[9px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Rol</th>
                    <th className="px-4 py-3">Permiso</th>
                    <th className="px-4 py-3 text-center">Esperado</th>
                    <th className="px-4 py-3 text-center">Obtenido</th>
                    <th className="px-4 py-3">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {resultados.map((resultado, indice) => (
                    <tr key={`${resultado.rol}-${resultado.permiso}-${indice}`}>
                      <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-slate-200">
                        {resultado.rol}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-300">{resultado.permiso}</td>
                      <td className="px-4 py-2.5 text-center text-slate-300">
                        {resultado.esperado ? 'Permitido' : 'Denegado'}
                      </td>
                      <td className="px-4 py-2.5 text-center text-slate-300">
                        {resultado.obtenido ? 'Permitido' : 'Denegado'}
                      </td>
                      <td className="px-4 py-2.5">
                        {resultado.correcto ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-300">
                            <CheckCircle2 size={13} aria-hidden="true" /> Correcto
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold text-red-300">
                            <XCircle size={13} aria-hidden="true" /> Revisar
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 px-4 py-12 text-center">
          <ClipboardCheck size={25} className="mx-auto text-slate-400" aria-hidden="true" />
          <p className="mt-3 text-sm font-bold text-slate-300">Aún no se han ejecutado pruebas</p>
          <p className="mt-1 text-[11px] text-slate-500">
            Ejecuta la matriz para comprobar los permisos configurados por rol.
          </p>
        </div>
      )}
    </div>
  );
}
