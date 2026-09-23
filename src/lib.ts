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
  auxMinutes: number;
};

export type MinuteRole = "primary" | "auxiliary";

export function primaryMinutes(item: Interest): number {
  return Math.max(0, item.minutes - Math.max(0, item.auxMinutes));
}

export function clampInterest(item: Interest): Interest {
  const minutes = Math.max(0, item.minutes);
  const auxMinutes = Math.max(0, Math.min(item.auxMinutes, minutes));
  return { ...item, minutes, auxMinutes };
}

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
    auxMinutes: 0,
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
  secondaryId: string | null;
  accumulatedMs: number;
  runningSince: number | null;
  runs: TimerRun[];
};

export type SphereSession = {
  id: string;
  minutes: number;
  comment: string;
  aux?: boolean;
};

export type DayRecord = {
  spheres: Record<string, { sessions: SphereSession[] }>;
};

export type AppPersist = {
  feelWeek: WeekPlan;
  dates: Record<DateKey, DayRecord>;
  runningTimer: RunningTimer | null;
  feelConfirmed: boolean;
  feelSkipped: boolean;
  introSeen: boolean;
};

let periodSeq = 0;

export function newPeriodId(): string {
  periodSeq += 1;
  return `p-${Date.now().toString(36)}-${periodSeq.toString(36)}`;
}

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
  secondaryId?: string | null;
  accumulatedMs?: number;
  runningSince?: number | null;
  startedAt?: number;
  runs?: TimerRun[];
}): RunningTimer {
  const runs = sanitizeRuns(value.runs);
  const runMs = runs.reduce((sum, run) => sum + (run.endedAt - run.startedAt), 0);
  const secondaryId =
    typeof value.secondaryId === "string" && value.secondaryId !== value.interestId
      ? value.secondaryId
      : null;
  if (typeof value.accumulatedMs === "number") {
    return {
      interestId: value.interestId,
      dateKey: value.dateKey,
      secondaryId,
      accumulatedMs: runs.length > 0 ? runMs : value.accumulatedMs,
      runningSince: typeof value.runningSince === "number" ? value.runningSince : null,
      runs,
    };
  }
  return {
    interestId: value.interestId,
    dateKey: value.dateKey,
    secondaryId,
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
  secondaryId: string | null = null,
): RunningTimer {
  return {
    interestId,
    dateKey,
    secondaryId: secondaryId && secondaryId !== interestId ? secondaryId : null,
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
  role: MinuteRole = "primary",
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
    const result = addActualMinutes(day, interestId, chunk.minutes, role);
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
  return template.map((item) => ({ ...item, minutes: 0, auxMinutes: 0 }));
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
  role: MinuteRole = "primary",
): { items: Interest[]; added: number } {
  if (addMinutes <= 0) return { items, added: 0 };
  const current = items.find((item) => item.id === interestId);
  if (!current) return { items, added: 0 };
  const roomItem = Math.max(0, MAX_MINUTES_PER_INTEREST - current.minutes);
  const roomDay =
    role === "auxiliary" ? roomItem : Math.max(0, DAY_MINUTES - dayUsedMinutes(items));
  const added = Math.min(addMinutes, roomDay, roomItem);
  if (added <= 0) return { items, added: 0 };
  const next = items.map((item) => {
    if (item.id !== interestId) return item;
    return clampInterest({
      ...item,
      minutes: item.minutes + added,
      auxMinutes: item.auxMinutes + (role === "auxiliary" ? added : 0),
    });
  });
  return { items: clampDayMinutes(next), added };
}

function cleanSession(value: unknown): SphereSession | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  if (typeof rec.id !== "string" || typeof rec.minutes !== "number" || rec.minutes <= 0) return null;
  const session: SphereSession = {
    id: rec.id,
    minutes: Math.round(rec.minutes),
    comment: typeof rec.comment === "string" ? rec.comment : "",
  };
  if (rec.aux === true) session.aux = true;
  return session;
}

export function cleanDates(value: unknown): Record<DateKey, DayRecord> {
  if (!value || typeof value !== "object") return {};
  const dates: Record<DateKey, DayRecord> = {};
  for (const [key, day] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !day || typeof day !== "object") continue;
    const spheresIn = (day as { spheres?: unknown }).spheres;
    if (!spheresIn || typeof spheresIn !== "object") continue;
    const spheres: DayRecord["spheres"] = {};
    for (const [id, sphere] of Object.entries(spheresIn as Record<string, unknown>)) {
      if (!sphere || typeof sphere !== "object") continue;
      const listed = (sphere as { sessions?: unknown }).sessions;
      if (!Array.isArray(listed)) continue;
      const sessions = listed
        .map(cleanSession)
        .filter((session): session is SphereSession => session != null);
      if (sessions.length > 0) spheres[id] = { sessions };
    }
    if (Object.keys(spheres).length > 0) dates[key] = { spheres };
  }
  return dates;
}

