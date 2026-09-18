export const WEEK_HOURS = 168;
export const DAY_COUNT = 7;
export const HOUR_MINUTES = 60;
export const DAY_HOURS = 24;
export const DAY_MINUTES = DAY_HOURS * HOUR_MINUTES;
export const WEEK_MINUTES = WEEK_HOURS * HOUR_MINUTES;
export const RING_COUNT = 10;
export const WHEEL_STEP_MINUTES = HOUR_MINUTES;
export const LIST_STEP_DAILY_MINUTES = 10;
export const MAX_HOURS_PER_DAY = 16;
export const MAX_MINUTES_PER_INTEREST = MAX_HOURS_PER_DAY * HOUR_MINUTES;
export const MAX_MINUTES_PER_WEEK_INTEREST = MAX_MINUTES_PER_INTEREST * DAY_COUNT;
export const MINUTES_PER_LEVEL = MAX_MINUTES_PER_INTEREST / RING_COUNT;
export const WEEK_MINUTES_PER_LEVEL = MAX_MINUTES_PER_WEEK_INTEREST / RING_COUNT;
export const MAX_INTERESTS = 12;
export const SLEEP_NORM_MINUTES = 8 * HOUR_MINUTES;
export const SLEEP_MIN_MINUTES = 4 * HOUR_MINUTES;
export const WORK_NORM_MINUTES = SLEEP_NORM_MINUTES;
export const LEGACY_MINUTES_PER_STEP = 67.2;
export const VIEW = 640;
export const CX = VIEW / 2;
export const CY = VIEW / 2;
export const MAX_R = 198;
export const LABEL_R = 278;

export const palette = {
  red: "#c24545",
  yellow: "#d4a017",
  green: "#2a9a6a",
  orange: "#c06028",
  bg: "#f4f0ea",
  paper: "#fffcf7",
  ink: "#1c1a17",
  muted: "#6b6560",
  faint: "#9a938b",
  line: "#d9d2c8",
  stroke: "#3f3a35",
};

export type Interest = {
  id: string;
  name: string;
  locked: boolean;
  minutes: number;
};

export const DAYS = [
  { id: "mon", short: "Пн", workday: true },
  { id: "tue", short: "Вт", workday: true },
  { id: "wed", short: "Ср", workday: true },
  { id: "thu", short: "Чт", workday: true },
  { id: "fri", short: "Пт", workday: true },
  { id: "sat", short: "Сб", workday: false },
  { id: "sun", short: "Вс", workday: false },
] as const;

export type DayId = (typeof DAYS)[number]["id"];
export type WeekPlan = Record<DayId, Interest[]>;

const SPHERE_DEFS: Array<{ id: string; name: string; locked: boolean }> = [
  { id: "sleep", name: "Сон и восстановление", locked: true },
  { id: "work", name: "Работа и карьера", locked: false },
  { id: "family", name: "Семья", locked: false },
  { id: "sport", name: "Здоровье и спорт", locked: false },
  { id: "fun", name: "Развлечения и друзья", locked: false },
  { id: "education", name: "Образование и саморазвитие", locked: false },
  { id: "relations", name: "Отношения", locked: false },
  { id: "craft", name: "Хобби и увлечения", locked: false },
  { id: "home", name: "Быт и уклад жизни", locked: false },
  { id: "money", name: "Финансы и благосостояние", locked: false },
  { id: "mentality", name: "Ментальность и рефлексия", locked: false },
  { id: "rest", name: "Отдых и путешествия", locked: false },
];

function hours(value: number): number {
  return value * HOUR_MINUTES;
}

export function defaultDayInterests(workday: boolean): Interest[] {
  return SPHERE_DEFS.map((def) => ({
    ...def,
    minutes:
      def.id === "sleep"
        ? hours(8)
        : def.id === "work"
          ? workday
            ? hours(8)
            : 0
          : 0,
  }));
}

