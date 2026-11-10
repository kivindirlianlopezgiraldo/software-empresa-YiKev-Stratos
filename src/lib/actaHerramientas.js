// Genera la carta responsiva / acta imprimible de entrega y devolución
// de herramientas. Abre una ventana nueva lista para imprimir o guardar en PDF.

import { formatFechaHora } from './format';

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

export function imprimirActaHerramientas({ empresa, lote, orden, colaborador, registradoPor }) {
  const ventana = window.open('', '_blank', 'width=900,height=760');
  if (!ventana) {
    return false;
  }

  const esSalida = lote?.tipo !== 'entrada';
  const nombreEmpresa = empresa?.nombre_comercial || 'YiKev Stratos';
  const ciudad = empresa?.ciudad || 'Quibdó';
  const telefono = [empresa?.telefono, empresa?.celular].filter(Boolean).join(' · ');
  const nit = empresa?.nit ? `NIT ${empresa.nit}${empresa.digito_verificacion ? `-${empresa.digito_verificacion}` : ''}` : '';

  const herramientas = Array.isArray(lote?.items) ? lote.items : [];
  const filas = herramientas
    .map(
      (movimiento, indice) => `
        <tr>
          <td class="centro">${indice + 1}</td>
          <td class="mono">${escapar(movimiento.herramienta_codigo || '—')}</td>
          <td>${escapar(movimiento.herramienta_nombre || 'Herramienta')}</td>
          <td class="centro">1</td>
          <td class="centro">${esSalida ? 'Entregada' : 'Devuelta'}</td>
        </tr>`,
    )
    .join('');

  const referenciaOrden = orden
    ? `<p class="dato"><strong>Orden asociada:</strong> ${escapar(orden.codigo_orden || '')} ${
        orden.cliente_nombre ? `· ${escapar(orden.cliente_nombre)}` : ''
      }</p>`
    : '';

  const documento = colaborador?.documento_id
    ? `, identificado(a) con documento ${escapar(colaborador.documento_id)}`
    : '';

  const parrafo = esSalida
    ? `Yo, <strong>${escapar(colaborador?.nombre_completo || lote?.colaborador_nombre || '')}</strong>${documento},
       en calidad de <strong>${escapar(colaborador?.cargo || colaborador?.rol || 'colaborador')}</strong>,
       declaro haber recibido de <strong>${escapar(nombreEmpresa)}</strong> los elementos relacionados
       en la tabla anterior, en buen estado y para uso exclusivo en las labores del taller.
       Me comprometo a: (1) usar los elementos únicamente para las actividades de la empresa;
       (2) mantenerlos en buen estado y reportar de inmediato cualquier daño, pérdida o robo;
       (3) devolverlos cuando la empresa lo solicite o al terminar la relación laboral;
       (4) responder por el costo de reparación o reposición en caso de pérdida o daño
       ocasionado por uso indebido, conforme a la legislación laboral vigente.`
    : `Yo, <strong>${escapar(colaborador?.nombre_completo || lote?.colaborador_nombre || '')}</strong>${documento},
       en calidad de <strong>${escapar(colaborador?.cargo || colaborador?.rol || 'colaborador')}</strong>,
       declaro haber devuelto a <strong>${escapar(nombreEmpresa)}</strong> los elementos relacionados
       en la tabla anterior, en las condiciones registradas en esta acta. La empresa verifica
       la recepción y deja constancia de las novedades reportadas.`;

  const novedad = lote?.novedad
    ? `<div class="novedad"><strong>Novedad reportada:</strong> ${escapar(lote.novedad)}</div>`
    : '';

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${esSalida ? 'Carta responsiva' : 'Acta de devolución'} · ${escapar(
    colaborador?.nombre_completo || lote?.colaborador_nombre || '',
  )}</title>
  <style>
    @page { size: A4; margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", Arial, Helvetica, sans-serif;
      color: #111827;
      font-size: 11pt;
      line-height: 1.5;
      margin: 0;
      padding: 24px;
      background: #ffffff;
    }
    .hoja { max-width: 780px; margin: 0 auto; }
    .encabezado { display: flex; justify-content: space-between; gap: 24px; border-bottom: 3px solid #111827; padding-bottom: 12px; }
    .marca { font-size: 20pt; font-weight: 800; letter-spacing: 0.5px; margin: 0; }
    .sub { font-size: 9pt; color: #4b5563; margin: 2px 0 0; }
    .empresa-datos { text-align: right; font-size: 8.5pt; color: #4b5563; line-height: 1.4; }
    h1 { font-size: 13pt; text-align: center; margin: 26px 0 4px; text-transform: uppercase; letter-spacing: 0.6px; }
    .fecha { text-align: center; font-size: 9pt; color: #4b5563; margin: 0 0 22px; }
    .datos { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; margin-bottom: 16px; font-size: 10pt; }
    .dato { margin: 0; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0 18px; font-size: 9.5pt; }
    th, td { border: 1px solid #9ca3af; padding: 7px 8px; vertical-align: top; }
    th { background: #f3f4f6; text-align: left; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.3px; }
    .centro { text-align: center; }
    .mono { font-family: "Courier New", monospace; font-size: 9pt; }
    .parrafo { text-align: justify; margin: 14px 0; font-size: 10pt; }
    .novedad { border-left: 4px solid #b45309; background: #fffbeb; padding: 8px 12px; font-size: 9.5pt; margin: 12px 0; }
    .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 64px; }
    .firma { text-align: center; font-size: 9pt; }
    .linea { border-top: 1px solid #111827; margin-bottom: 6px; padding-top: 6px; }
    .firma strong { display: block; font-size: 10pt; }
    .firma span { color: #4b5563; }
    .pie { margin-top: 40px; border-top: 1px solid #d1d5db; padding-top: 8px; font-size: 8pt; color: #6b7280; text-align: center; }
    .acciones { max-width: 780px; margin: 0 auto 18px; display: flex; justify-content: flex-end; gap: 10px; }
    .acciones button {
      background: #111827; color: #fff; border: 0; border-radius: 8px;
      padding: 10px 18px; font-size: 11px; font-weight: 700; cursor: pointer;
    }
    @media print {
      body { padding: 0; }
      .acciones { display: none; }
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
        ${ciudad}${empresa?.departamento_geografico ? `, ${escapar(empresa.departamento_geografico)}` : ''}<br />
        ${telefono ? `${escapar(telefono)}<br />` : ''}
        ${empresa?.email ? `${escapar(empresa.email)}<br />` : ''}
        ${nit}
      </div>
    </div>

    <h1>${esSalida ? 'Carta responsiva de herramientas' : 'Acta de devolución de herramientas'}</h1>
    <p class="fecha">${escapar(ciudad)}, ${escapar(formatFechaHora(lote?.creado_en))}</p>

    <div class="datos">
      <p class="dato"><strong>Colaborador:</strong> ${escapar(
        colaborador?.nombre_completo || lote?.colaborador_nombre || '—',
      )}</p>
      <p class="dato"><strong>Documento:</strong> ${escapar(colaborador?.documento_id || '—')}</p>
      <p class="dato"><strong>Cargo:</strong> ${escapar(
        colaborador?.cargo || colaborador?.rol || '—',
      )}</p>
      <p class="dato"><strong>Registrado por:</strong> ${escapar(
        registradoPor || lote?.registrado_por_nombre || '—',
      )}</p>
    </div>
    ${referenciaOrden}

    <table>
      <thead>
        <tr>
          <th class="centro" style="width: 34px">No.</th>
          <th style="width: 120px">Código / serial</th>
          <th>Herramienta</th>
          <th class="centro" style="width: 60px">Cant.</th>
          <th class="centro" style="width: 90px">Estado</th>
        </tr>
      </thead>
      <tbody>
        ${filas || '<tr><td colspan="5" class="centro">Sin herramientas registradas</td></tr>'}
      </tbody>
    </table>

    ${novedad}

    <p class="parrafo">${parrafo}</p>

    <div class="firmas">
      <div class="firma">
        <div class="linea"></div>
        <strong>${escapar(registradoPor || lote?.registrado_por_nombre || 'Entrega')}</strong>
        <span>Entrega · ${escapar(nombreEmpresa)}</span>
      </div>
      <div class="firma">
        <div class="linea"></div>
        <strong>${escapar(colaborador?.nombre_completo || lote?.colaborador_nombre || 'Recibe')}</strong>
        <span>Recibe · Documento ${escapar(colaborador?.documento_id || '____________')}</span>
      </div>
    </div>

    <p class="pie">
      Documento generado desde el ERP de ${escapar(nombreEmpresa)} ·
      ${escapar(formatFechaHora(new Date().toISOString()))}
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