function loosePeriodsOfDay(value: unknown): Array<Record<string, unknown>> | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const periods: Array<Record<string, unknown>> = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const period = item as Record<string, unknown>;
    if (typeof period.id !== "string" || !Array.isArray(period.shares) || period.shares.length === 0) {
      return null;
    }
    periods.push(period);
  }
  return periods;
}

function datesFromLegacy(periodsByDate: unknown, actualByDate: unknown): Record<DateKey, DayRecord> {
  const periodsRecord =
    periodsByDate && typeof periodsByDate === "object"
      ? (periodsByDate as Record<string, unknown>)
      : {};
  const actualRecord =
    actualByDate && typeof actualByDate === "object"
      ? (actualByDate as Record<string, unknown>)
      : {};
  const dates: Record<DateKey, DayRecord> = {};
  for (const key of new Set([...Object.keys(periodsRecord), ...Object.keys(actualRecord)])) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    const periods = loosePeriodsOfDay(periodsRecord[key]);
    if (periods) {
      const spheres: DayRecord["spheres"] = {};
      for (const period of periods) {
        const comment = typeof period.comment === "string" ? period.comment : "";
        for (const share of period.shares as unknown[]) {
          if (!share || typeof share !== "object") continue;
          const row = share as Record<string, unknown>;
          if (typeof row.interestId !== "string" || typeof row.minutes !== "number" || row.minutes <= 0) {
            continue;
          }
          const sessions = spheres[row.interestId]?.sessions ?? [];
          const session: SphereSession = {
            id: `${String(period.id)}-${row.interestId}`,
            minutes: Math.round(row.minutes),
            comment,
          };
          if (row.role === "auxiliary") session.aux = true;
          sessions.push(session);
          spheres[row.interestId] = { sessions };
        }
      }
      if (Object.keys(spheres).length > 0) dates[key] = { spheres };
      continue;
    }
    const items = actualRecord[key];
    if (!Array.isArray(items)) continue;
    const spheres: DayRecord["spheres"] = {};
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      if (typeof row.id !== "string") continue;
      const minutes = Math.max(0, Math.round(typeof row.minutes === "number" ? row.minutes : 0));
      const aux = Math.max(
        0,
        Math.min(Math.round(typeof row.auxMinutes === "number" ? row.auxMinutes : 0), minutes),
      );
      const primary = minutes - aux;
      const sessions: SphereSession[] = [];
      if (primary > 0) {
        sessions.push({ id: newPeriodId(), minutes: primary, comment: "" });
      }
      if (aux > 0) {
        sessions.push({ id: newPeriodId(), minutes: aux, comment: "", aux: true });
      }
      if (sessions.length > 0) spheres[row.id] = { sessions };
    }
    if (Object.keys(spheres).length > 0) dates[key] = { spheres };
  }
  return dates;
}

export function factDay(store: AppPersist, dateKey: DateKey): Interest[] {
  const template = store.feelWeek[dateKeyToDayId(dateKey)] ?? store.feelWeek.mon;
  const spheres = store.dates[dateKey]?.spheres ?? {};
  return sortInterests(
    template.map((item) => {
      const sessions = spheres[item.id]?.sessions ?? [];
      let minutes = 0;
      let auxMinutes = 0;
      for (const session of sessions) {
        const amount = Math.max(0, session.minutes);
        minutes += amount;
        if (session.aux) auxMinutes += amount;
      }
      return clampInterest({ ...item, minutes, auxMinutes });
    }),
  );
}

