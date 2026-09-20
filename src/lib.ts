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
  { id: "sleep", name: "Сон", locked: true },
  { id: "work", name: "Работа", locked: false },
  { id: "family", name: "Семья", locked: false },
  { id: "sport", name: "Здоровье", locked: false },
  { id: "fun", name: "Развлечения", locked: false },
  { id: "education", name: "Образование", locked: false },
  { id: "relations", name: "Отношения", locked: false },
  { id: "craft", name: "Увлечения", locked: false },
  { id: "home", name: "Быт", locked: false },
  { id: "money", name: "Финансы", locked: false },
  { id: "mentality", name: "Рефлексия", locked: false },
  { id: "rest", name: "Фрустрация", locked: false },
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

export type DateKey = string;

export type TimerRun = {
  startedAt: number;
  endedAt: number;
};

export type RunningTimer = {
  interestId: string;
  dateKey: DateKey;
  accumulatedMs: number;
  runningSince: number | null;
  runs: TimerRun[];
};

export type AppPersist = {
  feelWeek: WeekPlan;
  actualByDate: Record<DateKey, Interest[]>;
  runningTimer: RunningTimer | null;
  feelConfirmed: boolean;
  feelSkipped: boolean;
  introSeen: boolean;
};

export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function toDateKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayDateKey(): DateKey {
  return toDateKey(new Date());
}

export function parseDateKey(dateKey: DateKey): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function dayIdFromDate(date: Date): DayId {
  const order: DayId[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return order[date.getDay()];
}

export function todayDayId(): DayId {
  return dayIdFromDate(new Date());
}

export function dateKeyToDayId(dateKey: DateKey): DayId {
  return dayIdFromDate(parseDateKey(dateKey));
}

export function weekDateKeys(anchor = new Date()): DateKey[] {
  const day = anchor.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(monday);
    next.setDate(monday.getDate() + index);
    return toDateKey(next);
  });
}

export function formatDateTitle(dateKey: DateKey): string {
  const text = parseDateKey(dateKey).toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) return `${hours}:${pad2(minutes)}:${pad2(seconds)}`;
  return `${minutes}:${pad2(seconds)}`;
}

export function elapsedMinutes(startedAt: number, endedAt = Date.now()): number {
  return Math.floor(Math.max(0, endedAt - startedAt) / 60_000);
}

function sanitizeRuns(value: unknown): TimerRun[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const run = item as Record<string, unknown>;
    if (typeof run.startedAt !== "number" || typeof run.endedAt !== "number") return [];
    if (run.endedAt < run.startedAt) return [];
    return [{ startedAt: run.startedAt, endedAt: run.endedAt }];
  });
}

export function normalizeRunningTimer(value: {
  interestId: string;
  dateKey: DateKey;
  accumulatedMs?: number;
  runningSince?: number | null;
  startedAt?: number;
  runs?: TimerRun[];
}): RunningTimer {
  const runs = sanitizeRuns(value.runs);
  const runMs = runs.reduce((sum, run) => sum + (run.endedAt - run.startedAt), 0);
  if (typeof value.accumulatedMs === "number") {
    return {
      interestId: value.interestId,
      dateKey: value.dateKey,
      accumulatedMs: runs.length > 0 ? runMs : value.accumulatedMs,
      runningSince: typeof value.runningSince === "number" ? value.runningSince : null,
      runs,
    };
  }
  return {
    interestId: value.interestId,
    dateKey: value.dateKey,
    accumulatedMs: runMs,
    runningSince: typeof value.startedAt === "number" ? value.startedAt : null,
    runs,
  };
}

export function timerElapsedMs(timer: RunningTimer, now = Date.now()): number {
  const current = normalizeRunningTimer(timer);
  const fromRuns = current.runs.reduce((sum, run) => sum + (run.endedAt - run.startedAt), 0);
  const live = current.runningSince != null ? Math.max(0, now - current.runningSince) : 0;
  if (current.runs.length > 0) return fromRuns + live;
  return current.accumulatedMs + live;
}