export function defaultWeek(): WeekPlan {
  return {
    mon: defaultDayInterests(true),
    tue: defaultDayInterests(true),
    wed: defaultDayInterests(true),
    thu: defaultDayInterests(true),
    fri: defaultDayInterests(true),
    sat: defaultDayInterests(false),
    sun: defaultDayInterests(false),
  };
}

export function todayDayId(): DayId {
  const order: DayId[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return order[new Date().getDay()];
}

export function formatMinutes(mins: number): string {
  const total = Math.max(0, Math.round(mins));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (m === 0) return `${h} ч`;
  if (h === 0) return `${m} мин`;
  return `${h} ч ${m} мин`;
}

export function dailyMinutes(weekly: number): number {
  const raw = weekly / DAY_COUNT;
  return Math.round(raw / LIST_STEP_DAILY_MINUTES) * LIST_STEP_DAILY_MINUTES;
}

export function floorFor(item: Interest): number {
  return item.id === "sleep" || item.locked ? SLEEP_MIN_MINUTES : 0;
}

export function levelValue(minutes: number): number {
  return Math.round((minutes / MAX_MINUTES_PER_INTEREST) * RING_COUNT);
}

export function weekLevelValue(minutes: number): number {
  return Math.round((minutes / MAX_MINUTES_PER_WEEK_INTEREST) * RING_COUNT);
}

export function nextWheelMinutes(
  current: number,
  dir: 1 | -1,
  floor: number,
  cap: number,
  room: number,
): number | null {
  if (dir > 0) {
    if (room < WHEEL_STEP_MINUTES || current >= cap) return null;
    const next = current + WHEEL_STEP_MINUTES;
    if (next > cap) return null;
    return next;
  }
  const next = Math.max(floor, current - WHEEL_STEP_MINUTES);
  return next === current ? null : next;
}

export function nextListMinutes(
  current: number,
  dir: 1 | -1,
  floor: number,
  cap: number,
  room: number,
): number | null {
  if (dir > 0) {
    if (room < LIST_STEP_DAILY_MINUTES || current >= cap) return null;
    const next = Math.min(cap, current + LIST_STEP_DAILY_MINUTES);
    if (next - current > room) return null;
    return next;
  }
  const next = Math.max(floor, current - LIST_STEP_DAILY_MINUTES);
  return next === current ? null : next;
}

export function weekUsedMinutes(week: WeekPlan): number {
  return DAYS.reduce(
    (sum, day) =>
      sum + week[day.id].reduce((daySum, item) => daySum + item.minutes, 0),
    0,
  );
}

export function aggregateWeek(week: WeekPlan): Interest[] {
  const map = new Map<string, Interest>();
  for (const day of DAYS) {
    for (const item of week[day.id]) {
      const prev = map.get(item.id);
      if (!prev) {
        map.set(item.id, { ...item });
      } else {
        map.set(item.id, {
          ...prev,
          minutes: prev.minutes + item.minutes,
          locked: prev.locked || item.locked,
        });
      }
    }
  }
  const order = SPHERE_DEFS.map((item) => item.id);
  return [...map.values()].sort((a, b) => {
    const ia = order.indexOf(a.id);
    const ib = order.indexOf(b.id);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a.name.localeCompare(b.name, "ru");
  });
}

export function polar(index: number, count: number, radius: number) {
  const theta = (index / count) * Math.PI * 2;
  return {
    x: CX + radius * Math.sin(theta),
    y: CY - radius * Math.cos(theta),
    theta,
  };
}

export function closedCurve(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }
  if (points.length === 2) {
    const [a, b] = points;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const nx = a.y - b.y;
    const ny = b.x - a.x;
    const len = Math.hypot(nx, ny) || 1;
    const bulge = MAX_R * 0.18;
    const c1 = { x: mx + (nx / len) * bulge, y: my + (ny / len) * bulge };
    const c2 = { x: mx - (nx / len) * bulge, y: my - (ny / len) * bulge };
    return `M ${a.x} ${a.y} Q ${c1.x} ${c1.y} ${b.x} ${b.y} Q ${c2.x} ${c2.y} ${a.x} ${a.y} Z`;
  }
  const n = points.length;
  const at = (i: number) => points[(i + n) % n];
  let d = `M ${at(0).x} ${at(0).y}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`;
  }
  return `${d} Z`;
}