export function sphereSessions(
  store: AppPersist,
  dateKey: DateKey,
  interestId: string,
): SphereSession[] {
  return store.dates[dateKey]?.spheres[interestId]?.sessions ?? [];
}

function putSphereSessions(
  store: AppPersist,
  dateKey: DateKey,
  interestId: string,
  sessions: SphereSession[],
): AppPersist {
  const dates = { ...store.dates };
  const day = dates[dateKey] ?? { spheres: {} };
  const spheres = { ...day.spheres };
  const kept = sessions
    .map((session) => cleanSession(session))
    .filter((session): session is SphereSession => session != null);
  if (kept.length === 0) delete spheres[interestId];
  else spheres[interestId] = { sessions: kept };
  if (Object.keys(spheres).length === 0) delete dates[dateKey];
  else dates[dateKey] = { spheres };
  return { ...store, dates };
}

export function clampSessionMinutes(
  store: AppPersist,
  dateKey: DateKey,
  interestId: string,
  sessionId: string,
  minutes: number,
): number {
  const current = sphereSessions(store, dateKey, interestId).find((session) => session.id === sessionId);
  const currentMinutes = current?.minutes ?? 0;
  const aux = current?.aux === true;
  const day = factDay(store, dateKey);
  const item = day.find((entry) => entry.id === interestId);
  if (!item) return 0;
  const roomItem = Math.max(0, MAX_MINUTES_PER_INTEREST - item.minutes + currentMinutes);
  const roomDay = aux
    ? roomItem
    : Math.max(0, DAY_MINUTES - dayUsedMinutes(day) + currentMinutes);
  return Math.max(0, Math.min(Math.round(minutes), roomItem, roomDay));
}

export function writeSession(
  store: AppPersist,
  dateKey: DateKey,
  interestId: string,
  sessionId: string,
  minutes: number,
  comment: string,
): AppPersist {
  const existing = sphereSessions(store, dateKey, interestId);
  const current = existing.find((session) => session.id === sessionId);
  const nextMinutes = clampSessionMinutes(store, dateKey, interestId, sessionId, minutes);
  const nextComment = comment.trim();
  if (!current) {
    if (nextMinutes <= 0) return store;
    return putSphereSessions(store, dateKey, interestId, [
      ...existing,
      { id: sessionId === "new" ? newPeriodId() : sessionId, minutes: nextMinutes, comment: nextComment },
    ]);
  }
  if (nextMinutes <= 0) {
    return putSphereSessions(
      store,
      dateKey,
      interestId,
      existing.filter((session) => session.id !== sessionId),
    );
  }
  return putSphereSessions(
    store,
    dateKey,
    interestId,
    existing.map((session) =>
      session.id === sessionId
        ? {
            ...session,
            minutes: nextMinutes,
            comment: nextComment,
          }
        : session,
    ),
  );
}

export function addSphereSession(
  store: AppPersist,
  dateKey: DateKey,
  interestId: string,
  minutes: number,
  comment = "",
  aux = false,
): { store: AppPersist; added: number } {
  const probeId = "__new__";
  const existing = sphereSessions(store, dateKey, interestId);
  const withProbe = putSphereSessions(store, dateKey, interestId, [
    ...existing,
    { id: probeId, minutes: 1, comment: "", ...(aux ? { aux: true } : {}) },
  ]);
  const added = clampSessionMinutes(withProbe, dateKey, interestId, probeId, minutes);
  if (added <= 0) return { store, added: 0 };
  return {
    store: putSphereSessions(store, dateKey, interestId, [
      ...existing,
      {
        id: newPeriodId(),
        minutes: added,
        comment: comment.trim(),
        ...(aux ? { aux: true } : {}),
      },
    ]),
    added,
  };
}

