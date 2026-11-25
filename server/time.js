// Times are 'HH:MM' strings (24h), so plain string comparison orders them correctly.

// Is `t` inside [start, end]? A window with start after end crosses midnight (e.g. 22:00-02:00).
export const inWindow = (t, start, end) => (start <= end ? t >= start && t <= end : t >= start || t <= end)

// '06:00' -> '6:00 AM'
export const ampm = (t) => {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
