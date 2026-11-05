// ============================================================================
// Motor de despiece
// ----------------------------------------------------------------------------
// A partir de las medidas de cada ítem de la orden y de la receta configurada
// en el sistema, calcula:
//   · medidas de corte de cada perfil (con descuentos y merma),
//   · cantidad de barras de 6 m,
//   · medidas exactas de cada vidrio,
//   · accesorios, empaques y cantidades,
//   · costo estimado de materiales.
// No accede a Supabase: recibe los datos ya cargados para poder probarse y
// reutilizarse en la vista previa y en el guardado de la orden.
// ============================================================================

import { FORMULAS_CORTE, TIPOS_PIEZA } from './constants';

const num = (valor, defecto = 0) => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : defecto;
};

const redondear = (valor, decimales = 1) => {
  const factor = 10 ** decimales;
  return Math.round((num(valor) + Number.EPSILON) * factor) / factor;
};

const limite = (valor) => Math.max(0, valor);

const esCategoriaVidrio = (categoria = '') =>
  /vidrio|cristal|espejo/i.test(String(categoria));

const esCategoriaPerfil = (categoria = '') =>
  /perfil|aluminio|pvc|acrílico|acrilico/i.test(String(categoria));

export function etiquetaFormula(valor) {
  return FORMULAS_CORTE.find((f) => f.valor === valor)?.etiqueta || 'Cantidad fija';
}

export function etiquetaTipoPieza(valor) {
  return TIPOS_PIEZA.find((t) => t.valor === valor)?.etiqueta || valor;
}

/** Largo base (cm) que aporta una fórmula antes de descuentos. */
export function largoBaseCm(formula, anchoCm, altoCm) {
  const ancho = limite(num(anchoCm));
  const alto = limite(num(altoCm));

  switch (formula) {
    case 'ancho':
      return ancho;
    case 'alto':
      return alto;
    case 'ancho_mitad':
      return ancho / 2;
    case 'alto_mitad':
      return alto / 2;
    case 'perimetro':
      return 2 * (ancho + alto);
    default:
      return 0;
  }
}

function datosMaterial(linea) {
  const material = linea.material || {};
  const categoria = material.categoria || linea.categoria || '';
  const tipoPieza =
    linea.tipo_pieza ||
    (esCategoriaVidrio(categoria)
      ? 'vidrio'
      : esCategoriaPerfil(categoria)
        ? 'perfil'
        : /empaque|sellante|silicona/i.test(categoria)
          ? 'empaque'
          : 'accesorio');

  return {
    materialId: material.id || linea.material_id || linea.id,
    nombre: material.nombre || linea.material_nombre || 'Material sin nombre',
    codigo: material.codigo_referencia || linea.codigo_referencia || '',
    categoria,
    unidad: material.unidad_medida || linea.unidad_medida || 'Unidad',
    precio: num(material.precio_venta ?? linea.precio_venta),
    tipoPieza,
    esVidrio: Boolean(linea.es_vidrio) || tipoPieza === 'vidrio' || esCategoriaVidrio(categoria),
    formula: linea.formula_largo || (tipoPieza === 'perfil' ? 'perimetro' : 'fijo'),
    descuentoMm: num(linea.descuento_mm),
    merma: num(linea.merma_porcentaje),
    cantidadReceta: num(linea.cantidad_requerida, 1) || 1,
  };
}

/**
 * Calcula el despiece de una orden.
 *
 * @param {Array} items  Ítems de la orden: { id, sistema_id, sistemaId, descripcion,
 *                       ancho_cm, alto_cm, cantidad, tipo_trabajo, vidrio_tipo, vidrio_espesor }
 * @param {Array} sistemas Sistemas con su receta: { id, nombre, descuento_vidrio_ancho_mm,
 *                       descuento_vidrio_alto_mm, merma_porcentaje, materiales: [...] }
 */
