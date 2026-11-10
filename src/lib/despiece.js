// ============================================================================
// Motor de despiece
// ----------------------------------------------------------------------------
// A partir de las medidas de cada ítem de la orden y de la receta configurada
// en el sistema, calcula:
//   · medidas de corte de cada perfil (con descuentos, divisores y ángulos),
//   · qué piezas caben en los retales que hay en producción,
//   · cuántas barras nuevas de 595 cm se necesitan,
//   · medidas exactas de cada vidrio,
//   · accesorios, empaques y cantidades,
//   · costo estimado de materiales.
// No accede a Supabase: recibe los datos ya cargados para poder probarse y
// reutilizarse en la vista previa, en el guardado de la orden y en la orden de
// producción imprimible.
// ============================================================================

import { FORMULAS_CORTE, TIPOS_PIEZA } from './constants';

export const LARGO_BARRA_DEFECTO_CM = 595;

const num = (valor, defecto = 0) => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : defecto;
};

const redondear = (valor, decimales = 1) => {
  const factor = 10 ** decimales;
  return Math.round((num(valor) + Number.EPSILON) * factor) / factor;
};

const limite = (valor) => Math.max(0, num(valor));

const normalizarTexto = (valor) =>
  String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const esCategoriaVidrio = (categoria = '') =>
  /vidrio|cristal|espejo/i.test(String(categoria));

const esCategoriaPerfil = (categoria = '') =>
  /perfil|aluminio|pvc|acrílico|acrilico/i.test(String(categoria));

const esUnidadBarra = (unidad = '') => /barra/i.test(String(unidad));

// Colores/acabados que sí distinguen un vidrio de otro en el taller.
// "Claro", "templado" y "laminado" se tratan como base y no como color.
const ACABADOS_VIDRIO = ['bronce', 'gris', 'esmerilado', 'espejo', 'acrilico'];

/**
 * Texto con el vidrio que pide el proyecto: "Vidrio bronce · 4 mm".
 * Acepta tanto los nombres de la orden (vidrio_tipo) como los del despiece
 * (vidrioTipo).
 */
export function describirVidrioSolicitado(item = {}) {
  const tipo = String(item?.vidrioTipo ?? item?.vidrio_tipo ?? '').trim();
  const espesor = String(item?.vidrioEspesor ?? item?.vidrio_espesor ?? '').trim();
  return [tipo, espesor].filter(Boolean).join(' · ');
}

/**
 * Compara el vidrio de la receta con el que pide el proyecto.
 * Devuelve false cuando el espesor o el color no coinciden, para que la
 * orden de producción avise antes de cortar el vidrio equivocado.
 */
export function vidrioCoincideConReceta(nombreReceta, item = {}) {
  const tipo = String(item?.vidrioTipo ?? item?.vidrio_tipo ?? '');
  const espesor = String(item?.vidrioEspesor ?? item?.vidrio_espesor ?? '');

  if (!tipo && !espesor) return true;
  if (/sin\s+vidrio/i.test(tipo)) return true;

  const receta = normalizarTexto(nombreReceta).replace(/\s+/g, '');
  if (!receta) return true;

  const espesorPedido = normalizarTexto(espesor).replace(/\s+/g, '');
  if (espesorPedido && !receta.includes(espesorPedido)) return false;

  const tipoNormalizado = normalizarTexto(tipo);
  const acabadoPedido = ACABADOS_VIDRIO.find((acabado) => tipoNormalizado.includes(acabado));
  if (acabadoPedido && !receta.includes(acabadoPedido)) return false;

  return true;
}

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

/**
 * Devuelve la configuración de fórmula de una línea de receta.
 *
 * Las recetas nuevas guardan `formula_config` con:
 *   { base, restarCm, dividir, referencia, angulo }
 * Las recetas antiguas siguen funcionando con `formula_largo` + `descuento_mm`.
 */