function parseHex(color: string): { r: number; g: number; b: number } | null {
  const raw = color.trim().replace("#", "");
  const rgb = raw.length === 8 || raw.length === 4 ? raw.slice(0, raw.length === 8 ? 6 : 3) : raw;
  const full = rgb.length === 3 ? rgb.split("").map((c) => c + c).join("") : rgb;
  if (full.length < 6) return null;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r, g, b };
}

function mixHex(a: string, b: string, t: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return a;
  const u = Math.min(1, Math.max(0, t));
  const mix = (x: number, y: number) => Math.round(x + (y - x) * u);
  return `rgb(${mix(ca.r, cb.r)}, ${mix(ca.g, cb.g)}, ${mix(ca.b, cb.b)})`;
}

function heatAlong(from: string, mid: string, to: string, t: number): string {
  if (t < 0.5) return mixHex(from, mid, t * 2);
  return mixHex(mid, to, (t - 0.5) * 2);
}

export function colorAtLevel(level: number): string {
  const L = Math.min(RING_COUNT, Math.max(0, level));
  if (L <= 5) return heatAlong(palette.red, palette.yellow, palette.green, L / 5);
  return heatAlong(palette.green, palette.yellow, palette.red, (L - 5) / 5);
}

export function toneForInterest(item: Interest): string {
  return colorAtLevel(item.minutes / MINUTES_PER_LEVEL);
}

export function weekToneForInterest(item: Interest): string {
  return colorAtLevel(item.minutes / WEEK_MINUTES_PER_LEVEL);
}

export function usageTone(interest: Interest): "red" | "orange" | "yellow" | "green" {
  const ring = interest.minutes / MINUTES_PER_LEVEL;
  if (ring <= 2) return "red";
  if (ring < 4.5) return "orange";
  if (ring <= 5.5) return "green";
  if (ring < 8) return "yellow";
  return "red";
}

const NAME_MIGRATIONS: Record<string, string> = {
  Сон: "Сон и восстановление",
  Работа: "Работа и карьера",
  Творчество: "Хобби и увлечения",
  Хобби: "Хобби и увлечения",
  Спорт: "Здоровье и спорт",
  Развлечения: "Развлечения и друзья",
  "Развлечения и отдых": "Развлечения и друзья",
  "Развлечения и путешествия": "Развлечения и друзья",
  Отдых: "Отдых и путешествия",
  "Отдых и друзья": "Отдых и путешествия",
  Образование: "Образование и саморазвитие",
  Финансы: "Финансы и благосостояние",
  Быт: "Быт и уклад жизни",
  Ментальность: "Ментальность и рефлексия",
};

export function migrateInterest(item: {
  id: string;
  name: string;
  locked: boolean;
  minutes?: number;
  steps?: number;
}): Interest {
  let minutes =
    typeof item.minutes === "number"
      ? item.minutes
      : Math.round((item.steps ?? 0) * LEGACY_MINUTES_PER_STEP);
  if (minutes % 10 !== 0) {
    minutes = Math.round(minutes / HOUR_MINUTES) * HOUR_MINUTES;
  }
  let id = item.id;
  let name = item.name;
  if (id === "spirit" || name === "Духовность") {
    id = "mentality";
    name = "Ментальность и рефлексия";
  }
  if (NAME_MIGRATIONS[name]) name = NAME_MIGRATIONS[name];
  return { id, name, locked: item.locked, minutes };
}

export function isInterestArray(value: unknown): value is Array<{
  id: string;
  name: string;
  locked: boolean;
  minutes?: number;
  steps?: number;
}> {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.locked === "boolean" &&
        (typeof (item as { minutes?: unknown }).minutes === "number" ||
          typeof (item as { steps?: unknown }).steps === "number"),
    )
  );
}

export function isWeekPlan(value: unknown): value is WeekPlan {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return DAYS.every((day) => isInterestArray(record[day.id]));
}