export function appendTimerSessions(
  store: AppPersist,
  interestId: string,
  secondaryId: string | null,
  chunks: Array<{ dateKey: DateKey; minutes: number }>,
): {
  store: AppPersist;
  added: number;
  auxAdded: number;
  asked: number;
  parts: Array<{ dateKey: DateKey; minutes: number; added: number }>;
} {
  let next = store;
  let added = 0;
  let auxTotal = 0;
  const parts: Array<{ dateKey: DateKey; minutes: number; added: number }> = [];
  for (const chunk of chunks) {
    if (chunk.minutes <= 0) continue;
    const primary = addSphereSession(next, chunk.dateKey, interestId, chunk.minutes);
    if (primary.added <= 0) {
      parts.push({ dateKey: chunk.dateKey, minutes: chunk.minutes, added: 0 });
      continue;
    }
    next = primary.store;
    let auxAdded = 0;
    if (secondaryId) {
      const extra = addSphereSession(next, chunk.dateKey, secondaryId, primary.added, "", true);
      auxAdded = extra.added;
      next = extra.store;
    }
    added += primary.added;
    auxTotal += auxAdded;
    parts.push({ dateKey: chunk.dateKey, minutes: chunk.minutes, added: primary.added });
  }
  return {
    store: next,
    added,
    auxAdded: auxTotal,
    asked: chunks.reduce((sum, chunk) => sum + Math.max(0, chunk.minutes), 0),
    parts,
  };
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
  return items.reduce((sum, item) => sum + primaryMinutes(item), 0);
}

export function clampDayMinutes(items: Interest[]): Interest[] {
  let overflow = dayUsedMinutes(items) - DAY_MINUTES;
  if (overflow <= 0) return items;
  return items.map((item) => {
    if (overflow <= 0) return item;
    const reducible = Math.max(0, primaryMinutes(item) - floorFor(item));
    const cut = Math.min(reducible, overflow);
    overflow -= cut;
    return cut === 0 ? item : clampInterest({ ...item, minutes: item.minutes - cut });
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
        map.set(item.id, clampInterest({ ...item, auxMinutes: item.auxMinutes ?? 0 }));
      } else {
        map.set(item.id, {
          ...prev,
          minutes: prev.minutes + item.minutes,
          auxMinutes: prev.auxMinutes + (item.auxMinutes ?? 0),
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

function isDatesRecord(value: unknown): value is Record<DateKey, DayRecord> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isAppPersist(value: unknown): value is AppPersist {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    isWeekPlan(record.feelWeek) &&
    isDatesRecord(record.dates) &&
    (record.runningTimer == null || isRunningTimer(record.runningTimer)) &&
    typeof record.feelConfirmed === "boolean" &&
    typeof record.introSeen === "boolean"
  );
}

export const BACKUP_KIND = "wheel-of-balance-backup";
export const BACKUP_VERSION = 9;

export function sanitizePersist(store: AppPersist): AppPersist {
  return {
    feelWeek: sanitizeWeek(store.feelWeek),
    dates: cleanDates(store.dates),
    runningTimer: store.runningTimer ? normalizeRunningTimer(store.runningTimer) : null,
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
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const runningTimer =
    record.runningTimer == null || isRunningTimer(record.runningTimer)
      ? record.runningTimer ?? null
      : null;
  if (isDatesRecord(record.dates)) {
    const datesOnly = !isWeekPlan(record.feelWeek);
    return sanitizePersist({
      feelWeek: isWeekPlan(record.feelWeek) ? record.feelWeek : defaultWeek(),
      dates: cleanDates(record.dates),
      runningTimer,
      feelConfirmed: typeof record.feelConfirmed === "boolean" ? record.feelConfirmed : true,
      feelSkipped: typeof record.feelSkipped === "boolean" ? record.feelSkipped : datesOnly,
      introSeen: typeof record.introSeen === "boolean" ? record.introSeen : true,
    });
  }
  if (record.periodsByDate || record.actualByDate || isWeekPlan(record.feelWeek) || isWeekPlan(value)) {
    const feelWeek = isWeekPlan(record.feelWeek)
      ? record.feelWeek
      : isWeekPlan(value)
        ? value
        : defaultWeek();
    return sanitizePersist({
      feelWeek,
      dates: datesFromLegacy(record.periodsByDate, record.actualByDate),
      runningTimer,
      feelConfirmed: typeof record.feelConfirmed === "boolean" ? record.feelConfirmed : true,
      feelSkipped: record.feelSkipped === true,
      introSeen: typeof record.introSeen === "boolean" ? record.introSeen : true,
    });
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
  auxMinutes?: number;
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
  const auxMinutes = typeof item.auxMinutes === "number" ? item.auxMinutes : 0;
  return clampInterest({ id, name, locked: item.locked, minutes, auxMinutes });
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