export function configuracionFormula(linea = {}) {
  const crudo = linea.formula_config ?? linea.formulaConfig ?? null;
  const tieneConfig =
    crudo &&
    typeof crudo === 'object' &&
    (crudo.base ||
      crudo.restarCm != null ||
      crudo.restar_cm != null ||
      crudo.dividir != null ||
      crudo.divisor != null ||
      crudo.referencia);

  if (!tieneConfig) {
    return {
      avanzada: false,
      base: linea.formula_largo || linea.formula || 'fijo',
      restarCm: 0,
      dividir: 1,
      referencia: '',
      angulo: num(linea.angulo_corte ?? linea.anguloCorte),
    };
  }

  return {
    avanzada: true,
    base: crudo.base || 'ancho',
    restarCm: Math.max(0, num(crudo.restarCm ?? crudo.restar_cm)),
    dividir: Math.max(1, num(crudo.dividir ?? crudo.divisor, 1) || 1),
    referencia: String(crudo.referencia || '').trim(),
    angulo: num(crudo.angulo ?? linea.angulo_corte ?? linea.anguloCorte),
  };
}

/** Texto legible de la fórmula configurada, para tablas y fichas. */
export function describirFormula(formula, config) {
  if (!config || !config.avanzada) return etiquetaFormula(formula);

  let texto =
    config.base === 'referencia'
      ? `Medida de ${config.referencia || 'otra pieza'}`
      : etiquetaFormula(config.base);

  if (config.restarCm) texto += ` − ${config.restarCm} cm`;
  if (config.dividir > 1) texto = `(${texto}) ÷ ${config.dividir}`;
  if (config.angulo) texto += ` · ${config.angulo}°`;

  return texto;
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

  const config = configuracionFormula(linea);

  return {
    materialId: material.id || linea.material_id || linea.id,
    materialKey: String(
      material.id || linea.material_id || linea.id || normalizarTexto(material.nombre || linea.material_nombre),
    ),
    nombre: material.nombre || linea.material_nombre || 'Material sin nombre',
    codigo: material.codigo_referencia || linea.codigo_referencia || '',
    categoria,
    unidad: material.unidad_medida || linea.unidad_medida || 'Unidad',
    precio: num(material.precio_venta ?? linea.precio_venta),
    tipoPieza,
    esVidrio: Boolean(linea.es_vidrio) || tipoPieza === 'vidrio' || esCategoriaVidrio(categoria),
    formula: linea.formula_largo || (tipoPieza === 'perfil' ? 'perimetro' : 'fijo'),
    config,
    formulaTexto: describirFormula(linea.formula_largo || '', config),
    descuentoMm: num(linea.descuento_mm),
    merma: num(linea.merma_porcentaje),
    cantidadReceta: num(linea.cantidad_requerida, 1) || 1,
  };
}

/**
 * Calcula el largo de corte de una pieza.
 * En fórmulas avanzadas el descuento se resta antes de dividir:
 *   horizontal = (ancho − 2.8) ÷ 4
 */
function largoCorteDeFormula(config, anchoCm, altoCm, referenciaCm, descuentoMm) {
  let baseCm;

  if (config.avanzada && config.base === 'referencia') {
    baseCm = num(referenciaCm);
  } else {
    baseCm = largoBaseCm(config.base, anchoCm, altoCm);
  }

  const restarCm = config.avanzada ? config.restarCm : 0;
  const divisor = config.avanzada ? config.dividir : 1;
  const descuento = num(descuentoMm) / 10;

  return limite((baseCm - restarCm - descuento) / Math.max(1, divisor));
}

function compatibilidadColor(colorRetal, colorPieza) {
  const a = normalizarTexto(colorRetal);
  const b = normalizarTexto(colorPieza);
  if (!a || !b) return true;
  if (a === 'sin definir' || b === 'sin definir') return true;
  return a === b;
}

