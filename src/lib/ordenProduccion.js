// Genera la orden de producción imprimible/descargable de una orden de trabajo.
// Incluye datos del cliente, proyectos, cortes, retales aprovechados, barras
// nuevas de 595 cm, vidrios, accesorios y espacio para firmas.
// Abre una ventana nueva lista para imprimir o guardar como PDF.

import { formatCOP, formatFechaHora } from './format';
import {
  describirVidrioSolicitado,
  etiquetaFormula,
  vidrioCoincideConReceta,
} from './despiece';

function escapar(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (caracter) => {
    const mapa = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return mapa[caracter];
  });
}

const cm = (valor) => {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '—';
  return `${numero.toLocaleString('es-CO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} cm`;
};

const metros = (valor) => {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '—';
  return `${numero.toLocaleString('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} m`;
};

function resumenPorMaterial(items = [], campo) {
  const mapa = new Map();
  items.forEach((item) => {
    (item[campo] || []).forEach((linea) => {
      const clave = `${linea.nombre}|${linea.unidad || ''}`;
      const actual = mapa.get(clave) || {
        nombre: linea.nombre,
        codigo: linea.codigo,
        unidad: linea.unidad,
        cantidad: 0,
        areaM2: 0,
        costo: 0,
      };
      actual.cantidad += Number(linea.cantidad || 0);
      actual.areaM2 += Number(linea.areaM2 || 0);
      actual.costo += Number(linea.costo || 0);
      mapa.set(clave, actual);
    });
  });
  return [...mapa.values()];
}

/**
 * Detalle de vidrios con la medida exacta de corte (ancho × alto en cm).
 * No se consolida por material para no perder tamaños distintos del mismo
 * vidrio: cada fila es una medida que el taller debe cortar.
 */
function detalleVidrios(items = []) {
  const filas = [];
  items.forEach((item) => {
    (item.vidrios || []).forEach((vidrio) => {
      const solicitado =
        vidrio.solicitado || describirVidrioSolicitado(item);
      const difiere =
        typeof vidrio.difiereReceta === 'boolean'
          ? vidrio.difiereReceta
          : !vidrioCoincideConReceta(vidrio.nombre, item);
      filas.push({
        proyecto: item.descripcion || 'Proyecto',
        nombre: vidrio.nombre || 'Vidrio',
        codigo: vidrio.codigo || '',
        anchoCm: Number(vidrio.anchoMm) / 10,
        altoCm: Number(vidrio.altoMm) / 10,
        cantidad: Number(vidrio.cantidad || 0),
        areaM2: Number(vidrio.areaM2 || 0),
        solicitado,
        difiere: difiere && Boolean(solicitado),
      });
    });
  });
  return filas;
}

/**
 * Abre la orden de producción en una ventana nueva.
 *
 * @param {Object} opciones
 * @param {Object} opciones.empresa  Configuración de la empresa (opcional).
 * @param {Object} opciones.orden    Fila de `ordenes_trabajo`.
 * @param {Array}  opciones.items    Ítems de la orden.
 * @param {Object} opciones.despiece Despiece calculado.
 * @param {String} opciones.generadoPor Nombre de quien genera el documento.
 */
