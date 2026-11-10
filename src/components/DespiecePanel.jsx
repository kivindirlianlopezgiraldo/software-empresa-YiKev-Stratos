import {
  AlertTriangle,
  Calculator,
  Layers,
  Package,
  Recycle,
  Ruler,
  Scissors,
} from 'lucide-react';

import { formatCOP } from '../lib/format';
import {
  describirFormula,
  describirVidrioSolicitado,
  formatearArea,
  formatearCm,
  formatearMetros,
  formatearMm,
  normalizarDespiece,
  vidrioCoincideConReceta,
} from '../lib/despiece';

function Resumen({ totales }) {
  const largoBarra = totales.largoBarraCm || 595;
  const tarjetas = [
    { etiqueta: 'Proyectos', valor: totales.items ?? 0 },
    { etiqueta: 'Perfil cortado', valor: formatearMetros(totales.metrosPerfil ?? 0) },
    {
      etiqueta: `Barras de ${Number(largoBarra)} cm`,
      valor: totales.barras ?? 0,
    },
    { etiqueta: 'Piezas desde retal', valor: totales.piezasRetal ?? 0 },
    { etiqueta: 'Vidrio', valor: formatearArea(totales.areaVidrio ?? 0) },
    {
      etiqueta: 'Compra estimada',
      valor: formatCOP(totales.costoCompra ?? totales.costo ?? 0),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      {tarjetas.map((t) => (
        <div key={t.etiqueta} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5">
          <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">{t.etiqueta}</p>
          <p className="text-xs font-black text-white font-mono mt-1 break-words">{t.valor}</p>
        </div>
      ))}
    </div>
  );
}

function TablaCortes({ cortes }) {
  if (!cortes.length) return null;

  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-cyan-400">
        <Scissors size={12} /> Medidas de corte de perfiles
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-[11px]">
          <thead className="bg-slate-950 text-slate-400 uppercase text-[9px]">
            <tr>
              <th className="px-3 py-2">Perfil</th>
              <th className="px-3 py-2">Fórmula</th>
              <th className="px-3 py-2 text-right">Piezas</th>
              <th className="px-3 py-2 text-right">Corte</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Áng.</th>
              <th className="px-3 py-2 text-right">Retal</th>
              <th className="px-3 py-2 text-right">Barras</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {cortes.map((corte, indice) => (
              <tr key={`${corte.materialId}-${indice}`} className="text-slate-300">
                <td className="px-3 py-2 font-semibold text-white">
                  {corte.nombre}
                  {corte.codigo && (
                    <span className="block text-[9px] text-slate-500 font-mono">{corte.codigo}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                  {corte.formulaTexto || describirFormula(corte.formula, corte.formulaConfig)}
                </td>
                <td className="px-3 py-2 text-right font-mono">{corte.cantidad}</td>
                <td className="px-3 py-2 text-right font-mono text-emerald-400 font-bold whitespace-nowrap">
                  {formatearCm(corte.largoCorteCm)}
                </td>
                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                  {formatearMetros(corte.totalMetros)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-fuchsia-300">
                  {Number(corte.anguloCorte)
                    ? `${Number(corte.anguloCorte)}°${
                        corte.ladoAngulo ? ` · lado ${corte.ladoAngulo}` : ''
                      }`
                    : '—'}
                </td>
                <td className="px-3 py-2 text-right font-mono text-emerald-300">
                  {Number(corte.piezasRetal) > 0 ? (
                    <span title={(corte.retalCodigos || []).join(', ')}>{corte.piezasRetal}</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono text-amber-400 font-bold">
                  {Number(corte.barrasNuevas ?? corte.barras) || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TablaVidrios({ vidrios, item }) {
  if (!vidrios.length) return null;

  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-sky-400">
        <Ruler size={12} /> Medidas de corte de vidrio · ancho × alto
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-[11px]">
          <thead className="bg-slate-950 text-slate-400 uppercase text-[9px]">
            <tr>
              <th className="px-3 py-2">Vidrio</th>
              <th className="px-3 py-2 text-right">Ancho</th>
              <th className="px-3 py-2 text-right">Alto</th>
              <th className="px-3 py-2 text-right">Cantidad</th>
              <th className="px-3 py-2 text-right">Área</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {vidrios.map((v, indice) => {
              const solicitado = v.solicitado || describirVidrioSolicitado(item);
              const difiere =
                typeof v.difiereReceta === 'boolean'
                  ? v.difiereReceta
                  : !vidrioCoincideConReceta(v.nombre, item);

              return (
                <tr key={`${v.materialId}-${indice}`} className="text-slate-300">
                  <td className="px-3 py-2 font-semibold text-white">
                    {v.nombre}
                    {difiere && solicitado ? (
                      <span className="mt-0.5 block text-[10px] font-semibold text-amber-400">
                        La orden pide: {solicitado}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{formatearMm(v.anchoMm)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatearMm(v.altoMm)}</td>
                  <td className="px-3 py-2 text-right font-mono">{v.cantidad}</td>
                  <td className="px-3 py-2 text-right font-mono text-sky-400 font-bold">
                    {formatearArea(v.areaM2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TablaAccesorios({ accesorios }) {
  if (!accesorios.length) return null;

  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-amber-400">
        <Package size={12} /> Accesorios, empaques y consumibles
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-[11px]">
          <thead className="bg-slate-950 text-slate-400 uppercase text-[9px]">
            <tr>
              <th className="px-3 py-2">Material</th>
              <th className="px-3 py-2 text-right">Cantidad</th>
              <th className="px-3 py-2">Unidad</th>
              <th className="px-3 py-2 text-right">Costo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {accesorios.map((a, indice) => (
              <tr key={`${a.materialId}-${indice}`} className="text-slate-300">
                <td className="px-3 py-2 font-semibold text-white">
                  {a.nombre}
                  {a.codigo && (
                    <span className="block text-[9px] text-slate-500 font-mono">{a.codigo}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono text-amber-400 font-bold">{a.cantidad}</td>
                <td className="px-3 py-2 text-slate-400">{a.unidad}</td>
                <td className="px-3 py-2 text-right font-mono">{formatCOP(a.costo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TablaRetales({ retales, largoBarraCm }) {
  if (!retales?.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/60 px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-400">
          <Recycle size={12} /> Retales en producción
        </p>
        <p className="text-[11px] text-slate-500 mt-1">
          No hay retales compatibles registrados. Todas las piezas se sacarán de barras de{' '}
          {Number(largoBarraCm || 595)} cm.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-emerald-400">
        <Recycle size={12} /> Retales aprovechados
      </p>
      <div className="overflow-x-auto rounded-xl border border-emerald-500/20">
        <table className="w-full text-left text-[11px]">
          <thead className="bg-emerald-950/30 text-emerald-200/80 uppercase text-[9px]">
            <tr>
              <th className="px-3 py-2">Retal</th>
              <th className="px-3 py-2">Material</th>
              <th className="px-3 py-2">Color</th>
              <th className="px-3 py-2 text-right">Largo</th>
              <th className="px-3 py-2 text-right">Piezas</th>
              <th className="px-3 py-2 text-right">Sobrante</th>
              <th className="px-3 py-2 text-right">Uso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-500/10">
            {retales.map((retal, indice) => (
              <tr key={`${retal.retalId}-${indice}`} className="text-slate-300">
                <td className="px-3 py-2 font-semibold text-white whitespace-nowrap">
                  {retal.codigo}
                  {retal.ubicacion && (
                    <span className="block text-[9px] text-slate-500 font-mono">{retal.ubicacion}</span>
                  )}
                </td>
                <td className="px-3 py-2">{retal.material}</td>
                <td className="px-3 py-2">{retal.color}</td>
                <td className="px-3 py-2 text-right font-mono">{formatearCm(retal.largoCm)}</td>
                <td className="px-3 py-2 text-right font-mono text-emerald-300 font-bold">
                  {retal.piezas}
                </td>
                <td className="px-3 py-2 text-right font-mono text-amber-300">
                  {formatearCm(retal.sobranteCm)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-emerald-300">
                  {retal.aprovechamiento}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TablaBarras({ barras, largoBarraCm }) {
  if (!barras?.length) return null;

  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-amber-400">
        <Layers size={12} /> Barras nuevas de {Number(largoBarraCm || 595)} cm
      </p>
      <div className="overflow-x-auto rounded-xl border border-amber-500/20">
        <table className="w-full text-left text-[11px]">
          <thead className="bg-amber-950/30 text-amber-200/80 uppercase text-[9px]">
            <tr>
              <th className="px-3 py-2">Material</th>
              <th className="px-3 py-2">Color</th>
              <th className="px-3 py-2 text-right">Barras</th>
              <th className="px-3 py-2 text-right">Piezas</th>
              <th className="px-3 py-2 text-right">Sobrante</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-500/10">
            {barras.map((barra, indice) => (
              <tr key={`${barra.materialKey}-${indice}`} className="text-slate-300">
                <td className="px-3 py-2 font-semibold text-white">{barra.nombre}</td>
                <td className="px-3 py-2">{barra.color}</td>
                <td className="px-3 py-2 text-right font-mono text-amber-300 font-bold">
                  {barra.barras}
                </td>
                <td className="px-3 py-2 text-right font-mono">{barra.piezas}</td>
                <td className="px-3 py-2 text-right font-mono">{formatearCm(barra.sobranteCm)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Vista del despiece calculado. Se usa en la ficha de la orden, en el modal de
 * envío a producción y en la vista previa de sistemas.
 */
export default function DespiecePanel({
  despiece,
  titulo = 'Despiece y materiales',
  compacto = false,
  advertenciasExtra = [],
}) {
  const data = normalizarDespiece(despiece);
  const advertencias = [...(data?.advertencias || []), ...advertenciasExtra];
  const largoBarraCm = data?.totales?.largoBarraCm || data?.largoBarraCm || 595;

  if (!data || !(data.items || []).length) {
    return (
      <div className="bg-slate-950 border border-dashed border-slate-700 rounded-2xl p-5 text-center space-y-2">
        <Calculator className="mx-auto text-slate-600" size={24} />
        <p className="text-xs font-bold text-slate-300">Todavía no hay despiece calculado</p>
        <p className="text-[11px] text-slate-500 max-w-md mx-auto">
          Agrega los proyectos con sus medidas y un sistema con receta. Al enviar la orden a
          producción se calculan los cortes, vidrios, accesorios, retales y barras.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-black text-white">
            <Calculator size={16} className="text-cyan-400" /> {titulo}
          </h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Los retales se descuentan primero; lo que no cabe se pide en barras de{' '}
            {Number(largoBarraCm)} cm.
          </p>
        </div>
        <span className="text-[9px] text-slate-500 font-mono whitespace-nowrap">
          {data.generadoEn ? new Date(data.generadoEn).toLocaleString('es-CO') : ''}
        </span>
      </div>

      <Resumen totales={{ ...data.totales, largoBarraCm }} />

      {advertencias.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-3 space-y-1">
          {advertencias.map((advertencia, indice) => (
            <p key={indice} className="flex items-start gap-2 text-[11px] text-amber-200">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {advertencia}
            </p>
          ))}
        </div>
      )}

      <div className={compacto ? 'space-y-3' : 'space-y-4'}>
        {(data.items || []).map((item, indice) => (
          <div key={item.itemId || indice} className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-black text-white flex items-center gap-1.5">
                  <Layers size={13} className="text-blue-400" />
                  {indice + 1}. {item.descripcion}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {item.sistemaNombre} · {formatearCm(item.anchoCm)} × {formatearCm(item.altoCm)} ·{' '}
                  {item.cantidad} unidad{item.cantidad === 1 ? '' : 'es'}
                  {item.color ? ` · ${item.color}` : ''}
                  {item.vidrioTipo ? ` · ${item.vidrioTipo}` : ''}
                  {item.vidrioEspesor ? ` ${item.vidrioEspesor}` : ''}
                </p>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2 py-1">
                {formatCOP(item.costo)}
              </span>
            </div>

            <TablaCortes cortes={item.cortes || []} />
            <TablaVidrios vidrios={item.vidrios || []} item={item} />
            <TablaAccesorios accesorios={item.accesorios || []} />
          </div>
        ))}
      </div>

      <TablaRetales retales={data.retalesUsados || []} largoBarraCm={largoBarraCm} />
      <TablaBarras barras={data.barrasNuevas || []} largoBarraCm={largoBarraCm} />

      {(data.resumen || []).length > 0 && (
        <details className="bg-slate-950 border border-slate-800 rounded-2xl p-3">
          <summary className="text-[11px] font-bold text-slate-300 cursor-pointer">
            Resumen consolidado de materiales
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="text-slate-500 uppercase text-[9px]">
                <tr>
                  <th className="px-2 py-1.5">Material</th>
                  <th className="px-2 py-1.5 text-right">Cantidad</th>
                  <th className="px-2 py-1.5 text-right">Metros</th>
                  <th className="px-2 py-1.5 text-right">Área</th>
                  <th className="px-2 py-1.5 text-right">Retal</th>
                  <th className="px-2 py-1.5 text-right">Barras</th>
                  <th className="px-2 py-1.5 text-right">Costo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {data.resumen.map((linea, indice) => (
                  <tr key={`${linea.materialId}-${indice}`}>
                    <td className="px-2 py-1.5 font-semibold text-white">{linea.nombre}</td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {linea.cantidad} {linea.tipoPieza === 'vidrio' ? 'piezas' : linea.unidad}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {linea.totalMetros ? formatearMetros(linea.totalMetros) : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {linea.areaM2 ? formatearArea(linea.areaM2) : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-emerald-300">
                      {linea.piezasRetal || '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-amber-400">
                      {linea.barras || '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">{formatCOP(linea.costo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