function compatibilidadMaterial(retal, pieza) {
  const idRetal = retal.material_id ?? retal.materialId;
  if (idRetal && pieza.materialId && String(idRetal) === String(pieza.materialId)) return true;

  const nombreRetal = normalizarTexto(
    retal.material_nombre || retal.materialNombre || retal.nombre || '',
  );
  const nombrePieza = normalizarTexto(pieza.nombre);
  if (!nombreRetal || !nombrePieza) return false;

  return (
    nombreRetal === nombrePieza ||
    nombreRetal.includes(nombrePieza) ||
    nombrePieza.includes(nombreRetal)
  );
}

function expandirRetales(retales = []) {
  const instancias = [];

  retales.forEach((retal) => {
    if (retal.disponible === false) return;
    const largo = num(retal.largo_cm ?? retal.largoCm);
    if (largo <= 0) return;

    const cantidad = Math.max(1, Math.round(num(retal.cantidad, 1)));
    for (let i = 0; i < cantidad; i += 1) {
      instancias.push({
        ...retal,
        largo_cm: largo,
        _instancia: i,
        _restante: largo,
        _usadas: [],
      });
    }
  });

  return instancias;
}

function nombreRetal(retal) {
  const base =
    retal.codigo ||
    retal.material_nombre ||
    retal.materialNombre ||
    retal.nombre ||
    'Retal';
  const cantidad = Math.max(1, Math.round(num(retal.cantidad, 1)));
  return cantidad > 1 ? `${base} #${retal._instancia + 1}` : base;
}

/**
 * Reparte las piezas entre retales existentes y barras nuevas.
 * Estrategia: primero el retal más pequeño donde quepa (best fit) y luego
 * barras de 595 cm con first-fit decreasing.
 */
function optimizarRetales(piezas = [], retales = [], largoBarraDefecto = LARGO_BARRA_DEFECTO_CM) {
  const grupos = new Map();

  piezas.forEach((pieza) => {
    const clave = `${pieza.materialKey}|${normalizarTexto(pieza.color)}|${pieza.largoBarraCm}`;
    if (!grupos.has(clave)) {
      grupos.set(clave, {
        clave,
        materialKey: pieza.materialKey,
        materialId: pieza.materialId,
        nombre: pieza.nombre,
        color: pieza.color,
        largoBarraCm: pieza.largoBarraCm || largoBarraDefecto,
        precio: pieza.precio,
        unidadBarra: pieza.unidadBarra,
        piezas: [],
      });
    }
    grupos.get(clave).piezas.push(pieza);
  });

  const pool = expandirRetales(retales);
  const barrasGrupos = [];

  grupos.forEach((grupo) => {
    const compatibles = pool.filter(
      (retal) =>
        compatibilidadColor(retal.color, grupo.color) &&
        compatibilidadMaterial(retal, {
          materialId: grupo.materialId,
          nombre: grupo.nombre,
        }),
    );

    const ordenadas = [...grupo.piezas].sort((a, b) => b.largoCm - a.largoCm);
    const pendientes = [];

    ordenadas.forEach((pieza) => {
      let mejor = null;
      compatibles.forEach((retal) => {
        if (retal._restante + 0.0001 < pieza.largoCm) return;
        if (!mejor || retal._restante < mejor._restante) mejor = retal;
      });

      if (!mejor) {
        pendientes.push(pieza);
        return;
      }

      mejor._restante = Math.max(0, mejor._restante - pieza.largoCm);
      mejor._usadas.push(pieza);
      pieza.fuente = 'retal';
      pieza.retalId = mejor.id;
      pieza.retalCodigo = nombreRetal(mejor);
      pieza.retalLargoCm = redondear(mejor.largo_cm);
      pieza.retalSobranteCm = redondear(mejor._restante);
      pieza.retalUbicacion = mejor.ubicacion || '';
    });

    const barras = [];
    pendientes.forEach((pieza) => {
      let barra = barras.find((fila) => fila._restante + 0.0001 >= pieza.largoCm);
      if (!barra) {
        barra = {
          numero: barras.length + 1,
          _restante: grupo.largoBarraCm,
          piezas: [],
        };
        barras.push(barra);
      }

      barra._restante = Math.max(0, barra._restante - pieza.largoCm);
      barra.piezas.push(pieza);
      pieza.fuente = 'barra';
      pieza.barraNumero = barra.numero;
    });

    if (ordenadas.length > 0) {
      barrasGrupos.push({
        clave: grupo.clave,
        materialKey: grupo.materialKey,
        materialId: grupo.materialId,
        nombre: grupo.nombre,
        color: grupo.color,
        largoBarraCm: grupo.largoBarraCm,
        precio: grupo.precio,
        unidadBarra: grupo.unidadBarra,
        barras: barras.length,
        piezas: pendientes.length,
        piezasRetal: ordenadas.length - pendientes.length,
        sobranteCm: redondear(
          barras.reduce((total, barra) => total + barra._restante, 0),
        ),
      });
    }
  });

  const retalesUsados = pool
    .filter((retal) => retal._usadas.length > 0)
    .map((retal) => ({
      retalId: retal.id,
      codigo: nombreRetal(retal),
      material: retal.material_nombre || retal.materialNombre || retal.nombre || 'Retal',
      materialId: retal.material_id || retal.materialId || null,
      color: retal.color || 'Sin definir',
      largoCm: redondear(retal.largo_cm),
      sobranteCm: redondear(retal._restante),
      aprovechamiento: redondear(
        ((retal.largo_cm - retal._restante) / retal.largo_cm) * 100,
        0,
      ),
      piezas: retal._usadas.length,
      detallePiezas: retal._usadas.map((pieza) => ({
        descripcion: pieza.descripcion,
        material: pieza.nombre,
        largoCm: redondear(pieza.largoCm),
        angulo: pieza.angulo,
      })),
      ubicacion: retal.ubicacion || '',
    }));

  return {
    barrasGrupos,
    barrasNuevas: barrasGrupos.filter((grupo) => grupo.barras > 0),
    retalesUsados,
    piezasRetal: pool.reduce((total, retal) => total + retal._usadas.length, 0),
    piezasBarra: barrasGrupos.reduce((total, grupo) => total + grupo.piezas, 0),
  };
}