export function generarDespiece(items = [], sistemas = []) {
  const mapaSistemas = new Map();
  sistemas.forEach((sistema) => mapaSistemas.set(String(sistema.id), sistema));

  const advertencias = [];
  const itemsCalculados = [];
  const resumenMapa = new Map();

  const agregarResumen = (linea) => {
    const clave = String(linea.materialId || linea.nombre);
    const actual = resumenMapa.get(clave) || {
      materialId: linea.materialId,
      nombre: linea.nombre,
      codigo: linea.codigo,
      unidad: linea.unidad,
      tipoPieza: linea.tipoPieza,
      cantidad: 0,
      totalMetros: 0,
      areaM2: 0,
      barras: 0,
      costo: 0,
    };

    actual.cantidad += linea.cantidad;
    actual.totalMetros += linea.totalMetros || 0;
    actual.areaM2 += linea.areaM2 || 0;
    actual.barras += linea.barras || 0;
    actual.costo += linea.costo || 0;
    resumenMapa.set(clave, actual);
  };

  (items || []).forEach((item, indice) => {
    const sistemaId = item.sistema_id || item.sistemaId;
    const sistema = mapaSistemas.get(String(sistemaId));
    const anchoCm = num(item.ancho_cm ?? item.anchoCm);
    const altoCm = num(item.alto_cm ?? item.altoCm);
    const cantidadItem = Math.max(1, Math.round(num(item.cantidad, 1)));

    const descripcion =
      item.descripcion?.trim() ||
      item.tipo_trabajo ||
      sistema?.nombre ||
      `Proyecto ${indice + 1}`;

    if (!sistema) {
      advertencias.push(`${descripcion}: no tiene un sistema asociado. El despiece no se puede calcular.`);
    }
    if (anchoCm <= 0 || altoCm <= 0) {
      advertencias.push(`${descripcion}: faltan el ancho o el alto para calcular el despiece.`);
    }

    const receta = sistema?.materiales || item.materiales || [];
    if (sistema && receta.length === 0) {
      advertencias.push(`${descripcion}: el sistema “${sistema.nombre}” no tiene materiales en su receta.`);
    }

    const descVidrioAncho = num(sistema?.descuento_vidrio_ancho_mm, 30);
    const descVidrioAlto = num(sistema?.descuento_vidrio_alto_mm, 30);
    const mermaSistema = num(sistema?.merma_porcentaje, 5);

    const cortes = [];
    const vidrios = [];
    const accesorios = [];
    let costoItem = 0;

    receta.forEach((linea) => {
      const material = datosMaterial(linea);
      const merma = material.merma || mermaSistema;
      const cantidadPorItem = material.cantidadReceta;

      if (material.esVidrio) {
        const anchoMm = limite(anchoCm * 10 - descVidrioAncho - material.descuentoMm);
        const altoMm = limite(altoCm * 10 - descVidrioAlto - material.descuentoMm);
        const piezas = Math.max(1, Math.round(cantidadPorItem)) * cantidadItem;
        const areaUnidad = (anchoMm / 1000) * (altoMm / 1000);
        const areaM2 = areaUnidad * piezas * (1 + merma / 100);
        const costo = areaM2 * material.precio;

        const fila = {
          materialId: material.materialId,
          nombre: material.nombre,
          codigo: material.codigo,
          tipoPieza: 'vidrio',
          unidad: 'm²',
          cantidad: piezas,
          anchoMm: redondear(anchoMm),
          altoMm: redondear(altoMm),
          areaM2: redondear(areaM2, 2),
          merma,
          costo: redondear(costo, 0),
        };

        vidrios.push(fila);
        agregarResumen(fila);
        costoItem += costo;
        return;
      }

      if (material.tipoPieza === 'perfil') {
        const baseCm = largoBaseCm(material.formula, anchoCm, altoCm);
        const piezas = cantidadPorItem * cantidadItem;
        const largoCorteCm = limite(baseCm - material.descuentoMm / 10);
        const totalMetros = (largoCorteCm / 100) * piezas * (1 + merma / 100);
        const unidadBarra = /barra/i.test(material.unidad);
        const barras = unidadBarra ? Math.ceil(totalMetros / 6) : 0;
        const costo = barras > 0 ? barras * material.precio : totalMetros * material.precio;

        const fila = {
          materialId: material.materialId,
          nombre: material.nombre,
          codigo: material.codigo,
          tipoPieza: 'perfil',
          formula: material.formula,
          unidad: unidadBarra ? 'barra 6 m' : material.unidad,
          cantidad: redondear(piezas, 2),
          largoCorteCm: redondear(largoCorteCm),
          totalMetros: redondear(totalMetros, 2),
          barras,
          merma,
          costo: redondear(costo, 0),
        };

        cortes.push(fila);
        agregarResumen(fila);
        costoItem += costo;
        return;
      }

      // Accesorios, empaques y sellantes: cantidad directa.
      const cantidad = cantidadPorItem * cantidadItem;
      const costo = cantidad * material.precio;
      const fila = {
        materialId: material.materialId,
        nombre: material.nombre,
        codigo: material.codigo,
        tipoPieza: material.tipoPieza,
        unidad: material.unidad,
        cantidad: redondear(cantidad, 2),
        costo: redondear(costo, 0),
      };

      accesorios.push(fila);
      agregarResumen(fila);
      costoItem += costo;
    });

    itemsCalculados.push({
      itemId: item.id,
      descripcion,
      sistemaId,
      sistemaNombre: sistema?.nombre || item.sistema_nombre || 'Sin sistema',
      tipoTrabajo: item.tipo_trabajo || item.tipoTrabajo || '',
      anchoCm: redondear(anchoCm),
      altoCm: redondear(altoCm),
      cantidad: cantidadItem,
      vidrioTipo: item.vidrio_tipo || item.vidrioTipo || '',
      vidrioEspesor: item.vidrio_espesor || item.vidrioEspesor || '',
      color: item.color || '',
      cortes,
      vidrios,
      accesorios,
      costo: redondear(costoItem, 0),
    });
  });

  const resumen = [...resumenMapa.values()].map((linea) => ({
    ...linea,
    cantidad: redondear(linea.cantidad, 2),
    totalMetros: redondear(linea.totalMetros, 2),
    areaM2: redondear(linea.areaM2, 2),
    costo: redondear(linea.costo, 0),
  }));

  const totales = resumen.reduce(
    (acc, linea) => ({
      metrosPerfil: acc.metrosPerfil + (linea.tipoPieza === 'perfil' ? linea.totalMetros : 0),
      barras: acc.barras + linea.barras,
      areaVidrio: acc.areaVidrio + linea.areaM2,
      costo: acc.costo + linea.costo,
      materiales: acc.materiales + 1,
    }),
    { metrosPerfil: 0, barras: 0, areaVidrio: 0, costo: 0, materiales: 0 },
  );

  return {
    generadoEn: new Date().toISOString(),
    items: itemsCalculados,
    resumen,
    totales: {
      metrosPerfil: redondear(totales.metrosPerfil, 2),
      barras: totales.barras,
      areaVidrio: redondear(totales.areaVidrio, 2),
      costo: redondear(totales.costo, 0),
      materiales: totales.materiales,
      items: itemsCalculados.length,
      piezas: itemsCalculados.reduce((total, item) => total + item.cantidad, 0),
    },
    advertencias,
  };
}

/** Normaliza el JSON guardado en `ordenes_trabajo.despiece`. */
export function normalizarDespiece(valor) {
  if (!valor) return null;
  if (Array.isArray(valor)) return valor.length ? { items: valor, resumen: [], totales: {} } : null;
  if (typeof valor === 'string') {
    try {
      return normalizarDespiece(JSON.parse(valor));
    } catch {
      return null;
    }
  }
  if (typeof valor === 'object') return valor;
  return null;
}

export function formatearCm(valor, decimales = 1) {
  const n = num(valor);
  return `${n.toLocaleString('es-CO', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })} cm`;
}

export function formatearMm(valor) {
  return formatearCm(num(valor) / 10, 1);
}

export function formatearMetros(valor) {
  return `${num(valor).toLocaleString('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} m`;
}

export function formatearArea(valor) {
  return `${num(valor).toLocaleString('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} m²`;
}
