type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  startsAt: Date;
  url: string;
};

function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

/** RFC 5545 lines are limited to 75 UTF-8 octets, not 75 JS characters. */
function foldLine(value: string) {
  const lines: string[] = [];
  let line = "", bytes = 0;
  const encoder = new TextEncoder();
  for (const char of value) {
    const size = encoder.encode(char).length;
    if (bytes + size > 75) { lines.push(line); line = " "; bytes = 1; }
    line += char;
    bytes += size;
  }
  lines.push(line);
  return lines.join("\r\n");
}

const timestamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

export function createCalendar(event: CalendarEvent, now = new Date()) {
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Literator//Events//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${event.id}@literator`, `DTSTAMP:${timestamp(now)}`, `DTSTART:${timestamp(event.startsAt)}`,
    `SUMMARY:${escapeText(event.title)}`, `DESCRIPTION:${escapeText(event.description)}`,
    `LOCATION:${escapeText(event.location)}`, `URL:${event.url}`, "END:VEVENT", "END:VCALENDAR",
  ].map(foldLine).join("\r\n") + "\r\n";
}
