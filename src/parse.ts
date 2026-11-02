/** Values returned to a calendar host after a successful JSON import. */
export type CalendarEvent = {
  externalId: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
};

const MAX_FILE_BYTES = 1_000_000;
const MAX_EVENTS = 1_000;
const ISO_WITH_ZONE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Require an explicit offset and reject calendar dates silently normalized by Date.parse. */
function validInstant(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = ISO_WITH_ZONE.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zone] = match;
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  const hour = Number(hourText), minute = Number(minuteText), second = Number(secondText);
  if (year < 1000 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > days[month - 1]) return false;
  if (zone !== 'Z' && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4, 6)) > 59)) return false;
  return Number.isFinite(Date.parse(value));
}

/** Parse and validate an entire upload before replacing any saved events. */
export function parseCalendarJson(text: string): CalendarEvent[] {
  if (new TextEncoder().encode(text).byteLength > MAX_FILE_BYTES) throw new Error('The JSON file is too large. The limit is 1 MB.');
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('Choose a file containing valid JSON.'); }
  const values = Array.isArray(parsed) ? parsed : isRecord(parsed) ? parsed.events : undefined;
  if (!Array.isArray(values)) throw new Error('The file must contain an array of events, or an object with an events array.');
  if (values.length > MAX_EVENTS) throw new Error('The file may contain at most 1,000 events.');
  const ids = new Set<string>();
  return values.map((value, index) => {
    const prefix = `Event ${index + 1}`;
    if (!isRecord(value)) throw new Error(`${prefix} must be an object.`);
    if (typeof value.id !== 'string' || !value.id.trim() || value.id.length > 300) throw new Error(`${prefix} needs an id of at most 300 characters.`);
    if (ids.has(value.id)) throw new Error(`${prefix} has a duplicate id.`);
    ids.add(value.id);
    if (typeof value.title !== 'string' || !value.title.trim() || value.title.length > 500) throw new Error(`${prefix} needs a title of at most 500 characters.`);
    if (!validInstant(value.start) || !validInstant(value.end)) throw new Error(`${prefix} needs valid ISO dates with a timezone offset.`);
    if (Date.parse(value.end) <= Date.parse(value.start)) throw new Error(`${prefix} must end after it starts.`);
    if (value.allDay !== undefined && typeof value.allDay !== 'boolean') throw new Error(`${prefix}: allDay must be true or false.`);
    return { externalId: value.id, title: value.title, start: value.start, end: value.end, allDay: value.allDay === true };
  });
}