export function startRunningTimer(
  interestId: string,
  dateKey: DateKey,
  now = Date.now(),
): RunningTimer {
  return {
    interestId,
    dateKey,
    accumulatedMs: 0,
    runningSince: now,
    runs: [],
  };
}

export function pauseRunningTimer(timer: RunningTimer, now = Date.now()): RunningTimer {
  const current = normalizeRunningTimer(timer);
  if (current.runningSince == null) return current;
  const runs = [...current.runs, { startedAt: current.runningSince, endedAt: now }];
  return {
    ...current,
    runs,
    accumulatedMs: timerElapsedMs(current, now),
    runningSince: null,
  };
}

export function resumeRunningTimer(timer: RunningTimer, now = Date.now()): RunningTimer {
  const current = normalizeRunningTimer(timer);
  if (current.runningSince != null) return current;
  return { ...current, runningSince: now };
}

export function startOfLocalDay(ms: number): number {
  const date = new Date(ms);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function startOfNextLocalDay(ms: number): number {
  const date = new Date(startOfLocalDay(ms));
  date.setDate(date.getDate() + 1);
  return date.getTime();
}

export function splitMsByLocalDate(
  startedAt: number,
  endedAt: number,
): Array<{ dateKey: DateKey; ms: number }> {
  const slices: Array<{ dateKey: DateKey; ms: number }> = [];
  let start = startedAt;
  const end = Math.max(startedAt, endedAt);
  while (start < end) {
    const next = startOfNextLocalDay(start);
    const sliceMs = Math.min(end, next) - start;
    const dateKey = toDateKey(new Date(start));
    const last = slices[slices.length - 1];
    if (last && last.dateKey === dateKey) last.ms += sliceMs;
    else slices.push({ dateKey, ms: sliceMs });
    start += sliceMs;
  }
  return slices;
}

export function isSleepTimerId(interestId: string, items: Interest[] = []): boolean {
  if (interestId === "sleep") return true;
  return items.some((item) => item.id === interestId && item.locked);
}

export function allocateTimerMinutes(
  timer: RunningTimer,
  now = Date.now(),
  splitByDate = false,
): Array<{ dateKey: DateKey; minutes: number }> {
  const current = normalizeRunningTimer(timer);
  const totalMinutes = Math.floor(timerElapsedMs(current, now) / 60_000);
  if (totalMinutes < 1) return [];
  if (!splitByDate) {
    return [{ dateKey: current.dateKey, minutes: totalMinutes }];
  }

  const msByDate = new Map<DateKey, number>();
  if (current.runs.length === 0 && current.accumulatedMs > 0) {
    msByDate.set(current.dateKey, current.accumulatedMs);
  }
  const openRuns: TimerRun[] = [...current.runs];
  if (current.runningSince != null) {
    openRuns.push({ startedAt: current.runningSince, endedAt: now });
  }
  for (const run of openRuns) {
    for (const slice of splitMsByLocalDate(run.startedAt, run.endedAt)) {
      msByDate.set(slice.dateKey, (msByDate.get(slice.dateKey) ?? 0) + slice.ms);
    }
  }

  const rows = [...msByDate.entries()].map(([dateKey, ms]) => ({
    dateKey,
    minutes: Math.floor(ms / 60_000),
    rem: ms % 60_000,
  }));
  const leftovers = [...rows].sort((a, b) => b.rem - a.rem);
  let extra = totalMinutes - rows.reduce((sum, row) => sum + row.minutes, 0);
  let index = 0;
  while (extra > 0 && leftovers.length > 0) {
    leftovers[index % leftovers.length].minutes += 1;
    extra -= 1;
    index += 1;
  }
  return leftovers
    .filter((row) => row.minutes > 0)
    .sort((a, b) => (a.dateKey < b.dateKey ? -1 : 1))
    .map(({ dateKey, minutes }) => ({ dateKey, minutes }));
}

export function applyMinutesByDates(
  actualByDate: Record<DateKey, Interest[]>,
  feelWeek: WeekPlan,
  interestId: string,
  chunks: Array<{ dateKey: DateKey; minutes: number }>,
): {
  actualByDate: Record<DateKey, Interest[]>;
  added: number;
  asked: number;
  parts: Array<{ dateKey: DateKey; minutes: number; added: number }>;
} {
  let next = { ...actualByDate };
  let added = 0;
  const parts: Array<{ dateKey: DateKey; minutes: number; added: number }> = [];
  for (const chunk of chunks) {
    if (chunk.minutes <= 0) continue;
    const day = actualDayFor(next, chunk.dateKey, feelWeek);
    const result = addActualMinutes(day, interestId, chunk.minutes);
    next = { ...next, [chunk.dateKey]: result.items };
    added += result.added;
    parts.push({ dateKey: chunk.dateKey, minutes: chunk.minutes, added: result.added });
  }
  return {
    actualByDate: next,
    added,
    asked: chunks.reduce((sum, chunk) => sum + Math.max(0, chunk.minutes), 0),
    parts,
  };
}

export function monthCells(
  year: number,
  monthIndex: number,
): Array<{ dateKey: DateKey | null; day: number | null }> {
  const pad = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const last = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<{ dateKey: DateKey | null; day: number | null }> = [];
  for (let i = 0; i < pad; i += 1) cells.push({ dateKey: null, day: null });
  for (let day = 1; day <= last; day += 1) {
    cells.push({ dateKey: toDateKey(new Date(year, monthIndex, day)), day });
  }
  while (cells.length % 7 !== 0) cells.push({ dateKey: null, day: null });
  return cells;
}

export function formatMonthTitle(year: number, monthIndex: number): string {
  const text = new Date(year, monthIndex, 1).toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function isSleepInterest(item: Interest): boolean {
  return item.id === "sleep" || item.locked;
}

export function emptyActualDay(template: Interest[]): Interest[] {
  return template.map((item) => ({ ...item, minutes: 0 }));
}

export function actualDayFor(
  actualByDate: Record<DateKey, Interest[]>,
  dateKey: DateKey,
  feelWeek: WeekPlan,
): Interest[] {
  const existing = actualByDate[dateKey];
  if (existing?.length) return existing;
  const template = feelWeek[dateKeyToDayId(dateKey)] ?? feelWeek.mon;
  return emptyActualDay(template);
}

export function addActualMinutes(
  items: Interest[],
  interestId: string,
  addMinutes: number,
): { items: Interest[]; added: number } {
  if (addMinutes <= 0) return { items, added: 0 };
  const current = items.find((item) => item.id === interestId);
  if (!current) return { items, added: 0 };
  const roomDay = Math.max(0, DAY_MINUTES - dayUsedMinutes(items));
  const roomItem = Math.max(0, MAX_MINUTES_PER_INTEREST - current.minutes);
  const added = Math.min(addMinutes, roomDay, roomItem);
  if (added <= 0) return { items, added: 0 };
  const next = items.map((item) =>
    item.id === interestId ? { ...item, minutes: item.minutes + added } : item,
  );
  return { items: clampDayMinutes(next), added };
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

export function floorFor(item: Interest, actual = false): number {
  if (actual) return 0;
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

export function dayUsedMinutes(items: Interest[]): number {
  return items.reduce((sum, item) => sum + item.minutes, 0);
}

export function clampDayMinutes(items: Interest[]): Interest[] {
  let overflow = dayUsedMinutes(items) - DAY_MINUTES;
  if (overflow <= 0) return items;
  return items.map((item) => {
    if (overflow <= 0) return item;
    const reducible = Math.max(0, item.minutes - floorFor(item));
    const cut = Math.min(reducible, overflow);
    overflow -= cut;
    return cut === 0 ? item : { ...item, minutes: item.minutes - cut };
  });
}

export function weekUsedMinutes(week: WeekPlan): number {
  return DAYS.reduce(
    (sum, day) => sum + dayUsedMinutes(week[day.id]),
    0,
  );
}

function sortInterests(items: Interest[]): Interest[] {
  const order = SPHERE_DEFS.map((item) => item.id);
  return [...items].sort((a, b) => {
    const ia = order.indexOf(a.id);
    const ib = order.indexOf(b.id);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a.name.localeCompare(b.name, "ru");
  });
}

export function mergeInterestLists(lists: Interest[][]): Interest[] {
  const map = new Map<string, Interest>();
  for (const items of lists) {
    for (const item of items) {
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
  return sortInterests([...map.values()]);
}

export function aggregateWeek(week: WeekPlan): Interest[] {
  return mergeInterestLists(DAYS.map((day) => week[day.id]));
}

export function sanitizeWeek(week: WeekPlan): WeekPlan {
  return Object.fromEntries(
    DAYS.map((day) => [
      day.id,
      clampDayMinutes(week[day.id].map((item) => migrateInterest(item))),
    ]),
  ) as WeekPlan;
}

export function isRunningTimer(value: unknown): value is RunningTimer {
  if (!value || typeof value !== "object") return false;
  const timer = value as Record<string, unknown>;
  if (typeof timer.interestId !== "string" || typeof timer.dateKey !== "string") {
    return false;
  }
  if (typeof timer.accumulatedMs === "number") {
    return timer.runningSince === null || typeof timer.runningSince === "number";
  }
  return typeof timer.startedAt === "number";
}

export function isActualByDate(value: unknown): value is Record<DateKey, Interest[]> {
  if (!value || typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).every((items) => isInterestArray(items));
}

export function isAppPersist(value: unknown): value is AppPersist {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    isWeekPlan(record.feelWeek) &&
    isActualByDate(record.actualByDate) &&
    (record.runningTimer == null || isRunningTimer(record.runningTimer)) &&
    typeof record.feelConfirmed === "boolean" &&
    typeof record.introSeen === "boolean"
  );
}

export const BACKUP_KIND = "wheel-of-balance-backup";
export const BACKUP_VERSION = 8;

export function sanitizePersist(store: AppPersist): AppPersist {
  return {
    feelWeek: sanitizeWeek(store.feelWeek),
    actualByDate: Object.fromEntries(
      Object.entries(store.actualByDate).map(([key, items]) => [
        key,
        clampDayMinutes(items.map((item) => migrateInterest(item))),
      ]),
    ),
    runningTimer: store.runningTimer
      ? normalizeRunningTimer(store.runningTimer)
      : null,
    feelConfirmed: store.feelConfirmed,
    feelSkipped: store.feelSkipped === true,
    introSeen: store.introSeen,
  };
}

export function buildBackup(store: AppPersist) {
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    ...store,
  };
}

export function parseBackup(value: unknown): AppPersist | null {
  if (isAppPersist(value)) return sanitizePersist(value);
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const loose = {
    feelWeek: record.feelWeek,
    actualByDate: record.actualByDate ?? {},
    runningTimer: record.runningTimer ?? null,
    feelConfirmed: typeof record.feelConfirmed === "boolean" ? record.feelConfirmed : true,
    feelSkipped: record.feelSkipped === true,
    introSeen: typeof record.introSeen === "boolean" ? record.introSeen : true,
  };
  if (isAppPersist(loose)) return sanitizePersist(loose);
  if (isWeekPlan(value)) {
    return {
      feelWeek: sanitizeWeek(value),
      actualByDate: {},
      runningTimer: null,
      feelConfirmed: true,
      feelSkipped: false,
      introSeen: true,
    };
  }
  return null;
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
  "Сон и восстановление": "Сон",
  "Работа и карьера": "Работа",
  "Здоровье и спорт": "Здоровье",
  Спорт: "Здоровье",
  "Развлечения и друзья": "Развлечения",
  "Развлечения и отдых": "Развлечения",
  "Развлечения и путешествия": "Развлечения",
  "Образование и саморазвитие": "Образование",
  "Хобби и увлечения": "Увлечения",
  Хобби: "Увлечения",
  Творчество: "Увлечения",
  "Быт и уклад жизни": "Быт",
  "Финансы и благосостояние": "Финансы",
  "Ментальность и рефлексия": "Рефлексия",
  Ментальность: "Рефлексия",
  Духовность: "Рефлексия",
  "Отдых и путешествия": "Фрустрация",
  "Отдых и друзья": "Фрустрация",
  Отдых: "Фрустрация",
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
    name = "Рефлексия";
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
