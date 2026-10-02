export const defaults = {
  alias: '', holder: '', phone: '', date: '', mechanism: '', optionalPrize: '',
  rules: '', start: 1, numberingConfirmed: false, open: false, reservationHours: 48,
};
export type RaffleConfig = typeof defaults;
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type Reservation = {
  id: string; name: string; phone: string; total: number; status: RequestStatus;
  numbers: string; created: number; expires: number;
};
export type PublicData = {
  config: RaffleConfig; active: boolean;
  tickets: { number: number; status: RequestStatus }[];
};
export const statusLabels: Record<RequestStatus, string> = {
  pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada', expired: 'Vencida',
};
export const MAX_FILE_BYTES = 5_000_000;
export const MAX_BODY_BYTES = 5_100_000;
export const tokenPattern = /^[a-f0-9]{64}$/;
export const idPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function price(count: number) {
  if (count === 1) return 12000;
  if (count === 2) return 20000;
  throw new Error('Elegí uno o dos números.');
}
export function ready(c: RaffleConfig) {
  return Boolean(c.open && c.alias && c.holder && /^\d{8,15}$/.test(c.phone)
    && c.date && c.mechanism && c.optionalPrize && c.rules && c.numberingConfirmed);
}
export function parseConfig(value: unknown): RaffleConfig {
  if (!value || typeof value !== 'object') throw new Error('Configuración inválida.');
  const p = value as Record<string, unknown>;
  const c = { ...defaults };
  for (const field of ['alias', 'holder', 'phone', 'date', 'mechanism', 'optionalPrize', 'rules'] as const) {
    if (typeof p[field] !== 'string') throw new Error('Revisá los datos del sorteo.');
    const limit = ['mechanism', 'optionalPrize', 'rules'].includes(field) ? 2000 : 200;
    c[field] = p[field].trim();
    if (c[field].length > limit) throw new Error('Uno de los campos es demasiado largo.');
  }
  c.phone = c.phone.replace(/\D/g, '');
  if (c.phone && !/^\d{8,15}$/.test(c.phone)) throw new Error('WhatsApp debe incluir país y código de área, con 8 a 15 dígitos.');
  if (p.start !== 0 && p.start !== 1) throw new Error('Numeración inválida.');
  c.start = p.start;
  if (typeof p.numberingConfirmed !== 'boolean' || typeof p.open !== 'boolean') throw new Error('Configuración inválida.');
  c.numberingConfirmed = p.numberingConfirmed;
  c.open = p.open;
  if (!Number.isInteger(p.reservationHours) || Number(p.reservationHours) < 1 || Number(p.reservationHours) > 720)
    throw new Error('El plazo debe ser de 1 a 720 horas.');
  c.reservationHours = Number(p.reservationHours);
  if (c.open && !ready(c)) throw new Error('Completá todos los datos y confirmá la numeración antes de abrir.');
  return c;
}
export function validateParticipant(name: string, phone: string, numbers: unknown, start: number): asserts numbers is number[] {
  if (name.length < 3 || name.length > 100 || !/^\d{8,15}$/.test(phone)
    || !Array.isArray(numbers) || numbers.length < 1 || numbers.length > 2
    || new Set(numbers).size !== numbers.length
    || numbers.some(n => !Number.isInteger(n) || n < start || n > start + 99))
    throw new Error('Revisá tus datos y elegí uno o dos números válidos.');
}
export function detectMime(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((n,i) => bytes[i] === n)) return 'image/png';
  if (new TextDecoder().decode(bytes.slice(0,5)) === '%PDF-') return 'application/pdf';
  return '';
}
export function csvCell(value: unknown) {
  let text = String(value ?? '');
  // Neutralize spreadsheet formulas, including leading spaces/control characters.
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export function money(value: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
}