export function imprimirOrdenProduccion({ empresa, orden, items = [], despiece, generadoPor }) {
  if (!orden) return;

  const ventana = window.open('', '_blank', 'width=980,height=800');
  if (!ventana) {
    return false;
  }

  const nombreEmpresa = empresa?.nombre_comercial || 'YiKev Stratos';
  const ciudad = empresa?.ciudad || 'Quibdó';
  const telefono = [empresa?.telefono, empresa?.celular].filter(Boolean).join(' · ');
  const nit = empresa?.nit
    ? `NIT ${empresa.nit}${empresa.digito_verificacion ? `-${empresa.digito_verificacion}` : ''}`
    : '';
  const largoBarraCm = Number(despiece?.largoBarraCm || despiece?.totales?.largoBarraCm || 595);
  const totales = despiece?.totales || {};

  // Si la orden no tiene ítems cargados, la instantánea del despiece conserva
  // las medidas de cada proyecto para poder imprimir el documento igual.
  const proyectosBase = items.length
    ? items
    : (despiece?.items || []).map((item) => ({
        descripcion: item.descripcion,
        sistema_nombre: item.sistemaNombre,
        ancho_cm: item.anchoCm,
        alto_cm: item.altoCm,
        cantidad: item.cantidad,
        vidrio_tipo: item.vidrioTipo,
        vidrio_espesor: item.vidrioEspesor,
        color: item.color,
        observaciones: item.observaciones,
      }));

  const proyectos = proyectosBase
    .map(
      (item, indice) => `
        <tr>
          <td class="centro">${indice + 1}</td>
          <td>
            <strong>${escapar(item.descripcion || 'Proyecto')}</strong>
            ${item.observaciones ? `<br /><span class="nota">${escapar(item.observaciones)}</span>` : ''}
          </td>
          <td>${escapar(item.sistema_nombre || 'Sin sistema')}</td>
          <td class="centro mono">${cm(item.ancho_cm)}</td>
          <td class="centro mono">${cm(item.alto_cm)}</td>
          <td class="centro mono">${escapar(item.cantidad || 1)}</td>
          <td>${escapar(item.vidrio_tipo || '—')}<br /><span class="nota">${escapar(
            item.vidrio_espesor || '',
          )}</span></td>
          <td>${escapar(item.color || 'Sin definir')}</td>
        </tr>`,
    )
    .join('');

  const cortes = [];
  (despiece?.items || []).forEach((item) => {
    (item.cortes || []).forEach((corte) => {
      cortes.push(`
        <tr>
          <td>${escapar(item.descripcion)}</td>
          <td><strong>${escapar(corte.nombre)}</strong>${
            corte.codigo ? `<br /><span class="nota mono">${escapar(corte.codigo)}</span>` : ''
          }</td>
          <td>${escapar(
            corte.formulaTexto || etiquetaFormula(corte.formula),
          )}</td>
          <td class="centro mono">${Number(corte.cantidad || 0)}</td>
          <td class="centro mono fuerte">${cm(corte.largoCorteCm)}</td>
          <td class="centro mono">${
            Number(corte.anguloCorte)
              ? `${Number(corte.anguloCorte)}°${
                  corte.ladoAngulo ? ` · lado ${escapar(corte.ladoAngulo)}` : ''
                }`
              : '—'
          }</td>
          <td class="centro mono">${Number(corte.piezasRetal || 0) || '—'}</td>
          <td class="centro mono">${Number(corte.barrasNuevas ?? corte.barras ?? 0) || '—'}</td>
        </tr>`);
    });
  });

  const retales = (despiece?.retalesUsados || [])
    .map(
      (retal) => `
        <tr>
          <td class="mono">${escapar(retal.codigo || '—')}</td>
          <td>${escapar(retal.material || '—')}</td>
          <td>${escapar(retal.color || 'Sin definir')}</td>
          <td class="centro mono">${cm(retal.largoCm)}</td>
          <td class="centro mono">${Number(retal.piezas || 0)}</td>
          <td class="centro mono">${cm(retal.sobranteCm)}</td>
          <td class="centro mono">${Number(retal.aprovechamiento || 0)}%</td>
        </tr>`,
    )
    .join('');

  const barras = (despiece?.barrasNuevas || [])
    .map(
      (barra) => `
        <tr>
          <td><strong>${escapar(barra.nombre)}</strong></td>
          <td>${escapar(barra.color || 'Sin definir')}</td>
          <td class="centro mono fuerte">${Number(barra.barras || 0)}</td>
          <td class="centro mono">${Number(barra.piezas || 0)}</td>
          <td class="centro mono">${cm(barra.sobranteCm)}</td>
          <td class="centro mono">${Number(barra.barras || 0) * largoBarraCm} cm</td>
        </tr>`,
    )
    .join('');

  const accesorios = resumenPorMaterial(despiece?.items || [], 'accesorios')
    .map(
      (linea) => `
        <tr>
          <td><strong>${escapar(linea.nombre)}</strong>${
            linea.codigo ? `<br /><span class="nota mono">${escapar(linea.codigo)}</span>` : ''
          }</td>
          <td class="centro mono fuerte">${Number(linea.cantidad || 0)}</td>
          <td>${escapar(linea.unidad || 'Unidad')}</td>
        </tr>`,
    )
    .join('');

  const vidriosDetalle = detalleVidrios(despiece?.items || []);
  const vidriosConDiferencia = vidriosDetalle.filter((vidrio) => vidrio.difiere);
  const vidrios = vidriosDetalle
    .map(
      (vidrio) => `
        <tr>
          <td>${escapar(vidrio.proyecto)}</td>
          <td><strong>${escapar(vidrio.nombre)}</strong>${
            vidrio.codigo ? `<br /><span class="nota mono">${escapar(vidrio.codigo)}</span>` : ''
          }${
            vidrio.difiere
              ? `<br /><span class="alerta">La orden pide: ${escapar(vidrio.solicitado)}</span>`
              : ''
          }</td>
          <td class="centro mono fuerte">${cm(vidrio.anchoCm)}</td>
          <td class="centro mono fuerte">${cm(vidrio.altoCm)}</td>
          <td class="centro mono">${Number(vidrio.cantidad || 0)}</td>
          <td class="centro mono">${Number(vidrio.areaM2 || 0).toFixed(2)} m²</td>
        </tr>`,
    )
    .join('');

  const datos = [
    ['Código de orden', orden.codigo_orden || '—'],
    ['Estado', orden.estado || '—'],
    ['Cliente', orden.cliente_nombre || '—'],
    ['Teléfono', orden.cliente_telefono || '—'],
    ['Dirección', orden.cliente_direccion || '—'],
    ['Barrio / sector', orden.cliente_barrio || '—'],
    ['Instalador', orden.instalador_nombre || '—'],
    ['Producción', orden.produccion_nombre || '—'],
    ['Fecha de la orden', formatFechaHora(orden.creado_en)],
    ['Generado por', generadoPor || '—'],
  ]
    .map(
      ([etiqueta, valor]) => `
        <p class="dato"><strong>${escapar(etiqueta)}:</strong> ${escapar(valor)}</p>`,
    )
    .join('');

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Orden de producción · ${escapar(orden.codigo_orden || orden.cliente_nombre || '')}</title>
  <style>
    @page { size: A4; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", Arial, Helvetica, sans-serif;
      color: #111827;
      font-size: 9.5pt;
      line-height: 1.4;
      margin: 0;
      padding: 20px;
      background: #ffffff;
    }
    .hoja { max-width: 900px; margin: 0 auto; }
    .encabezado { display: flex; justify-content: space-between; gap: 24px; border-bottom: 3px solid #111827; padding-bottom: 10px; }
    .marca { font-size: 19pt; font-weight: 800; letter-spacing: 0.4px; margin: 0; }
    .sub { font-size: 8.5pt; color: #4b5563; margin: 2px 0 0; }
    .empresa-datos { text-align: right; font-size: 8pt; color: #4b5563; line-height: 1.4; }
    h1 { font-size: 14pt; text-align: center; margin: 18px 0 2px; text-transform: uppercase; letter-spacing: 0.6px; }
    .fecha { text-align: center; font-size: 8.5pt; color: #4b5563; margin: 0 0 14px; }
    .datos { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 24px; margin-bottom: 12px; font-size: 9pt; }
    .dato { margin: 0; }
    h2 { font-size: 10pt; margin: 16px 0 4px; padding-bottom: 3px; border-bottom: 1.5px solid #111827; text-transform: uppercase; letter-spacing: 0.4px; }
    table { width: 100%; border-collapse: collapse; margin: 4px 0 10px; font-size: 8.5pt; }
    th, td { border: 1px solid #9ca3af; padding: 4px 5px; vertical-align: top; }
    th { background: #f3f4f6; text-align: left; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.25px; }
    .centro { text-align: center; }
    .mono { font-family: "Courier New", monospace; font-size: 8.2pt; }
    .fuerte { font-weight: 700; }
    .nota { color: #6b7280; font-size: 7.6pt; }
    .alerta { color: #b91c1c; font-size: 7.8pt; font-weight: 700; }
    .resumen { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 8px 0 12px; }
    .tarjeta { border: 1px solid #d1d5db; border-radius: 6px; padding: 6px 8px; }
    .tarjeta span { display: block; font-size: 7pt; text-transform: uppercase; color: #6b7280; }
    .tarjeta strong { font-size: 10pt; }
    .aviso { border-left: 4px solid #b45309; background: #fffbeb; padding: 6px 10px; font-size: 8.5pt; margin: 8px 0; }
    .notas { border: 1px solid #d1d5db; min-height: 48px; padding: 8px; font-size: 8.5pt; }
    .firmas { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 32px; margin-top: 46px; }
    .firma { text-align: center; font-size: 8pt; }
    .linea { border-top: 1px solid #111827; margin-bottom: 5px; padding-top: 5px; }
    .firma strong { display: block; font-size: 8.8pt; }
    .firma span { color: #4b5563; }
    .pie { margin-top: 26px; border-top: 1px solid #d1d5db; padding-top: 6px; font-size: 7pt; color: #6b7280; text-align: center; }
    .acciones { max-width: 900px; margin: 0 auto 14px; display: flex; justify-content: flex-end; gap: 10px; }
    .acciones button {
      background: #111827; color: #fff; border: 0; border-radius: 8px;
      padding: 10px 18px; font-size: 11px; font-weight: 700; cursor: pointer;
    }
    @media print {
      body { padding: 0; }
      .acciones { display: none; }
      h2 { break-after: avoid; }
      table { break-inside: auto; }
      tr { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="acciones">
    <button type="button" onclick="window.print()">Imprimir / Guardar PDF</button>
  </div>

  <div class="hoja">
    <div class="encabezado">
      <div>
        <p class="marca">${escapar(nombreEmpresa)}</p>
        <p class="sub">Taller de aluminio, vidrio, PVC y acrílico</p>
      </div>
      <div class="empresa-datos">
        ${escapar(ciudad)}${empresa?.departamento_geografico ? `, ${escapar(empresa.departamento_geografico)}` : ''}<br />
        ${telefono ? `${escapar(telefono)}<br />` : ''}
        ${empresa?.email ? `${escapar(empresa.email)}<br />` : ''}
        ${nit}
      </div>
    </div>

    <h1>Orden de producción</h1>
    <p class="fecha">${escapar(ciudad)}, ${escapar(formatFechaHora(new Date().toISOString()))}</p>

    <div class="datos">
      ${datos}
    </div>

    <div class="resumen">
      <div class="tarjeta"><span>Proyectos</span><strong>${totales.items ?? proyectosBase.length}</strong></div>
      <div class="tarjeta"><span>Perfil cortado</span><strong>${metros(totales.metrosPerfil || 0)}</strong></div>
      <div class="tarjeta"><span>Barras nuevas (${largoBarraCm} cm)</span><strong>${totales.barras || 0}</strong></div>
      <div class="tarjeta"><span>Piezas desde retal</span><strong>${totales.piezasRetal || 0}</strong></div>
    </div>

    <h2>Proyectos y medidas</h2>
    <table>
      <thead>
        <tr>
          <th class="centro" style="width: 26px">No.</th>
          <th>Proyecto</th>
          <th>Sistema</th>
          <th class="centro" style="width: 64px">Ancho</th>
          <th class="centro" style="width: 64px">Alto</th>
          <th class="centro" style="width: 40px">Cant.</th>
          <th>Vidrio</th>
          <th style="width: 80px">Color</th>
        </tr>
      </thead>
      <tbody>
        ${proyectos || '<tr><td colspan="8" class="centro">Sin proyectos registrados</td></tr>'}
      </tbody>
    </table>

    <h2>Cortes de perfiles</h2>
    <table>
      <thead>
        <tr>
          <th>Proyecto</th>
          <th>Perfil / pieza</th>
          <th>Fórmula aplicada</th>
          <th class="centro" style="width: 48px">Piezas</th>
          <th class="centro" style="width: 62px">Corte</th>
          <th class="centro" style="width: 38px">Áng.</th>
          <th class="centro" style="width: 48px">Retal</th>
          <th class="centro" style="width: 48px">Barras</th>
        </tr>
      </thead>
      <tbody>
        ${
          cortes.join('') ||
          `<tr><td colspan="8" class="centro">${
            vidriosDetalle.length
              ? 'Este sistema no lleva perfiles de aluminio. Las medidas de corte del vidrio están en la sección “Vidrios”.'
              : 'Sin cortes calculados'
          }</td></tr>`
        }
      </tbody>
    </table>

    <h2>Retales aprovechados</h2>
    <table>
      <thead>
        <tr>
          <th style="width: 110px">Retal</th>
          <th>Material</th>
          <th style="width: 90px">Color</th>
          <th class="centro" style="width: 60px">Largo</th>
          <th class="centro" style="width: 48px">Piezas</th>
          <th class="centro" style="width: 64px">Sobrante</th>
          <th class="centro" style="width: 48px">Uso</th>
        </tr>
      </thead>
      <tbody>
        ${retales || '<tr><td colspan="7" class="centro">No se usaron retales</td></tr>'}
      </tbody>
    </table>

    <h2>Barras nuevas de ${largoBarraCm} cm</h2>
    <table>
      <thead>
        <tr>
          <th>Material</th>
          <th style="width: 90px">Color</th>
          <th class="centro" style="width: 52px">Barras</th>
          <th class="centro" style="width: 52px">Piezas</th>
          <th class="centro" style="width: 70px">Sobrante</th>
          <th class="centro" style="width: 76px">Total pedido</th>
        </tr>
      </thead>
      <tbody>
        ${barras || '<tr><td colspan="6" class="centro">No se necesitan barras nuevas</td></tr>'}
      </tbody>
    </table>

    <h2>Vidrios · medidas de corte</h2>
    ${
      vidriosConDiferencia.length
        ? `<div class="aviso"><strong>Revisar vidrio antes de cortar:</strong> la receta del sistema y el vidrio pedido en la orden no coinciden. Confirma con el cliente o el jefe de taller cuál se instala: ${vidriosConDiferencia
            .map(
              (vidrio) =>
                `${escapar(vidrio.proyecto)} → ${escapar(vidrio.nombre)} (receta) vs ${escapar(
                  vidrio.solicitado,
                )} (orden)`,
            )
            .join('; ')}.</div>`
        : ''
    }
    <table>
      <thead>
        <tr>
          <th>Proyecto</th>
          <th>Vidrio</th>
          <th class="centro" style="width: 64px">Ancho</th>
          <th class="centro" style="width: 64px">Alto</th>
          <th class="centro" style="width: 48px">Piezas</th>
          <th class="centro" style="width: 70px">Área</th>
        </tr>
      </thead>
      <tbody>
        ${vidrios || '<tr><td colspan="6" class="centro">Sin vidrios</td></tr>'}
      </tbody>
    </table>

    <h2>Accesorios y consumibles</h2>
    <table>
      <thead>
        <tr><th>Material</th><th class="centro" style="width: 56px">Cant.</th><th style="width: 90px">Unidad</th></tr>
      </thead>
      <tbody>
        ${accesorios || '<tr><td colspan="3" class="centro">Sin accesorios</td></tr>'}
      </tbody>
    </table>

    ${
      despiece?.advertencias?.length
        ? `<div class="aviso"><strong>Revisar antes de cortar:</strong><br />${despiece.advertencias
            .map((advertencia) => `• ${escapar(advertencia)}`)
            .join('<br />')}</div>`
        : ''
    }

    <h2>Observaciones de producción</h2>
    <div class="notas">${escapar(
      orden.notas_produccion ||
        'Escribe aquí las instrucciones especiales, cambios de última hora o verificaciones de medidas.',
    )}</div>

    <div class="firmas">
      <div class="firma">
        <div class="linea"></div>
        <strong>${escapar(orden.produccion_nombre || 'Producción')}</strong>
        <span>Realiza / revisa</span>
      </div>
      <div class="firma">
        <div class="linea"></div>
        <strong>${escapar(orden.instalador_nombre || 'Instalación')}</strong>
        <span>Instala</span>
      </div>
      <div class="firma">
        <div class="linea"></div>
        <strong>${escapar(generadoPor || 'Jefe de taller')}</strong>
        <span>Autoriza</span>
      </div>
    </div>

    <p class="pie">
      Documento generado desde el ERP de ${escapar(nombreEmpresa)} ·
      ${escapar(formatFechaHora(new Date().toISOString()))} ·
      Costo estimado de materiales: ${escapar(formatCOP(totales.costo || 0))} ·
      Compra nueva estimada: ${escapar(formatCOP(totales.costoCompra ?? totales.costo ?? 0))}
    </p>
  </div>
</body>
</html>`;

  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();
  ventana.focus();
  return true;
}
