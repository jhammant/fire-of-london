// Turn to calendar time. Each turn is 6 hours; turn 0 is Sunday 2 September 1666, 1am.

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = [1, 7, 13, 19];

const hourLabelOf = (hour) => (hour < 12 ? `${hour}am` : `${hour - 12}pm`);

/** Returns the day, date and hour for a turn number. */
export function getTimeInfo(turn) {
  if (!Number.isInteger(turn) || turn < 0) throw new Error(`Turn must be a whole number of 0 or more, got ${String(turn)}.`);
  const day = Math.floor(turn / 4);
  const dayName = DAY_NAMES[day % 7];
  const date = 2 + day;
  const hour = HOURS[turn % 4];
  const hourLabel = hourLabelOf(hour);
  return {
    turn,
    dayName,
    date,
    month: 'September',
    year: 1666,
    hour,
    hourLabel,
    label: `${dayName} ${date} September, ${hourLabel}`
  };
}
