// Utilidades de formato y generación de identificadores.

const LOCALE = 'es-CO';

/** 1500000 -> "$1.500.000" */
export function formatCOP(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '$0';
  return `$${numero.toLocaleString(LOCALE, { maximumFractionDigits: 0 })}`;
}

/** 1500000 -> "1.500.000" (para inputs de dinero) */
export function formatMiles(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '';
  return numero.toLocaleString(LOCALE, { maximumFractionDigits: 0 });
}

/** "1.500.000" -> 1500000 */
export function parseCOP(texto) {
  const limpio = String(texto ?? '').replace(/[^\d]/g, '');
  return limpio ? parseInt(limpio, 10) : 0;
}

/** "1.500.000" -> "1.500.000" (mientras el usuario escribe) */
export function soloDigitos(texto) {
  return String(texto ?? '').replace(/[^\d]/g, '');
}

export function formatFecha(valor) {
  if (!valor) return '—';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleDateString(LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatFechaHora(valor) {
  if (!valor) return '—';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleString(LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Código legible para una orden nueva: "OT-LX3K9-A1B2". */
export function nuevoCodigoOrden() {
  const marca = Date.now().toString(36).slice(-5).toUpperCase();
  const azar = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `OT-${marca}-${azar}`;
}

/**
 * UUID v4 con respaldo para contextos no seguros (HTTP en red local),
 * donde `crypto.randomUUID` no está disponible.
 */
export function nuevoId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // cae al respaldo
    }
  }
  const aleatorio = () =>
    Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .slice(1);
  return `${aleatorio()}${aleatorio()}-${aleatorio()}-4${aleatorio().slice(1)}-a${aleatorio().slice(1)}-${aleatorio()}${aleatorio()}${aleatorio()}`;
}
