/** Zeitangaben als `m:ss` beziehungsweise `h:mm:ss`. */
export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  const paddedSeconds = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return `${String(hours)}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`;
  }
  return `${String(minutes)}:${paddedSeconds}`;
}

/** Kalendertag `YYYY-MM-DD` in lesbarer Form. */
export function formatDay(day: string, locale: string): string {
  const [year, month, date] = day.split('-').map((part) => Number.parseInt(part, 10));
  const value = new Date(year ?? 1970, (month ?? 1) - 1, date ?? 1);
  return value.toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' });
}
