const ZONA_HORARIA = 'America/Bogota';

const HORARIO_POR_DIA = {
  Mon: { inicio: 8 * 60, fin: 18 * 60 },
  Tue: { inicio: 8 * 60, fin: 18 * 60 },
  Wed: { inicio: 8 * 60, fin: 18 * 60 },
  Thu: { inicio: 8 * 60, fin: 18 * 60 },
  Fri: { inicio: 8 * 60, fin: 18 * 60 },
  Sat: { inicio: 8 * 60, fin: 14 * 60 },
};

export function dentroDelHorarioLaboral(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_HORARIA,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(fecha);
  const valores = Object.fromEntries(partes.map(({ type, value }) => [type, value]));
  const horario = HORARIO_POR_DIA[valores.weekday];

  if (!horario) return false;

  const minutos = Number(valores.hour) * 60 + Number(valores.minute);
  return minutos >= horario.inicio && minutos < horario.fin;
}