/**
 * Calcula el despiece de una orden.
 *
 * @param {Array} items  Ítems de la orden: { id, sistema_id, sistemaId, descripcion,
 *                       ancho_cm, alto_cm, cantidad, tipo_trabajo, vidrio_tipo,
 *                       vidrio_espesor, color }
 * @param {Array} sistemas Sistemas con su receta: { id, nombre, largo_barra_cm,
 *                       descuento_vidrio_ancho_mm, descuento_vidrio_alto_mm,
 *                       merma_porcentaje, materiales: [...] }
 * @param {Object} opciones { retales, largoBarraCm }
 */
export function generarDespiece(items = [], sistemas = [], opciones = {}) {
  const mapaSistemas = new Map();
  sistemas.forEach((sistema) => mapaSistemas.set(String(sistema.id), sistema));

  const retales = Array.isArray(opciones.retales) ? opciones.retales : [];
  const largoBarraDefecto =
    num(opciones.largoBarraCm, LARGO_BARRA_DEFECTO_CM) || LARGO_BARRA_DEFECTO_CM;

  const advertencias = [];
  const itemsCalculados = [];
  const lineasGlobales = [];
  const todasLasPiezas = [];
  const resumenMapa = new Map();

  const agregarResumen = (linea) => {
    const clave = String(linea.materialId || linea.nombre);
    const actual = resumenMapa.get(clave) || {
      materialId: linea.materialId,
      materialKey: linea.materialKey,
      nombre: linea.nombre,
      codigo: linea.codigo,
      unidad: linea.unidad,
      tipoPieza: linea.tipoPieza,
      cantidad: 0,
      totalMetros: 0,
      areaM2: 0,
      barras: 0,
      piezasRetal: 0,
      piezasBarra: 0,
      costo: 0,
    };

    actual.cantidad += linea.cantidad;
    actual.totalMetros += linea.totalMetros || 0;
    actual.areaM2 += linea.areaM2 || 0;
    actual.barras += linea.barras || 0;
    actual.piezasRetal += linea.piezasRetal || 0;
    actual.piezasBarra += linea.piezasBarra || 0;
    actual.costo += linea.costo || 0;
    resumenMapa.set(clave, actual);
  };

  (items || []).forEach((item, indice) => {
    const sistemaId = item.sistema_id || item.sistemaId;
    const sistema = mapaSistemas.get(String(sistemaId));
    const anchoCm = num(item.ancho_cm ?? item.anchoCm);
    const altoCm = num(item.alto_cm ?? item.altoCm);
    const cantidadItem = Math.max(1, Math.round(num(item.cantidad, 1)));
    const color = item.color || 'Sin definir';
    const largoBarraCm =
      num(sistema?.largo_barra_cm ?? sistema?.largoBarraCm, largoBarraDefecto) ||
      largoBarraDefecto;

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

    // ------------------------------------------------------------------
    // 1) Preparar las líneas de perfil y resolver fórmulas con referencia
    //    (ej. barra toallera = medida de PV17 ancho − 9 cm).
    // ------------------------------------------------------------------
    const lineasReceta = receta.map((linea, lineIndex) => {
      const material = datosMaterial(linea);
      return {
        lineIndex,
        linea,
        material,
        key: `${indice}-${lineIndex}`,
        largoCorteCm: null,
      };
    });

    const buscarReferencia = (linea, texto) => {
      const objetivo = normalizarTexto(texto);
      if (!objetivo) return null;
      return lineasReceta.find((candidata) => {
        if (candidata === linea) return false;
        const nombre = normalizarTexto(candidata.material.nombre);
        return (
          nombre === objetivo ||
          nombre.includes(objetivo) ||
          objetivo.includes(nombre)
        );
      });
    };

    lineasReceta.forEach((fila) => {
      if (fila.material.tipoPieza !== 'perfil') return;
      if (fila.material.config.avanzada && fila.material.config.base === 'referencia') return;

      fila.largoCorteCm = largoCorteDeFormula(
        fila.material.config,
        anchoCm,
        altoCm,
        null,
        fila.material.descuentoMm,
      );
    });

    for (let intento = 0; intento < 4; intento += 1) {
      let pendientes = false;

      lineasReceta.forEach((fila) => {
        if (fila.material.tipoPieza !== 'perfil') return;
        if (fila.largoCorteCm != null) return;
        if (!fila.material.config.avanzada || fila.material.config.base !== 'referencia') return;

        const referencia = buscarReferencia(fila, fila.material.config.referencia);
        if (!referencia || referencia.largoCorteCm == null) {
          pendientes = true;
          return;
        }

        fila.largoCorteCm = largoCorteDeFormula(
          fila.material.config,
          anchoCm,
          altoCm,
          referencia.largoCorteCm,
          fila.material.descuentoMm,
        );
      });

      if (!pendientes) break;
    }

    lineasReceta.forEach((fila) => {
      if (fila.material.tipoPieza !== 'perfil') return;
      if (fila.largoCorteCm != null) return;

      advertencias.push(
        `${descripcion} · ${fila.material.nombre}: no se encontró la pieza de referencia “${
          fila.material.config.referencia || 'sin nombre'
        }”. Se toma el ancho del vano.`,
      );
      fila.largoCorteCm = largoCorteDeFormula(
        { ...fila.material.config, base: 'ancho', referencia: '' },
        anchoCm,
        altoCm,
        null,
        fila.material.descuentoMm,
      );
    });

    // ------------------------------------------------------------------
    // 2) Construir cortes, vidrios y accesorios del ítem.
    // ------------------------------------------------------------------
    lineasReceta.forEach((fila) => {
      const material = fila.material;
      const merma = material.merma || mermaSistema;

      if (material.esVidrio) {
        const anchoMm = limite(anchoCm * 10 - descVidrioAncho - material.descuentoMm);
        const altoMm = limite(altoCm * 10 - descVidrioAlto - material.descuentoMm);
        const piezas = Math.max(1, Math.round(material.cantidadReceta)) * cantidadItem;
        const areaUnidad = (anchoMm / 1000) * (altoMm / 1000);
        const areaM2 = areaUnidad * piezas * (1 + merma / 100);
        const costo = areaM2 * material.precio;

        const registro = {
          materialId: material.materialId,
          materialKey: material.materialKey,
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
          solicitado: describirVidrioSolicitado(item),
          difiereReceta: !vidrioCoincideConReceta(material.nombre, item),
        };

        vidrios.push(registro);
        agregarResumen(registro);
        costoItem += costo;
        return;
      }

      if (material.tipoPieza === 'perfil') {
        const piezas = Math.max(1, Math.round(material.cantidadReceta)) * cantidadItem;
        const largoCorteCm = redondear(fila.largoCorteCm, 1);

        if (largoCorteCm <= 0) {
          advertencias.push(
            `${descripcion} · ${material.nombre}: la medida de corte da 0 cm. Revisa la fórmula.`,
          );
        }
        if (largoCorteCm > largoBarraCm) {
          advertencias.push(
            `${descripcion} · ${material.nombre}: la pieza mide ${formatearCm(
              largoCorteCm,
            )} y supera la barra de ${formatearCm(largoBarraCm, 0)}.`,
          );
        }

        const totalMetros = (largoCorteCm / 100) * piezas * (1 + merma / 100);
        const unidadBarra = esUnidadBarra(material.unidad);
        const barrasLinea = unidadBarra
          ? Math.ceil(totalMetros / (largoBarraCm / 100))
          : 0;
        const costo = unidadBarra
          ? barrasLinea * material.precio
          : totalMetros * material.precio;

        const registro = {
          lineKey: `${indice}-${fila.lineIndex}`,
          materialId: material.materialId,
          materialKey: material.materialKey,
          nombre: material.nombre,
          codigo: material.codigo,
          tipoPieza: 'perfil',
          formula: material.formula,
          formulaConfig: material.config,
          formulaTexto: material.formulaTexto,
          anguloCorte: material.config.angulo || 0,
          unidad: unidadBarra ? `barra ${redondear(largoBarraCm, 0)} cm` : material.unidad,
          precio: material.precio,
          unidadBarra,
          cantidad: redondear(piezas, 2),
          largoCorteCm,
          totalMetros: redondear(totalMetros, 2),
          barras: barrasLinea,
          barrasNuevas: 0,
          piezasRetal: 0,
          piezasBarra: 0,
          retalCodigos: [],
          merma,
          costo: redondear(costo, 0),
          color,
          largoBarraCm,
        };

        cortes.push(registro);
        lineasGlobales.push(registro);
        agregarResumen(registro);
        costoItem += costo;

        for (let i = 0; i < piezas; i += 1) {
          todasLasPiezas.push({
            key: `${indice}-${fila.lineIndex}-${i}`,
            lineKey: registro.lineKey,
            itemIndice: indice,
            itemId: item.id,
            itemDescripcion: descripcion,
            materialId: material.materialId,
            materialKey: material.materialKey,
            nombre: material.nombre,
            color,
            largoCm: largoCorteCm,
            angulo: material.config.angulo || 0,
            largoBarraCm,
            precio: material.precio,
            unidadBarra,
            formulaTexto: material.formulaTexto,
          });
        }

        return;
      }

      // Accesorios, empaques y sellantes: cantidad directa.
      const cantidad = material.cantidadReceta * cantidadItem;
      const costo = cantidad * material.precio;
      const registro = {
        materialId: material.materialId,
        materialKey: material.materialKey,
        nombre: material.nombre,
        codigo: material.codigo,
        tipoPieza: material.tipoPieza,
        unidad: material.unidad,
        cantidad: redondear(cantidad, 2),
        costo: redondear(costo, 0),
      };

      accesorios.push(registro);
      agregarResumen(registro);
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
      color,
      largoBarraCm,
      cortes,
      vidrios,
      accesorios,
      costo: redondear(costoItem, 0),
    });
  });

  // --------------------------------------------------------------------
  // 3) Repartir las piezas entre retales y barras de 595 cm.
  // --------------------------------------------------------------------
  const optimizacion = optimizarRetales(todasLasPiezas, retales, largoBarraDefecto);

  const piezasPorLinea = new Map();
  todasLasPiezas.forEach((pieza) => {
    if (!piezasPorLinea.has(pieza.lineKey)) piezasPorLinea.set(pieza.lineKey, []);
    piezasPorLinea.get(pieza.lineKey).push(pieza);
  });

  const barrasPorMaterial = new Map();
  optimizacion.barrasGrupos.forEach((grupo) => {
    const actual = barrasPorMaterial.get(grupo.materialKey) || {
      barras: 0,
      piezasRetal: 0,
      piezasBarra: 0,
    };
    actual.barras += grupo.barras;
    actual.piezasRetal += grupo.piezasRetal;
    actual.piezasBarra += grupo.piezas;
    barrasPorMaterial.set(grupo.materialKey, actual);
  });

  lineasGlobales.forEach((linea) => {
    const piezas = piezasPorLinea.get(linea.lineKey) || [];
    const barras = barrasPorMaterial.get(linea.materialKey) || {
      barras: 0,
      piezasRetal: linea.piezasRetal || 0,
      piezasBarra: linea.piezasBarra || 0,
    };

    linea.piezasRetal = barras.piezasRetal;
    linea.piezasBarra = barras.piezasBarra;
    linea.barrasNuevas = barras.barras;
    linea.barras = barras.barras;
    linea.retalCodigos = [
      ...new Set(
        piezas
          .filter((pieza) => pieza.fuente === 'retal' && pieza.retalCodigo)
          .map((pieza) => pieza.retalCodigo),
      ),
    ];
  });

  const resumen = [...resumenMapa.values()].map((linea) => {
    const barras = barrasPorMaterial.get(linea.materialKey) || {
      barras: 0,
      piezasRetal: linea.piezasRetal,
      piezasBarra: linea.piezasBarra,
    };

    return {
      ...linea,
      barras: barras.barras,
      piezasRetal: barras.piezasRetal,
      piezasBarra: barras.piezasBarra,
      cantidad: redondear(linea.cantidad, 2),
      totalMetros: redondear(linea.totalMetros, 2),
      areaM2: redondear(linea.areaM2, 2),
      costo: redondear(linea.costo, 0),
    };
  });

  // Costo de compra: las piezas que salen de retales no se compran de nuevo.
  // Los perfiles solo cuentan por las barras nuevas presupuestadas.
  let costoCompra = 0;

  resumen.forEach((linea) => {
    if (linea.tipoPieza !== 'perfil') costoCompra += linea.costo;
  });

  costoCompra += optimizacion.barrasGrupos.reduce(
    (total, grupo) => total + grupo.barras * grupo.precio,
    0,
  );

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

  const largoBarraCm = itemsCalculados[0]?.largoBarraCm || largoBarraDefecto;

  return {
    generadoEn: new Date().toISOString(),
    largoBarraCm,
    items: itemsCalculados,
    resumen,
    retalesUsados: optimizacion.retalesUsados,
    barrasNuevas: optimizacion.barrasNuevas,
    totales: {
      metrosPerfil: redondear(totales.metrosPerfil, 2),
      barras: totales.barras,
      areaVidrio: redondear(totales.areaVidrio, 2),
      costo: redondear(totales.costo, 0),
      costoCompra: redondear(costoCompra, 0),
      materiales: totales.materiales,
      items: itemsCalculados.length,
      piezas: itemsCalculados.reduce((total, item) => total + item.cantidad, 0),
      piezasRetal: optimizacion.piezasRetal,
      piezasBarra: optimizacion.piezasBarra,
      retalesUsados: optimizacion.retalesUsados.length,
      largoBarraCm,
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
