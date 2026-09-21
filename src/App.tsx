import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import {
  CX,
  CY,
  DAYS,
  DAY_HOURS,
  DAY_MINUTES,
  HOUR_MINUTES,
  LABEL_R,
  LIST_STEP_DAILY_MINUTES,
  MAX_INTERESTS,
  MAX_R,
  MAX_MINUTES_PER_INTEREST,
  WEEK_MINUTES,
  RING_COUNT,
  SLEEP_NORM_MINUTES,
  VIEW,
  WEEK_HOURS,
  WORK_NORM_MINUTES,
  WHEEL_STEP_MINUTES,
  allocateTimerMinutes,
  addManualPeriod,
  actualDayFor,
  aggregateWeek,
  appendTimerPeriods,
  buildBackup,
  clampDayMinutes,
  clampShareMinutes,
  closedCurve,
  colorAtLevel,
  dailyMinutes,
  dateKeyToDayId,
  dayPeriods,
  dayUsedMinutes,
  defaultWeek,
  floorFor,
  formatDateTitle,
  formatElapsed,
  formatMonthTitle,
  formatMinutes,
  isSleepInterest,
  isSleepTimerId,
  isWeekPlan,
  mergeInterestLists,
  monthCells,
  nextListMinutes,
  nextWheelMinutes,
  normalizeRunningTimer,
  patchDayPeriods,
  pauseRunningTimer,
  resumeRunningTimer,
  startRunningTimer,
  parseBackup,
  palette,
  parseDateKey,
  periodShareFor,
  periodsForInterest,
  polar,
  primaryMinutes,
  levelValue,
  sanitizeWeek,
  setShareMinutes,
  timerElapsedMs,
  todayDateKey,
  todayDayId,
  toneForInterest,
  weekDateKeys,
  weekLevelValue,
  weekToneForInterest,
  weekUsedMinutes,
  type AppPersist,
  type DateKey,
  type DayId,
  type DayPeriod,
  type Interest,
} from "./lib";

const STORAGE_KEY = "wheel-of-balance-v8";
const LEGACY_KEY = "wheel-of-balance-v7";

type ToastItem = {
  id: number;
  tone: "danger" | "warning" | "success";
  title: string;
  body: string;
};

type MobileTab = "map" | "timer" | "calendar" | "data";

function emptyStore(): AppPersist {
  return {
    feelWeek: defaultWeek(),
    actualByDate: {},
    periodsByDate: {},
    runningTimer: null,
    feelConfirmed: false,
    feelSkipped: false,
    introSeen: false,
  };
}

function writeStore(store: AppPersist): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

type BootResult = {
  store: AppPersist;
  allowWrite: boolean;
  hadCorrupt: boolean;
};

function readBoot(): BootResult {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw != null && raw !== "") {
      try {
        const backup = parseBackup(JSON.parse(raw) as unknown);
        if (backup) return { store: backup, allowWrite: true, hadCorrupt: false };
      } catch {
        /* unreadable v8 */
      }
      return { store: emptyStore(), allowWrite: false, hadCorrupt: true };
    }
  } catch {
    return { store: emptyStore(), allowWrite: false, hadCorrupt: true };
  }
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed: unknown = JSON.parse(legacy);
      if (isWeekPlan(parsed)) {
        return {
          store: {
            feelWeek: sanitizeWeek(parsed),
            actualByDate: {},
            periodsByDate: {},
            runningTimer: null,
            feelConfirmed: true,
            feelSkipped: false,
            introSeen: false,
          },
          allowWrite: true,
          hadCorrupt: false,
        };
      }
    }
  } catch {
    /* first run */
  }
  return { store: emptyStore(), allowWrite: true, hadCorrupt: false };
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

function useVisibleFrame(active: boolean) {
  const [frame, setFrame] = useState(() => ({
    top: 0,
    left: 0,
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  }));

  useEffect(() => {
    if (!active) return;

    const read = () => {
      const view = window.visualViewport;
      setFrame({
        top: view?.offsetTop ?? 0,
        left: view?.offsetLeft ?? 0,
        width: view?.width ?? window.innerWidth,
        height: view?.height ?? window.innerHeight,
      });
    };

    read();
    const view = window.visualViewport;
    view?.addEventListener("resize", read);
    view?.addEventListener("scroll", read);
    window.addEventListener("resize", read);
    window.addEventListener("orientationchange", read);
    return () => {
      view?.removeEventListener("resize", read);
      view?.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
      window.removeEventListener("orientationchange", read);
    };
  }, [active]);

  return frame;
}

function useTodayKey(): DateKey {
  const [key, setKey] = useState(todayDateKey);
  useEffect(() => {
    const tick = () => setKey(todayDateKey());
    const id = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return key;
}

export default function App() {
  const boot = useRef<BootResult | null>(null);
  if (boot.current == null) boot.current = readBoot();
  const allowWrite = useRef(boot.current.allowWrite);
  const [store, setStore] = useState<AppPersist>(boot.current.store);
  const storeRef = useRef(store);
  storeRef.current = store;
  const [pickedDayId, setPickedDayId] = useState<DayId>(todayDayId);
  const [pickedDateKey, setPickedDateKey] = useState<DateKey>(todayDateKey);
  const [mode, setMode] = useState<"feel" | "fact">(
    store.feelConfirmed ? "fact" : "feel",
  );
  const [draft, setDraft] = useState("");
  const [seq, setSeq] = useState(20);
  const [introOpen, setIntroOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [timeEditId, setTimeEditId] = useState<string | null>(null);
  const [periodListId, setPeriodListId] = useState<string | null>(null);
  const [periodEdit, setPeriodEdit] = useState<{
    interestId: string;
    periodId: string | "new";
  } | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("timer");
  const [calCursor, setCalCursor] = useState(() => {
    const date = parseDateKey(todayDateKey());
    return { year: date.getFullYear(), month: date.getMonth() };
  });
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const toastSeq = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const isMobile = useMediaQuery("(max-width: 720px)");
  const viewFrame = useVisibleFrame(isMobile);

  useEffect(() => {
    if (!isMobile) return;
    const pin = () => {
      if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
    };
    pin();
    window.addEventListener("scroll", pin, { passive: true });
    return () => window.removeEventListener("scroll", pin);
  }, [isMobile]);
  const todayKey = useTodayKey();
  const viewMode =
    !store.feelConfirmed ? "feel" : store.feelSkipped ? "fact" : mode;
  const viewDateKey = pickedDateKey;
  const dayId = isMobile ? dateKeyToDayId(viewDateKey) : pickedDayId;
  const weekKeys = useMemo(() => weekDateKeys(parseDateKey(todayKey)), [todayKey]);

  const interests =
    viewMode === "feel"
      ? store.feelWeek[dayId]
      : actualDayFor(store.actualByDate, viewDateKey, store.feelWeek);

  function persistNow(next: AppPersist) {
    if (!allowWrite.current) return;
    writeStore(next);
  }

  function commitStore(updater: (prev: AppPersist) => AppPersist) {
    setStore((prev) => {
      const next = updater(prev);
      persistNow(next);
      return next;
    });
  }

  useEffect(() => {
    persistNow(store);
  }, [store]);

  useEffect(() => {
    function flush() {
      if (allowWrite.current) writeStore(storeRef.current);
    }
    function onVis() {
      if (document.visibilityState === "hidden") flush();
    }
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  useEffect(() => {
    if (!store.runningTimer) return;
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 250);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [store.runningTimer]);

  useEffect(() => {
    if (!introOpen && !resetOpen && !timeEditId && !periodListId && !periodEdit) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (periodEdit) setPeriodEdit(null);
      else if (periodListId) setPeriodListId(null);
      else if (timeEditId) setTimeEditId(null);
      else if (resetOpen) setResetOpen(false);
      else closeIntro();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [introOpen, resetOpen, timeEditId, periodListId, periodEdit]);

  function addToast(tone: ToastItem["tone"], title: string, body: string) {
    const id = ++toastSeq.current;
    setToasts((prev) => [
      ...prev.filter((item) => item.title !== title),
      { id, tone, title, body },
    ]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 5200);
  }

  useEffect(() => {
    if (!boot.current?.hadCorrupt) return;
    addToast(
      "danger",
      "Сейв не открылся",
      "Старую записку не трогал. Не настраивайте сферы заново — так можно затереть данные, когда чтение починим.",
    );
  }, []);

  function closeIntro() {
    setIntroOpen(false);
    setStore((prev) => ({ ...prev, introSeen: true }));
  }

  function setFeelDay(next: Interest[]) {
    setStore((prev) => ({
      ...prev,
      feelWeek: { ...prev.feelWeek, [dayId]: clampDayMinutes(next) },
    }));
  }

  function confirmFeel() {
    commitStore((prev) => ({ ...prev, feelConfirmed: true, feelSkipped: false }));
    setMode("fact");
  }

  function skipFeel() {
    commitStore((prev) => ({ ...prev, feelConfirmed: true, feelSkipped: true }));
    setMode("fact");
  }

  const usedMinutesFeel = weekUsedMinutes(store.feelWeek);
  const weekActualLists = weekKeys.map((key) =>
    actualDayFor(store.actualByDate, key, store.feelWeek),
  );
  const usedMinutesActualWeek = weekActualLists.reduce(
    (sum, items) => sum + dayUsedMinutes(items),
    0,
  );
  const usedMinutesActualDay = dayUsedMinutes(
    actualDayFor(store.actualByDate, viewDateKey, store.feelWeek),
  );
  const weekUsedForStats = viewMode === "feel" ? usedMinutesFeel : usedMinutesActualWeek;
  const freeMinutes = WEEK_MINUTES - weekUsedForStats;
  const dayRoom = Math.max(0, DAY_MINUTES - dayUsedMinutes(interests));
  const sleep = interests.find((item) => item.locked) ?? interests[0];
  const sleepLow = sleep.minutes < SLEEP_NORM_MINUTES;
  const sleepHigh = sleep.minutes > SLEEP_NORM_MINUTES;
  const work = interests.find((item) => item.id === "work");
  const workHigh = (work?.minutes ?? 0) > WORK_NORM_MINUTES;
  const canAdd = interests.length < MAX_INTERESTS;
  const weeklyInterests = useMemo(
    () =>
      viewMode === "feel"
        ? aggregateWeek(store.feelWeek)
        : mergeInterestLists(weekActualLists),
    [viewMode, store.feelWeek, weekActualLists],
  );
  const timerSpheres = actualDayFor(store.actualByDate, todayKey, store.feelWeek);
  const running = store.runningTimer ? normalizeRunningTimer(store.runningTimer) : null;
  const runningItem = running
    ? timerSpheres.find((item) => item.id === running.interestId) ??
      interests.find((item) => item.id === running.interestId)
    : undefined;
  const runningSecondaryItem = running?.secondaryId
    ? timerSpheres.find((item) => item.id === running.secondaryId) ??
      interests.find((item) => item.id === running.secondaryId)
    : undefined;
  const timerLive = running ? timerElapsedMs(running, now) : 0;
  const timerPaused = running != null && running.runningSince == null;

  function noteBalanceToasts(prevItems: Interest[], nextItems: Interest[]) {
    const prevSleep = prevItems.find((item) => item.locked) ?? prevItems[0];
    const nextSleep = nextItems.find((item) => item.locked) ?? nextItems[0];
    const prevWork = prevItems.find((item) => item.id === "work");
    const nextWork = nextItems.find((item) => item.id === "work");
    if (
      prevSleep &&
      nextSleep &&
      prevSleep.minutes >= SLEEP_NORM_MINUTES &&
      nextSleep.minutes < SLEEP_NORM_MINUTES
    ) {
      addToast(
        "danger",
        "Сон ниже нормы",
        `8 ч в сутки — норма и полезный максимум. Сейчас ${formatMinutes(nextSleep.minutes)} в день. Это уже жертва здоровьем.`,
      );
    }
    if (
      prevSleep &&
      nextSleep &&
      prevSleep.minutes <= SLEEP_NORM_MINUTES &&
      nextSleep.minutes > SLEEP_NORM_MINUTES
    ) {
      addToast(
        "warning",
        "Сон выше полезного максимума",
        "Больше 8 ч в сутки поставить можно, но пользы уже нет — эти часы не усиливают восстановление.",
      );
    }
    if (
      prevWork &&
      nextWork &&
      prevWork.minutes <= WORK_NORM_MINUTES &&
      nextWork.minutes > WORK_NORM_MINUTES
    ) {
      addToast(
        "danger",
        "Работа ушла в перегруз",
        "Норма рабочего дня — 8 ч (5-й уровень). Дальше часов больше, эффективность падает, баланс нарушается.",
      );
    }
  }

  function commitFactStore(next: AppPersist) {
    noteBalanceToasts(
      actualDayFor(store.actualByDate, viewDateKey, store.feelWeek),
      actualDayFor(next.actualByDate, viewDateKey, store.feelWeek),
    );
    commitStore(() => next);
  }

  function writeDayMinutes(id: string, next: number, nextAux?: number) {
    const current = interests.find((item) => item.id === id);
    if (!current) return;
    const auxMinutes =
      nextAux == null ? Math.min(current.auxMinutes, next) : Math.min(nextAux, next);
    if (next === current.minutes && auxMinutes === current.auxMinutes) return;
    const nextInterests = interests.map((item) =>
      item.id === id ? { ...item, minutes: next, auxMinutes } : item,
    );
    noteBalanceToasts(interests, nextInterests);
    if (
      dayUsedMinutes(interests) < DAY_MINUTES &&
      dayUsedMinutes(interests) - primaryMinutes(current) + (next - auxMinutes) >= DAY_MINUTES
    ) {
      addToast(
        "warning",
        "В сутках только 24 часа",
        "Этот день заполнен. Чтобы поднять одну сферу, сначала уберите часы у другой.",
      );
    }
    setFeelDay(nextInterests);
  }

  function setItemMinutes(id: string, minutes: number) {
    const current = interests.find((item) => item.id === id);
    if (!current) return;
    const floor = floorFor(current, false);
    const used = dayUsedMinutes(interests);
    const currentPrimary = primaryMinutes(current);
    const roomPrimary = Math.max(0, DAY_MINUTES - used + currentPrimary);
    const auxMinutes = Math.min(current.auxMinutes, Math.max(floor, minutes));
    const nextPrimary = Math.max(
      floor,
      Math.min(MAX_MINUTES_PER_INTEREST - auxMinutes, roomPrimary, minutes - auxMinutes),
    );
    writeDayMinutes(id, nextPrimary + auxMinutes, auxMinutes);
  }

  function bumpFact(id: string, dir: 1 | -1, step: number) {
    const current = interests.find((item) => item.id === id);
    if (!current) return;
    const periods = dayPeriods(store, viewDateKey);
    const latest = [...periods].reverse().find((period) => periodShareFor(period, id));
    if (!latest) {
      if (dir < 0) return;
      const result = addManualPeriod(store, viewDateKey, id, step);
      if (result.added === 0) {
        addToast(
          "warning",
          "В сутках только 24 часа",
          "В этом дне больше нельзя добавить время. Чтобы поднять одну сферу, сначала уберите часы у другой.",
        );
        return;
      }
      commitFactStore(result.store);
      return;
    }
    const share = periodShareFor(latest, id);
    if (!share) return;
    const nextMinutes = clampShareMinutes(
      store,
      viewDateKey,
      latest.id,
      id,
      share.minutes + dir * step,
    );
    if (nextMinutes === share.minutes) {
      if (dir > 0) {
        addToast(
          "warning",
          "В сутках только 24 часа",
          "В этом дне больше нельзя добавить время. Чтобы поднять одну сферу, сначала уберите часы у другой.",
        );
      }
      return;
    }
    commitFactStore(
      patchDayPeriods(store, viewDateKey, setShareMinutes(periods, latest.id, id, nextMinutes)),
    );
  }

  function bump(id: string, dir: 1 | -1, source: "wheel" | "list") {
    const used = dayUsedMinutes(interests);
    const current = interests.find((item) => item.id === id);
    if (!current) return;
    const actual = viewMode === "fact";
    const step = source === "wheel" ? WHEEL_STEP_MINUTES : LIST_STEP_DAILY_MINUTES;
    if (actual) {
      bumpFact(id, dir, step);
      return;
    }
    const floor = floorFor(current, actual);
    const currentPrimary = primaryMinutes(current);
    const room = Math.max(0, DAY_MINUTES - used);
    const nextPrimary =
      source === "wheel"
        ? nextWheelMinutes(currentPrimary, dir, floor, MAX_MINUTES_PER_INTEREST - current.auxMinutes, room)
        : nextListMinutes(currentPrimary, dir, floor, MAX_MINUTES_PER_INTEREST - current.auxMinutes, room);
    if (nextPrimary == null) {
      if (
        dir < 0 &&
        (current.id === "sleep" || current.locked) &&
        currentPrimary <= floor
      ) {
        addToast(
          "warning",
          "Сон нельзя снизить",
          "Ниже 4 ч в сутки опустить сон нельзя.",
        );
      }
      if (dir > 0 && room < step) {
        addToast(
          "warning",
          "В сутках только 24 часа",
          "В этом дне больше нельзя добавить время. Чтобы поднять одну сферу, сначала уберите часы у другой.",
        );
      }
      return;
    }
    writeDayMinutes(id, nextPrimary + current.auxMinutes, current.auxMinutes);
  }

  function openTime(id: string) {
    if (viewMode === "feel") setTimeEditId(id);
    else setPeriodListId(id);
  }

  function savePeriodMinutes(minutes: number) {
    if (!periodEdit) return;
    const { interestId, periodId } = periodEdit;
    if (periodId === "new") {
      const result = addManualPeriod(store, viewDateKey, interestId, minutes);
      if (result.added === 0 && minutes > 0) {
        addToast(
          "warning",
          "В сутках только 24 часа",
          "Этот день заполнен. Чтобы поднять одну сферу, сначала уберите часы у другой.",
        );
      } else {
        commitFactStore(result.store);
      }
    } else {
      const nextMinutes = clampShareMinutes(store, viewDateKey, periodId, interestId, minutes);
      commitFactStore(
        patchDayPeriods(
          store,
          viewDateKey,
          setShareMinutes(dayPeriods(store, viewDateKey), periodId, interestId, nextMinutes),
        ),
      );
    }
    setPeriodEdit(null);
    setPeriodListId(null);
  }

  function addInterest() {
    const name = draft.trim();
    if (!name || interests.length >= MAX_INTERESTS) return;
    const existingId = [
      ...DAYS.map((day) => store.feelWeek[day.id]),
      ...Object.values(store.actualByDate),
    ]
      .flat()
      .find((item) => item.name === name)?.id;
    const id = existingId ?? `i-${seq}`;
    const created: Interest = { id, name, locked: false, minutes: 0, auxMinutes: 0 };
    if (!existingId) setSeq((n) => n + 1);
    setDraft("");

    if (viewMode === "feel") {
      setFeelDay([...interests, created]);
      return;
    }

    setStore((prev) => {
      const feelWeek = Object.fromEntries(
        DAYS.map((day) => {
          const items = prev.feelWeek[day.id];
          if (items.some((item) => item.id === id)) return [day.id, items];
          return [day.id, [...items, { ...created }]];
        }),
      ) as AppPersist["feelWeek"];
      const current = actualDayFor(prev.actualByDate, viewDateKey, feelWeek);
      return {
        ...prev,
        feelWeek,
        actualByDate: {
          ...prev.actualByDate,
          [viewDateKey]: clampDayMinutes(
            current.some((item) => item.id === id) ? current : [...current, created],
          ),
        },
      };
    });
  }

  function removeInterest(id: string) {
    const next = interests.filter((item) => item.id !== id || item.locked);
    if (viewMode === "feel") {
      setFeelDay(next);
      return;
    }
    const periods = dayPeriods(store, viewDateKey)
      .map((period) => ({
        ...period,
        shares: period.shares.filter((share) => share.interestId !== id),
      }))
      .filter((period) => period.shares.length > 0);
    commitStore((prev) =>
      patchDayPeriods(
        {
          ...prev,
          actualByDate: { ...prev.actualByDate, [viewDateKey]: next },
        },
        viewDateKey,
        periods,
      ),
    );
  }

  function renameInterest(id: string, name: string) {
    const nextName = name.trim();
    if (!nextName) return;
    const rename = (items: Interest[]) =>
      items.map((item) =>
        item.id === id && !item.locked ? { ...item, name: nextName } : item,
      );
    if (viewMode === "feel") {
      setFeelDay(rename(interests));
      return;
    }
    setStore((prev) => ({
      ...prev,
      feelWeek: Object.fromEntries(
        DAYS.map((day) => [day.id, rename(prev.feelWeek[day.id])]),
      ) as AppPersist["feelWeek"],
      actualByDate: Object.fromEntries(
        Object.entries(prev.actualByDate).map(([key, items]) => [key, rename(items)]),
      ),
    }));
  }

  function startTimer(interestId: string, secondaryId?: string | null) {
    const current = store.runningTimer ? normalizeRunningTimer(store.runningTimer) : null;
    if (current?.runningSince != null) {
      addToast("warning", "Таймер уже идёт", "Поставьте на паузу, если нужно сменить сферу.");
      return;
    }
    if (current && current.runningSince == null) {
      commitStore((prev) => ({
        ...prev,
        runningTimer: resumeRunningTimer(prev.runningTimer ?? current),
      }));
      return;
    }
    const extra =
      secondaryId &&
      secondaryId !== interestId &&
      !isSleepTimerId(interestId, timerSpheres) &&
      !isSleepTimerId(secondaryId, timerSpheres)
        ? secondaryId
        : null;
    commitStore((prev) => ({
      ...prev,
      runningTimer: startRunningTimer(interestId, todayKey, Date.now(), extra),
    }));
  }

  function pauseTimer() {
    const current = store.runningTimer ? normalizeRunningTimer(store.runningTimer) : null;
    if (!current || current.runningSince == null) return;
    commitStore((prev) => ({
      ...prev,
      runningTimer: pauseRunningTimer(prev.runningTimer ?? current),
    }));
  }

  function stopTimer() {
    const timer = store.runningTimer ? normalizeRunningTimer(store.runningTimer) : null;
    if (!timer) return;
    const now = Date.now();
    const minutes = Math.floor(timerElapsedMs(timer, now) / 60_000);
    if (minutes < 1) {
      commitStore((prev) => ({ ...prev, runningTimer: null }));
      addToast(
        "warning",
        "Меньше минуты",
        "Сессия короче минуты не записалась. Засеките ещё раз, когда сядете за дело.",
      );
      return;
    }
    const template = actualDayFor(store.actualByDate, timer.dateKey, store.feelWeek);
    const splitByDate = isSleepTimerId(timer.interestId, template);
    const chunks = allocateTimerMinutes(timer, now, splitByDate);
    const result = appendTimerPeriods(
      store,
      timer.interestId,
      timer.secondaryId,
      chunks,
    );
    commitStore(() => ({
      ...result.store,
      runningTimer: null,
    }));
    const primaryName =
      template.find((item) => item.id === timer.interestId)?.name ?? "сфера";
    const secondaryName = timer.secondaryId
      ? template.find((item) => item.id === timer.secondaryId)?.name
      : undefined;
    if (result.added === 0) {
      addToast(
        "warning",
        "В сутках только 24 часа",
        "Этот день уже заполнен. Сессия не записалась.",
      );
    } else if (result.added < result.asked) {
      addToast(
        "warning",
        "Записана часть времени",
        `Влезло только ${formatMinutes(result.added)} из ${formatMinutes(result.asked)}.`,
      );
    } else if (splitByDate && result.parts.length > 1) {
      addToast(
        "success",
        "Сон по суткам",
        result.parts
          .map((part) => `${formatMinutes(part.added)} — ${formatDateTitle(part.dateKey)}`)
          .join(". "),
      );
    } else if (secondaryName && result.auxAdded > 0) {
      addToast(
        "success",
        "Два занятия",
        `${formatMinutes(result.added)} — ${primaryName}, рядом ${secondaryName}.`,
      );
    }
  }

  async function saveBackup() {
    const payload = JSON.stringify(buildBackup(store), null, 2);
    const name = `koleso-balansa-${todayKey}.json`;
    const file = new File([payload], name, { type: "application/json" });
    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Колесо баланса",
          text: "Запасная копия данных",
        });
        addToast("success", "Файл готов", "Сохраните его в Файлы или отправьте себе.");
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.rel = "noopener";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    addToast("success", "Файл скачан", "Положите его в надёжное место — это запасная копия.");
  }

  function loadBackupFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        const next = parseBackup(parsed);
        if (!next) {
          addToast("danger", "Файл не подошёл", "Это не копия колеса баланса.");
          return;
        }
        allowWrite.current = true;
        commitStore(() => next);
        setMode(next.feelConfirmed ? "fact" : "feel");
        addToast("success", "Данные восстановлены", "Копия загружена на это устройство.");
      } catch {
        addToast("danger", "Файл не прочитался", "Выберите JSON, который скачали из приложения.");
      }
    };
    reader.readAsText(file);
  }

  function resetView() {
    if (viewMode === "feel") {
      commitStore((prev) => ({ ...prev, feelWeek: defaultWeek() }));
    } else {
      commitStore((prev) => {
        const nextActual = { ...prev.actualByDate };
        const nextPeriods = { ...prev.periodsByDate };
        delete nextActual[viewDateKey];
        delete nextPeriods[viewDateKey];
        return { ...prev, actualByDate: nextActual, periodsByDate: nextPeriods };
      });
    }
    setResetOpen(false);
  }

  const usageTotal = viewMode === "feel" || !isMobile ? WEEK_MINUTES : DAY_MINUTES;
  const usageUsed =
    viewMode === "feel" ? usedMinutesFeel : isMobile ? usedMinutesActualDay : usedMinutesActualWeek;
  const usageLabel = viewMode === "feel" || !isMobile ? "Неделя" : "Сегодня";
  const usageCapLabel =
    viewMode === "feel" || !isMobile ? `${WEEK_HOURS} ч` : `${DAY_HOURS} ч`;

  const lockViewport =
    store.feelConfirmed && (mobileTab === "timer" || mobileTab === "map");
  const showToolbar = !store.feelConfirmed || mobileTab !== "timer";
  const timeEdit = timeEditId
    ? interests.find((item) => item.id === timeEditId)
    : undefined;
  const periodListItem = periodListId
    ? interests.find((item) => item.id === periodListId)
    : undefined;
  const periodRows = periodListId
    ? periodsForInterest(dayPeriods(store, viewDateKey), periodListId)
    : [];
  const periodEditItem = periodEdit
    ? interests.find((item) => item.id === periodEdit.interestId)
    : undefined;
  const periodEditShare =
    periodEdit && periodEdit.periodId !== "new"
      ? periodShareFor(
          dayPeriods(store, viewDateKey).find((period) => period.id === periodEdit.periodId) ?? {
            id: "",
            source: "manual",
            shares: [],
          },
          periodEdit.interestId,
        )
      : undefined;
  const periodEditMinutes = periodEditShare?.minutes ?? 0;
  const periodEditMax =
    periodEdit && periodEdit.periodId !== "new"
      ? clampShareMinutes(
          store,
          viewDateKey,
          periodEdit.periodId,
          periodEdit.interestId,
          16 * HOUR_MINUTES,
        )
      : Math.min(
          MAX_MINUTES_PER_INTEREST - (periodEditItem?.minutes ?? 0),
          Math.max(0, DAY_MINUTES - dayUsedMinutes(interests)),
        );

  return (
    <div
      className={`shell${isMobile ? " shell-phone" : ""}${
        store.feelConfirmed ? " shell-nav" : ""
      }${lockViewport ? " shell-fit" : ""}`}
      style={
        isMobile
          ? {
              position: "fixed",
              top: viewFrame.top,
              left: viewFrame.left,
              width: viewFrame.width,
              height: viewFrame.height,
            }
          : undefined
      }
    >
    <div
      className={`page${lockViewport ? " page-fit" : ""}${
        store.feelConfirmed && mobileTab === "timer" ? " page-timer" : ""
      }`}
    >
      {showToolbar ? (
        <header className="mobile-toolbar">
          <div className="mobile-toolbar-text">
            <strong>Колесо баланса</strong>
            <span>
              {!store.feelConfirmed
                ? "Сферы интересов"
                : mobileTab === "calendar"
                  ? "Календарь"
                  : mobileTab === "data"
                    ? "Данные"
                    : formatDateTitle(viewDateKey)}
            </span>
          </div>
          {store.feelConfirmed && mobileTab === "map" ? (
            <button type="button" className="pill" onClick={() => setResetOpen(true)}>
              Сброс
            </button>
          ) : null}
        </header>
      ) : null}
      {introOpen ? (
        <div className="modal-backdrop" onClick={closeIntro}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="intro-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-body">
              <h1 id="intro-title">Колесо баланса с привязкой ко времени</h1>

              <h2>Два ключевых принципа</h2>
              <p>
                <strong>
                  Ничто не берётся из ниоткуда. Развивается только то, во что вы
                  вкладываете усилия.
                </strong>
              </p>
              <p>
                Обычные карты желаний отражают фантазии и самоощущение — не
                реальность. Результат в любой сфере достигается{" "}
                <strong>
                  постоянством приложенных усилий на длительном промежутке
                  времени
                </strong>
                .
              </p>

              <h2>Что это значит на практике</h2>
              <ul>
                <li>Не проводите время с любимым человеком — отношения не окрепнут.</li>
                <li>
                  Просидели на работе с 9 до 17, но всё это время пили чай,
                  листали ленту и смотрели в окно — не ждите повышения или
                  карьерного роста.{" "}
                  <strong>Значение имеет только концентрированное усилие.</strong>
                </li>
              </ul>

              <h2>Почему колесо привязано ко времени</h2>
              <p>
                Время — это независящий от вас ресурс. Вы не можете остановить
                время равно как не можете добавить часов в сутках.
              </p>
              <p>
                Каждый час, отданный одной сфере, забран у другой. Это и есть
                главный смысл колеса:{" "}
                <strong>
                  усилиться в одном можно только ценой просадки в другом.
                </strong>{" "}
                Нельзя усидеть на двух стульях — чем именно пожертвовать,
                решаете только вы.
              </p>

              <h2>Как работать с колесом</h2>
              <ol>
                <li>
                  Заполните колесо так, как <strong>вам кажется</strong> — как вы
                  распределяете своё время. Можно пропустить.
                </li>
                <li>
                  Дальше каждый день засекайте сферы секундомером: сели —
                  Старт, закончили — Стоп. Время пишется в сегодняшнюю дату.
                </li>
                <li>К концу недели колесо — это уже факт, не ощущение.</li>
              </ol>
              <p>
                Разница между первой версией и неделей с таймера — это и есть
                честная картина.
              </p>
              <p>
                <strong>Не занимайтесь самообманом.</strong>
              </p>
              <p>
                Чтобы открывать с телефона как приложение: в Safari «Поделиться» →
                «На экран Домой». Данные останутся в этом браузере. Перед обновлением
                сайта нажмите «Скачать файл» — так копия не потеряется.
              </p>

              <h2>Границы</h2>
              <ul>
                <li>
                  <strong>Сон обязателен.</strong> Ниже 4 часов в сутки опустить
                  нельзя. 8 часов — статистическая норма. Дальше всё
                  индивидуально: кому-то нужно больше, кому-то меньше.
                </li>
                <li>
                  <strong>Шаг шкалы на циферблате — приблизительно 1 час.</strong>
                </li>
                <li>
                  <strong>Шаг шкалы в списке сфер — 10 мин.</strong> Используйте
                  для тонкой настройки.
                </li>
                <li>
                  <strong>Шкала имеет предел.</strong> К 5-му уровню цвет уходит
                  в зелёный. Можно добавить часов, но шкала снова краснеет —
                  эффективность падает, баланс ломается.
                </li>
                <li>
                  <strong>Максимум 12 сфер</strong>, потому что нельзя дробить
                  бесконечно. 20 минут спорта — это не спорт. В то же время 20
                  минут ходьбы лучше, чем ничего. Важно понимать: распределив
                  время на всё сразу, результат не достигается ни в чём.
                </li>
              </ul>

              <h2>Когнитивный диссонанс</h2>
              <p>
                Многие сравнивают себя с другими и уходят в эмоциональное пике:
                «я мол вджобываю, а новая машина у соседа». Смотрите на вещи
                трезво. Хорошая фигура у фитоняшки в инстаграм потому, что это
                её профессия: всё свободное время она тратит на форму и на
                ведение блога. Она не менеджер среднего звена и не кассирша в
                пятерочке. Она сделала свой выбор в ущерб другим компетенциям и
                развивает целенаправленно только одно направление. Не вводите
                себя в заблуждение: ведение фитнес-блога — это фултайм работа.
                Другое дело, что для неё поход в зал — это тоже работа. В итоге
                2–3 часа в зале и 6–9 часов съёмок — это 9–12 часов рабочего дня
                по узкому направлению. Потому её блог и растёт.
              </p>
              <p>
                <strong>
                  Делать больше не равно хвататься за всё сразу или брать
                  непомерную ношу.
                </strong>{" "}
                Если один менеджер по продажам звонит клиентам
                4 часа в день, а другой 5, то в моменте разница в результате
                будет не заметна, но на дистанции месяца показатель выше, на
                дистанции года — звание лучшего менеджера и годовая премия. Но
                это не бесплатно: у него тоже 24 часа — значит, он украл время у
                других ниш: семья, отношения, здоровье.
              </p>

              <h2>Отдых — это не бездействие</h2>
              <p>Листать рилсы до утра — не сон. Смотреть сериалы перед сном — не отдых.</p>
              <p>
                Если задача не идёт, лучший отдых —{" "}
                <strong>смена занятия</strong>: переключитесь на бытовую задачу,
                которую всё равно нужно сделать (приготовить ужин, сходить за
                продуктами, принять душ). Такая задача не требует умственной
                нагрузки, выполняется почти автоматически — и после неё можно
                вернуться к основной работе. Так вы избежите потерь времени на
                фрустрацию или сведёте её к минимуму.
              </p>
            </div>
            <div className="modal-actions">
              <button type="button" className="pill" onClick={closeIntro}>
                Начать
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {timeEdit && viewMode === "feel" ? (
        <TimeEditModal
          name={timeEdit.name}
          dateLabel={formatDateTitle(viewDateKey)}
          minutes={timeEdit.minutes}
          minMinutes={floorFor(timeEdit, false)}
          maxMinutes={Math.min(
            MAX_MINUTES_PER_INTEREST,
            timeEdit.minutes + dayRoom,
          )}
          onCancel={() => setTimeEditId(null)}
          onSave={(minutes) => {
            setItemMinutes(timeEdit.id, minutes);
            setTimeEditId(null);
          }}
        />
      ) : null}

      {periodListItem && !periodEdit ? (
        <PeriodListModal
          name={periodListItem.name}
          dateLabel={formatDateTitle(viewDateKey)}
          periods={periodRows}
          interestId={periodListItem.id}
          spheres={interests}
          onClose={() => setPeriodListId(null)}
          onAdd={() =>
            setPeriodEdit({ interestId: periodListItem.id, periodId: "new" })
          }
          onPick={(periodId) =>
            setPeriodEdit({ interestId: periodListItem.id, periodId })
          }
        />
      ) : null}

      {periodEdit && periodEditItem ? (
        <TimeEditModal
          name={periodEditItem.name}
          dateLabel={
            periodEdit.periodId === "new"
              ? `${formatDateTitle(viewDateKey)} · новая запись`
              : formatDateTitle(viewDateKey)
          }
          minutes={periodEditMinutes}
          minMinutes={0}
          maxMinutes={Math.max(periodEditMinutes, periodEditMax)}
          onCancel={() => setPeriodEdit(null)}
          onSave={savePeriodMinutes}
        />
      ) : null}

      {resetOpen ? (
        <div className="modal-backdrop" onClick={() => setResetOpen(false)}>
          <div
            className="modal modal-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-body">
              <h2 id="reset-title">Сбросить этот день?</h2>
              <p>
                {viewMode === "feel"
                  ? "Сферы вернутся к стартовому набору."
                  : "Записанное время за этот день пропадёт с колеса."}
              </p>
            </div>
            <div className="modal-actions">
              <button type="button" className="pill ghost" onClick={() => setResetOpen(false)}>
                Отмена
              </button>
              <button type="button" className="pill" onClick={resetView}>
                Сбросить
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {viewMode === "feel" && !store.feelConfirmed ? (
        <section className="feel-banner">
          <p>
            Настройте сферы — это приоритеты, без часов. Время появится завтра
            с таймера. Можно пропустить.
          </p>
          <div className="feel-banner-actions">
            <button type="button" className="pill ghost" onClick={skipFeel}>
              Пропустить
            </button>
            <button type="button" className="pill" onClick={confirmFeel}>
              Дальше
            </button>
          </div>
        </section>
      ) : null}

      {viewMode === "feel" && !store.feelConfirmed ? (
        <InterestEditor
          interests={interests}
          roomMinutes={dayRoom}
          draft={draft}
          canAdd={canAdd}
          timerOnly={false}
          hideTime
          onDraft={setDraft}
          onAdd={addInterest}
          onBump={bump}
          onRemove={removeInterest}
          onRename={renameInterest}
        />
      ) : null}

      {store.feelConfirmed ? (
        <TimerPanel
          className={mobileTab !== "timer" ? "tab-hidden" : undefined}
          dateKey={todayKey}
          spheres={timerSpheres}
          runningId={running?.interestId ?? null}
          runningSecondaryId={running?.secondaryId ?? null}
          runningLabel={runningItem?.name}
          runningSecondaryLabel={runningSecondaryItem?.name}
          elapsed={formatElapsed(timerLive)}
          paused={timerPaused}
          onStart={startTimer}
          onPause={pauseTimer}
          onStop={stopTimer}
        />
      ) : null}

      <section className={`backup${mobileTab !== "data" ? " tab-hidden" : ""}`}>
        <div>
          <strong>Данные</strong>
          <p>
            Данные хранятся на этом устройстве. Обновление сайта сейв не сотрёт.
            Файл нужен, если почистите браузер или смените телефон.
          </p>
        </div>
        <div className="backup-actions">
          <button type="button" className="pill ghost backup-action" onClick={() => void saveBackup()}>
            <span className="backup-action-short">Скачать файл</span>
            <span className="backup-action-full">
              <span className="backup-action-icon" aria-hidden>
                <svg viewBox="0 0 24 24">
                  <path
                    d="M12 5v10M8.4 11.4 12 15l3.6-3.6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <path
                    d="M6 16.5v2.2h12v-2.2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                </svg>
              </span>
              <span className="backup-action-copy">
                <strong>Выгрузить копию</strong>
                <em>Сохранить JSON-файл со всеми записями</em>
              </span>
            </span>
          </button>
          <button
            type="button"
            className="pill backup-action backup-action-warn"
            onClick={() => fileInput.current?.click()}
          >
            <span className="backup-action-short">Загрузить</span>
            <span className="backup-action-full">
              <span className="backup-action-icon" aria-hidden>
                <svg viewBox="0 0 24 24">
                  <path
                    d="M12 19V9M8.4 12.6 12 9l3.6 3.6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <path
                    d="M6 7.5V5.3h12v2.2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                </svg>
              </span>
              <span className="backup-action-copy">
                <strong>Загрузить копию</strong>
                <em>Заменит текущие данные из файла. Текущие записи будут перезаписаны.</em>
              </span>
            </span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (
                !window.confirm(
                  "Загрузка заменит текущие данные на этом устройстве. Продолжить?",
                )
              ) {
                return;
              }
              loadBackupFile(file);
            }}
          />
        </div>
      </section>

      <section
        className={`calendar-panel${mobileTab !== "calendar" ? " tab-hidden" : ""}`}
      >
        <CalendarMonth
          year={calCursor.year}
          month={calCursor.month}
          selected={viewDateKey}
          today={todayKey}
          marked={Object.keys(store.actualByDate)}
          onPrev={() =>
            setCalCursor((prev) =>
              prev.month === 0
                ? { year: prev.year - 1, month: 11 }
                : { year: prev.year, month: prev.month - 1 },
            )
          }
          onNext={() =>
            setCalCursor((prev) =>
              prev.month === 11
                ? { year: prev.year + 1, month: 0 }
                : { year: prev.year, month: prev.month + 1 },
            )
          }
          onSelect={(key) => {
            setPickedDateKey(key);
            setPickedDayId(dateKeyToDayId(key));
            setMobileTab("map");
          }}
        />
      </section>

      {store.feelConfirmed ? (
        <section className={`stats${mobileTab !== "map" ? " tab-hidden" : ""}`} aria-label="Часы недели">
          <Stat value={`${WEEK_HOURS} ч`} label="Всего в неделе" />
          <Stat value={formatMinutes(weekUsedForStats)} label="Уже распределено" />
          <Stat
            value={formatMinutes(freeMinutes)}
            label="Ещё доступно"
            tone={freeMinutes === 0 ? "warning" : undefined}
          />
          <Stat
            value={formatMinutes(sleep.minutes)}
            label="Сон в сутки"
            tone={sleepLow ? "danger" : sleepHigh ? "warning" : "success"}
          />
          {work ? (
            <Stat
              value={formatMinutes(work.minutes)}
              label="Работа в сутки"
              tone={workHigh ? "danger" : work.minutes >= WORK_NORM_MINUTES ? "success" : undefined}
            />
          ) : null}
        </section>
      ) : null}

      {store.feelConfirmed ? (
        <div className={mobileTab !== "map" ? "tab-hidden" : undefined}>
          <UsageBar
            usedMinutes={usageUsed}
            totalMinutes={usageTotal}
            label={usageLabel}
            capLabel={usageCapLabel}
          />
        </div>
      ) : null}

      {store.feelConfirmed ? (
        <div className={`layout${mobileTab !== "map" ? " tab-hidden" : ""}`}>
          <section className="map-panel">
            <div className="map-head">
              <h2>Колесо дня</h2>
              <div className="map-actions">
                {store.feelConfirmed && !store.feelSkipped && !isMobile ? (
                  <button
                    type="button"
                    className="pill ghost"
                    onClick={() => setMode(viewMode === "feel" ? "fact" : "feel")}
                  >
                    {viewMode === "feel" ? "К факту" : "Как чувствую"}
                  </button>
                ) : null}
                <button type="button" className="pill" onClick={() => setResetOpen(true)}>
                  Сброс
                </button>
              </div>
            </div>
            <p className="date-line">{formatDateTitle(viewDateKey)}</p>
            <div className="wheel-slot">
              <BalanceWheel
                interests={interests}
                roomMinutes={dayRoom}
                timerOnly={viewMode === "fact"}
                onBump={bump}
                onRename={renameInterest}
                onEditTime={openTime}
              />
            </div>
            <div className="legend-block">
              <p className="legend-lead">
                Сетка: 10 уровней от центра (0 ч) к внешней окружности (максимум
                времени).
              </p>
              <div className="legend">
                <span>
                  <i className="swatch" style={{ background: palette.red }} />
                  0 уровень — недосып / фрустрация
                </span>
                <span>
                  <i className="swatch" style={{ background: palette.green }} />
                  5 уровень — норма
                </span>
                <span>
                  <i className="swatch" style={{ background: palette.red }} />
                  10 уровень — пересып / переработка
                </span>
              </div>
              <p className="legend-note">
                От 5-го уровня шкала снова краснеет: избыток сна ведёт к
                недомоганию. Переработка ведёт к выгоранию и потере
                производительности.
              </p>
              <p className="legend-note">
                И так в любой сфере: нельзя решить проблему, просто посвятив ей
                всё время.
              </p>
              <p className="legend-note">
                Следует руководствоваться принципом разумной достаточности:
                результат растёт, пока соблюдается баланс пропорции «эффективность
                / время», пока польза от добавленного времени всё ещё больше потерь
                от утраты эффективности.
              </p>
            </div>
          </section>
        </div>
      ) : null}

      <section className="table-panel">
        <h2>
          {viewMode === "feel"
            ? "Таблица распределения времени по сферам"
            : "Факт за неделю"}
        </h2>
        <InterestTable interests={weeklyInterests} />
      </section>

      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <aside
            key={toast.id}
            className={`toast ${toast.tone}`}
            onClick={() =>
              setToasts((prev) => prev.filter((item) => item.id !== toast.id))
            }
          >
            <strong>{toast.title}</strong>
            <p>{toast.body}</p>
          </aside>
        ))}
      </div>
    </div>
      {store.feelConfirmed ? (
        <nav className="tabbar" aria-label="Разделы">
          <TabButton
            id="map"
            label="Баланс"
            active={mobileTab === "map"}
            onClick={() => setMobileTab("map")}
          />
          <TabButton
            id="timer"
            label="Таймер"
            active={mobileTab === "timer"}
            onClick={() => setMobileTab("timer")}
          />
          <TabButton
            id="calendar"
            label="Календарь"
            active={mobileTab === "calendar"}
            onClick={() => setMobileTab("calendar")}
          />
          <TabButton
            id="data"
            label="Данные"
            active={mobileTab === "data"}
            onClick={() => setMobileTab("data")}
          />
        </nav>
      ) : null}
    </div>
  );
}

function TimerPanel({
  className,
  dateKey,
  spheres,
  runningId,
  runningSecondaryId,
  runningLabel,
  runningSecondaryLabel,
  elapsed,
  paused,
  onStart,
  onPause,
  onStop,
}: {
  className?: string;
  dateKey: DateKey;
  spheres: Interest[];
  runningId: string | null;
  runningSecondaryId: string | null;
  runningLabel?: string;
  runningSecondaryLabel?: string;
  elapsed: string;
  paused: boolean;
  onStart: (id: string, secondaryId?: string | null) => void;
  onPause: () => void;
  onStop: () => void;
}) {
  const fallbackId = spheres.find((item) => item.id === "work")?.id ?? spheres[0]?.id ?? "";
  const [userPickedId, setUserPickedId] = useState(fallbackId);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [secondaryId, setSecondaryId] = useState<string | null>(null);
  const pickedId = spheres.some((item) => item.id === userPickedId)
    ? userPickedId
    : fallbackId;
  const startPrimary = primaryId ?? pickedId;
  const startSecondary = primaryId ? secondaryId : null;
  const selected = spheres.find((item) => item.id === startPrimary);
  const locked = runningId != null;
  const pairLabel = [runningLabel, runningSecondaryLabel].filter(Boolean).join(" + ");

  useEffect(() => {
    if (!runningId) return;
    setPrimaryId(runningId);
    setSecondaryId(runningSecondaryId);
  }, [runningId, runningSecondaryId]);

  function toggleMark(id: string) {
    if (locked) return;
    setUserPickedId(id);
    if (id === primaryId) {
      setPrimaryId(secondaryId);
      setSecondaryId(null);
      return;
    }
    if (id === secondaryId) {
      setSecondaryId(null);
      return;
    }
    if (!primaryId) {
      setPrimaryId(id);
      return;
    }
    if (isSleepTimerId(id, spheres) || isSleepTimerId(primaryId, spheres)) {
      setPrimaryId(id);
      setSecondaryId(null);
      return;
    }
    setSecondaryId(id);
  }

  return (
    <section className={`timer${className ? ` ${className}` : ""}`} aria-label="Секундомер">
      <div className="timer-stage">
        <div className="timer-above">
          <p className="timer-date">{formatDateTitle(dateKey)}</p>
          <SphereDrum
            spheres={spheres}
            value={pickedId}
            disabled={locked}
            primaryId={runningId ?? primaryId}
            secondaryId={runningId ? runningSecondaryId : secondaryId}
            onChange={setUserPickedId}
            onToggle={toggleMark}
          />
        </div>
        <p className="timer-time" aria-live="polite">
          {elapsed}
        </p>
        <div className="timer-below">
          {runningId && pairLabel ? (
            <p className="timer-running">
              {paused ? `Пауза: ${pairLabel}` : `Идёт: ${pairLabel}`}
            </p>
          ) : null}
          <div className="timer-actions">
            {runningId && !paused ? (
              <button type="button" className="pill timer-btn" onClick={onPause}>
                Пауза
              </button>
            ) : (
              <button
                type="button"
                className="pill timer-btn"
                disabled={!selected}
                onClick={() => selected && onStart(selected.id, startSecondary)}
              >
                Старт
              </button>
            )}
            {runningId && paused ? (
              <button type="button" className="pill ghost timer-btn" onClick={onStop}>
                Стоп
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

const DRUM_ITEM = 44;
const DRUM_BAND = DRUM_ITEM * 2;
const DRUM_COPIES = 3;

function wrapIndex(index: number, length: number) {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

function ValueDrum<T extends string | number>({
  items,
  value,
  disabled = false,
  loop = false,
  ariaLabel,
  format,
  mark,
  readRef,
  onChange,
  onItemClick,
}: {
  items: readonly T[];
  value: T;
  disabled?: boolean;
  loop?: boolean;
  ariaLabel: string;
  format?: (item: T) => ReactNode;
  mark?: (item: T) => "primary" | "secondary" | null;
  readRef?: MutableRefObject<(() => T) | null>;
  onChange: (value: T) => void;
  onItemClick?: (value: T) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const snapTimer = useRef<number | null>(null);
  const jumping = useRef(false);
  const lastEmitted = useRef(value);
  const key = items.join("|");
  const label = format ?? ((item: T) => String(item));
  const count = items.length;
  const looping = loop && count > 1;
  const copies = looping ? DRUM_COPIES : 1;
  const midCopy = looping ? 1 : 0;

  function indexOfValue() {
    return Math.max(0, items.indexOf(value));
  }

  function topFor(index: number, copy = midCopy) {
    const row = (copy * count + index) * DRUM_ITEM;
    return looping ? row - DRUM_BAND : row;
  }

  function indexFromScroll(scrollTop: number) {
    const raw = looping
      ? Math.round((scrollTop + DRUM_BAND) / DRUM_ITEM)
      : Math.round(scrollTop / DRUM_ITEM);
    return looping ? wrapIndex(raw, count) : Math.max(0, Math.min(count - 1, raw));
  }

  function rawFromScroll(scrollTop: number) {
    return looping
      ? Math.round((scrollTop + DRUM_BAND) / DRUM_ITEM)
      : Math.round(scrollTop / DRUM_ITEM);
  }

  function readValue(): T {
    const node = listRef.current;
    if (!node || count === 0) return lastEmitted.current;
    const next = items[indexFromScroll(node.scrollTop)];
    return next ?? lastEmitted.current;
  }

  function emit(index: number) {
    const next = items[index];
    if (next === undefined || next === lastEmitted.current) return;
    lastEmitted.current = next;
    onChange(next);
  }

  function jumpTo(node: HTMLDivElement, index: number, copy = midCopy) {
    jumping.current = true;
    const snap = node.style.scrollSnapType;
    node.style.scrollSnapType = "none";
    node.scrollTop = topFor(index, copy);
    node.style.scrollSnapType = snap;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        jumping.current = false;
      });
    });
  }

  useLayoutEffect(() => {
    const node = listRef.current;
    if (!node || count === 0) return;
    jumpTo(node, indexOfValue());
    lastEmitted.current = value;
  }, [key]);

  useEffect(() => {
    if (readRef) readRef.current = readValue;
    return () => {
      if (readRef) readRef.current = null;
    };
  });

  useEffect(() => {
    if (lastEmitted.current === value) return;
    lastEmitted.current = value;
    const node = listRef.current;
    if (!node || count === 0) return;
    node.scrollTo({ top: topFor(indexOfValue()), behavior: "smooth" });
  }, [value]);

  function snapTo(raw: number) {
    const node = listRef.current;
    if (!node || count === 0) return;
    const index = looping ? wrapIndex(raw, count) : Math.max(0, Math.min(count - 1, raw));
    emit(index);
    if (!looping) {
      node.scrollTo({ top: topFor(index, 0), behavior: "smooth" });
      return;
    }
    const copy = Math.floor(Math.max(0, raw) / count);
    if (copy !== midCopy) jumpTo(node, index);
    else node.scrollTo({ top: topFor(index), behavior: "smooth" });
  }

  const rows: Array<{ item: T; itemIndex: number; copy: number; key: string }> = [];
  for (let copy = 0; copy < copies; copy += 1) {
    items.forEach((item, itemIndex) => {
      rows.push({ item, itemIndex, copy, key: `${copy}:${itemIndex}:${String(item)}` });
    });
  }

  return (
    <div className={`drum${disabled ? " locked" : ""}`} aria-label={ariaLabel}>
      <div className="drum-shade drum-shade-top" />
      <div className="drum-shade drum-shade-bottom" />
      <div className="drum-band" />
      <div
        ref={listRef}
        className={`drum-list${looping ? " drum-loop" : ""}`}
        onScroll={() => {
          if (disabled || jumping.current) return;
          const node = listRef.current;
          if (!node || count === 0) return;
          const raw = rawFromScroll(node.scrollTop);
          const index = looping ? wrapIndex(raw, count) : Math.max(0, Math.min(count - 1, raw));
          emit(index);
          if (looping && (raw < count || raw >= count * 2)) jumpTo(node, index);
          if (snapTimer.current != null) window.clearTimeout(snapTimer.current);
          snapTimer.current = window.setTimeout(() => snapTo(raw), 90);
        }}
      >
        {looping ? null : <div className="drum-pad" />}
        {rows.map((row) => {
          const role = mark?.(row.item) ?? null;
          return (
            <button
              key={row.key}
              type="button"
              className={`drum-item${row.item === value ? " active" : ""}${
                role ? ` drum-item-${role}` : ""
              }`}
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                onItemClick?.(row.item);
                emit(row.itemIndex);
                const node = listRef.current;
                if (node) jumpTo(node, row.itemIndex);
              }}
            >
              {label(row.item)}
              {role === "primary" ? (
                <span className="drum-mark" aria-hidden>
                  ✓
                </span>
              ) : null}
              {role === "secondary" ? (
                <span className="drum-mark drum-mark-double" aria-hidden>
                  ✓✓
                </span>
              ) : null}
            </button>
          );
        })}
        {looping ? null : <div className="drum-pad" />}
      </div>
    </div>
  );
}

function SphereDrum({
  spheres,
  value,
  disabled,
  primaryId,
  secondaryId,
  onChange,
  onToggle,
}: {
  spheres: Interest[];
  value: string;
  disabled: boolean;
  primaryId: string | null;
  secondaryId: string | null;
  onChange: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  return (
    <ValueDrum
      items={spheres.map((item) => item.id)}
      value={value}
      disabled={disabled}
      loop
      ariaLabel="Сфера"
      format={(id) => spheres.find((item) => item.id === id)?.name ?? id}
      mark={(id) => (id === primaryId ? "primary" : id === secondaryId ? "secondary" : null)}
      onChange={onChange}
      onItemClick={onToggle}
    />
  );
}

function rangeInts(from: number, to: number): number[] {
  const list: number[] = [];
  for (let n = from; n <= to; n += 1) list.push(n);
  return list;
}

function periodRowHint(
  period: DayPeriod,
  interestId: string,
  spheres: Interest[],
): string {
  const others = period.shares
    .filter((share) => share.interestId !== interestId)
    .map((share) => spheres.find((item) => item.id === share.interestId)?.name)
    .filter((name): name is string => Boolean(name));
  const bits: string[] = [];
  if (others.length > 0) bits.push(`вместе с ${others.join(", ")}`);
  bits.push(period.source === "timer" ? "секундомер" : "вручную");
  return bits.join(" · ");
}

function PeriodListModal({
  name,
  dateLabel,
  periods,
  interestId,
  spheres,
  onClose,
  onAdd,
  onPick,
}: {
  name: string;
  dateLabel: string;
  periods: DayPeriod[];
  interestId: string;
  spheres: Interest[];
  onClose: () => void;
  onAdd: () => void;
  onPick: (periodId: string) => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-periods"
        role="dialog"
        aria-modal="true"
        aria-labelledby="period-list-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-body">
          <h2 id="period-list-title">{name}</h2>
          <p>{dateLabel}</p>
          {periods.length === 0 ? (
            <p>Пока нет записей за этот день. Можно указать время вручную.</p>
          ) : (
            <ul className="period-list">
              {periods.map((period) => {
                const share = periodShareFor(period, interestId);
                if (!share) return null;
                return (
                  <li key={period.id}>
                    <button
                      type="button"
                      className="period-row"
                      onClick={() => onPick(period.id)}
                    >
                      <strong>{formatMinutes(share.minutes)}</strong>
                      <span>{periodRowHint(period, interestId, spheres)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="pill ghost" onClick={onClose}>
            Закрыть
          </button>
          <button type="button" className="pill" onClick={onAdd}>
            Добавить
          </button>
        </div>
      </div>
    </div>
  );
}

function TimeEditModal({
  name,
  dateLabel,
  minutes,
  minMinutes,
  maxMinutes,
  onCancel,
  onSave,
}: {
  name: string;
  dateLabel: string;
  minutes: number;
  minMinutes: number;
  maxMinutes: number;
  onCancel: () => void;
  onSave: (minutes: number) => void;
}) {
  const cap = Math.max(minMinutes, maxMinutes);
  const minH = Math.floor(minMinutes / HOUR_MINUTES);
  const maxH = Math.floor(cap / HOUR_MINUTES);
  const hourItems = useMemo(() => rangeInts(minH, maxH), [minH, maxH]);
  const [hours, setHours] = useState(() =>
    Math.min(maxH, Math.max(minH, Math.floor(minutes / HOUR_MINUTES))),
  );
  const minuteItems = useMemo(() => {
    const start = hours === minH ? minMinutes - minH * HOUR_MINUTES : 0;
    const end = hours === maxH ? cap - maxH * HOUR_MINUTES : HOUR_MINUTES - 1;
    return rangeInts(start, end);
  }, [hours, minH, maxH, minMinutes, cap]);
  const [mins, setMins] = useState(() => minutes % HOUR_MINUTES);
  const hourRead = useRef<(() => number) | null>(null);
  const minRead = useRef<(() => number) | null>(null);

  useEffect(() => {
    if (!minuteItems.includes(mins)) setMins(minuteItems[0] ?? 0);
  }, [minuteItems, mins]);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal modal-time"
        role="dialog"
        aria-modal="true"
        aria-labelledby="time-edit-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-body">
          <h2 id="time-edit-title">{name}</h2>
          <p>{dateLabel}</p>
          <div className="time-edit-drums">
            <div className="time-edit-col">
              <ValueDrum
                items={hourItems}
                value={hours}
                loop
                ariaLabel="Часы"
                readRef={hourRead}
                onChange={setHours}
              />
              <span>ч</span>
            </div>
            <span className="time-edit-colon" aria-hidden="true">
              :
            </span>
            <div className="time-edit-col">
              <ValueDrum
                items={minuteItems}
                value={mins}
                loop
                ariaLabel="Минуты"
                format={(item) => String(item).padStart(2, "0")}
                readRef={minRead}
                onChange={setMins}
              />
              <span>мин</span>
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="pill ghost" onClick={onCancel}>
            Отмена
          </button>
          <button
            type="button"
            className="pill"
            onClick={() => {
              const nextHours = hourRead.current?.() ?? hours;
              const nextMins = minRead.current?.() ?? mins;
              onSave(nextHours * HOUR_MINUTES + nextMins);
            }}
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}

function CalendarMonth({
  year,
  month,
  selected,
  today,
  marked,
  onPrev,
  onNext,
  onSelect,
}: {
  year: number;
  month: number;
  selected: DateKey;
  today: DateKey;
  marked: string[];
  onPrev: () => void;
  onNext: () => void;
  onSelect: (key: DateKey) => void;
}) {
  const cells = monthCells(year, month);
  const marks = new Set(marked);

  return (
    <section className="calendar" aria-label="Календарь">
      <div className="calendar-head">
        <button type="button" className="pill ghost" onClick={onPrev}>
          ←
        </button>
        <strong>{formatMonthTitle(year, month)}</strong>
        <button type="button" className="pill ghost" onClick={onNext}>
          →
        </button>
      </div>
      <div className="calendar-weekdays">
        {DAYS.map((day) => (
          <span key={day.id}>{day.short}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {cells.map((cell, index) =>
          cell.dateKey ? (
            <button
              key={cell.dateKey}
              type="button"
              className={`calendar-day${cell.dateKey === selected ? " selected" : ""}${cell.dateKey === today ? " today" : ""}${marks.has(cell.dateKey) ? " marked" : ""}`}
              onClick={() => onSelect(cell.dateKey!)}
            >
              {cell.day}
            </button>
          ) : (
            <span key={`empty-${index}`} className="calendar-day empty" />
          ),
        )}
      </div>
    </section>
  );
}

function TabButton({
  id,
  label,
  active,
  onClick,
}: {
  id: MobileTab;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`tabbar-btn${active ? " active" : ""}`}
      onClick={onClick}
    >
      <TabIcon id={id} />
      <span>{label}</span>
    </button>
  );
}

function TabIcon({ id }: { id: MobileTab }) {
  if (id === "map") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      </svg>
    );
  }
  if (id === "timer") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="13" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M9 4.5h6" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 13V9.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (id === "calendar") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <rect x="4" y="5.5" width="16" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M4 10h16M8 4v3.2M16 4v3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <ellipse cx="12" cy="6.5" rx="7" ry="2.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M5 6.5v11c0 1.35 3.13 2.4 7 2.4s7-1.05 7-2.4v-11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M5 12c0 1.35 3.13 2.4 7 2.4s7-1.05 7-2.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function Stat({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone?: "danger" | "warning" | "success";
}) {
  return (
    <div className={`stat${tone ? ` ${tone}` : ""}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function UsageBar({
  usedMinutes,
  totalMinutes,
  label,
  capLabel,
}: {
  usedMinutes: number;
  totalMinutes: number;
  label: string;
  capLabel: string;
}) {
  const restMinutes = Math.max(0, totalMinutes - usedMinutes);
  return (
    <div className="usage">
      <div className="usage-labels">
        <span>{label}</span>
        <span>
          {formatMinutes(usedMinutes)} / {capLabel}
        </span>
      </div>
      <div
        className="usage-track"
        role="meter"
        aria-label="Распределённые часы"
        aria-valuemin={0}
        aria-valuemax={totalMinutes}
        aria-valuenow={usedMinutes}
      >
        <span className="usage-fill" style={{ flexGrow: usedMinutes }} />
        <span className="usage-rest" style={{ flexGrow: restMinutes }} />
      </div>
    </div>
  );
}

function BalanceWheel({
  interests,
  roomMinutes,
  timerOnly,
  onBump,
  onRename,
  onEditTime,
}: {
  interests: Interest[];
  roomMinutes: number;
  timerOnly: boolean;
  onBump: (id: string, dir: 1 | -1, source: "wheel" | "list") => void;
  onRename: (id: string, name: string) => void;
  onEditTime: (id: string) => void;
}) {
  const count = interests.length;

  const points = useMemo(
    () =>
      interests.map((item, index) => {
        const r = (item.minutes / MAX_MINUTES_PER_INTEREST) * MAX_R;
        return { ...polar(index, count, r), item };
      }),
    [interests, count],
  );

  const path = closedCurve(points);

  return (
    <div className="wheel">
      <svg viewBox={`0 0 ${VIEW} ${VIEW}`} role="img" aria-label="Колесо баланса интересов за выбранный день">
        <defs>
          <clipPath id="wheel-fill-clip">
            <path d={path} />
          </clipPath>
        </defs>
        <g clipPath="url(#wheel-fill-clip)">
          {Array.from({ length: RING_COUNT }, (_, i) => {
            const ring = RING_COUNT - i;
            return (
              <circle
                key={`fill-${ring}`}
                cx={CX}
                cy={CY}
                r={(ring / RING_COUNT) * MAX_R}
                fill={colorAtLevel(ring)}
                fillOpacity={0.78}
              />
            );
          })}
        </g>
        {Array.from({ length: RING_COUNT }, (_, i) => {
          const ring = i + 1;
          return (
            <circle
              key={`grid-${ring}`}
              cx={CX}
              cy={CY}
              r={(ring / RING_COUNT) * MAX_R}
              fill="none"
              stroke={palette.line}
              strokeWidth={1}
              opacity={0.7}
            />
          );
        })}
        <line
          x1={CX}
          y1={CY - MAX_R}
          x2={CX}
          y2={CY + MAX_R}
          stroke={palette.line}
          strokeWidth={1}
          opacity={0.45}
        />
        <line
          x1={CX - MAX_R}
          y1={CY}
          x2={CX + MAX_R}
          y2={CY}
          stroke={palette.line}
          strokeWidth={1}
          opacity={0.45}
        />
        {count >= 1 ? (
          <path
            d={path}
            fill="none"
            stroke={palette.stroke}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        ) : null}
        {points.map((point) => (
          <circle
            key={point.item.id}
            cx={point.x}
            cy={point.y}
            r={point.item.locked ? 8 : 6}
            fill={toneForInterest(point.item)}
            stroke={palette.paper}
            strokeWidth={2}
          />
        ))}
        <circle cx={CX} cy={CY} r={3} fill={palette.faint} />
      </svg>

      {interests.map((item, index) => {
        const pos = polar(index, count, LABEL_R);
        const plusOff =
          item.minutes >= MAX_MINUTES_PER_INTEREST ||
          roomMinutes < WHEEL_STEP_MINUTES;
        const minusOff = item.minutes <= floorFor(item, timerOnly);
        const hideBtns = timerOnly && !isSleepInterest(item);
        return (
          <div
            key={item.id}
            className={`spoke${isSleepInterest(item) ? " spoke-sleep" : ""}`}
            style={{
              left: `${(pos.x / VIEW) * 100}%`,
              top: `${(pos.y / VIEW) * 100}%`,
            }}
          >
            <SpokeName
              item={item}
              onRename={onRename}
              onTap={() => onEditTime(item.id)}
            />
            <button
              type="button"
              className="spoke-time"
              onClick={() => onEditTime(item.id)}
            >
              {formatMinutes(item.minutes)}
            </button>
            {hideBtns ? null : (
              <div className="spoke-btns">
                <button
                  type="button"
                  className="icon-btn"
                  title={
                    minusOff && (item.id === "sleep" || item.locked) && !timerOnly
                      ? "Сон нельзя снизить ниже 4 ч в сутки"
                      : `Убавить: ${item.name}`
                  }
                  disabled={minusOff}
                  onClick={() => onBump(item.id, -1, "wheel")}
                >
                  −
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title={
                    plusOff && roomMinutes < WHEEL_STEP_MINUTES
                      ? "В сутках только 24 часа"
                      : `Добавить: ${item.name}`
                  }
                  disabled={plusOff}
                  onClick={() => onBump(item.id, 1, "wheel")}
                >
                  +
                </button>
              </div>
            )}
          </div>
        );
      })}
      <span className="wheel-step">шаг 1 ч.</span>
    </div>
  );
}

function resetViewportZoom() {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  const restore =
    meta.getAttribute("content") ??
    "width=device-width, initial-scale=1.0, viewport-fit=cover";
  meta.setAttribute(
    "content",
    "width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover",
  );
  window.scrollTo(0, 0);
  window.setTimeout(() => {
    meta.setAttribute("content", restore);
  }, 320);
}

function SpokeName({
  item,
  onRename,
  onTap,
}: {
  item: Interest;
  onRename: (id: string, name: string) => void;
  onTap?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.name);
  const timer = useRef<number | null>(null);
  const skipClick = useRef(false);

  useEffect(() => {
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    };
  }, []);

  function clearTimer() {
    if (timer.current == null) return;
    window.clearTimeout(timer.current);
    timer.current = null;
  }

  function startEdit() {
    if (item.locked) return;
    skipClick.current = true;
    setDraft(item.name);
    setEditing(true);
  }

  function finishEdit(save: boolean) {
    if (save) onRename(item.id, draft);
    setEditing(false);
    window.setTimeout(resetViewportZoom, 50);
  }

  function commit() {
    finishEdit(true);
  }

  if (editing) {
    return (
      <div className="spoke-label">
        <input
          className="spoke-input"
          value={draft}
          autoFocus
          aria-label={`Переименовать: ${item.name}`}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              finishEdit(false);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="spoke-label">
      <strong
        className={item.locked ? undefined : "spoke-name"}
        style={{ color: toneForInterest(item) }}
        title={item.locked ? "Нажмите, чтобы изменить время" : "Нажмите — время, удерживайте — имя"}
        onClick={() => {
          if (skipClick.current) {
            skipClick.current = false;
            return;
          }
          onTap?.();
        }}
        onPointerDown={() => {
          if (item.locked) return;
          clearTimer();
          timer.current = window.setTimeout(() => {
            timer.current = null;
            startEdit();
          }, 480);
        }}
        onPointerUp={clearTimer}
        onPointerLeave={clearTimer}
        onPointerCancel={clearTimer}
        onContextMenu={(event) => {
          if (item.locked) return;
          event.preventDefault();
        }}
      >
        {item.name}
      </strong>
    </div>
  );
}

function InterestEditor({
  interests,
  roomMinutes,
  draft,
  canAdd,
  timerOnly,
  hideTime,
  onDraft,
  onAdd,
  onBump,
  onRemove,
  onRename,
}: {
  interests: Interest[];
  roomMinutes: number;
  draft: string;
  canAdd: boolean;
  timerOnly: boolean;
  hideTime?: boolean;
  onDraft: (value: string) => void;
  onAdd: () => void;
  onBump: (id: string, dir: 1 | -1, source: "wheel" | "list") => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  function commitRename(id: string) {
    onRename(id, editName);
    setEditingId(null);
  }

  return (
    <aside className="editor">
      <div className="editor-head">
        <div className="editor-title">
          <h2>Сферы интересов</h2>
          <span className="info-tip">
            <button
              type="button"
              className="info-btn"
              aria-label="О сферах интересов"
              aria-describedby="zones-hint"
            >
              i
            </button>
            <span id="zones-hint" role="tooltip" className="info-pop">
              До 12 сфер включая сон. Чтобы добавить свою сферу — удалите или
              переименуйте существующую. Для переименования наведите и
              удерживайте курсор на названии сферы.
            </span>
          </span>
        </div>
        <span>
          {interests.length} / {MAX_INTERESTS}
        </span>
      </div>
      <form
        className="add-row"
        onSubmit={(event) => {
          event.preventDefault();
          onAdd();
        }}
      >
        <input
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
          placeholder="Название сферы"
          disabled={!canAdd}
        />
        <button type="submit" disabled={!canAdd || !draft.trim()}>
          Добавить
        </button>
      </form>
      <ul className="interest-list">
        {interests.map((item) => {
          const sleepItem = isSleepInterest(item);
          const manualOff = timerOnly && !sleepItem;
          return (
            <li key={item.id}>
              <div className="interest-name">
                {item.locked ? (
                  <strong>{item.name}</strong>
                ) : editingId === item.id ? (
                  <input
                    className="name-input"
                    value={editName}
                    autoFocus
                    aria-label={`Переименовать: ${item.name}`}
                    onChange={(event) => setEditName(event.target.value)}
                    onBlur={() => commitRename(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitRename(item.id);
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setEditingId(null);
                      }
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="name-btn"
                    title="Переименовать"
                    onClick={() => {
                      setEditingId(item.id);
                      setEditName(item.name);
                    }}
                  >
                    {item.name}
                  </button>
                )}
                {item.locked ? null : (
                  <button
                    type="button"
                    className="text-btn"
                    title={`Удалить: ${item.name}`}
                    onClick={() => onRemove(item.id)}
                  >
                    ×
                  </button>
                )}
              </div>
              {hideTime ? null : (
              <div className="interest-row">
                <button
                  type="button"
                  className="icon-btn"
                  title={
                    manualOff
                      ? "Засеките время таймером"
                      : item.minutes <= floorFor(item, timerOnly) &&
                          (item.id === "sleep" || item.locked)
                        ? "Сон нельзя снизить ниже 4 ч в сутки"
                        : "Убавить: 10 мин."
                  }
                  disabled={manualOff || item.minutes <= floorFor(item, timerOnly)}
                  onClick={() => onBump(item.id, -1, "list")}
                >
                  −
                </button>
                <span>
                  уровень {levelValue(item.minutes)} / {RING_COUNT}
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  title={
                    manualOff
                      ? "Засеките время таймером"
                      : roomMinutes < LIST_STEP_DAILY_MINUTES
                        ? "В сутках только 24 часа"
                        : "Добавить: 10 мин."
                  }
                  disabled={
                    manualOff ||
                    item.minutes >= MAX_MINUTES_PER_INTEREST ||
                    roomMinutes < LIST_STEP_DAILY_MINUTES
                  }
                  onClick={() => onBump(item.id, 1, "list")}
                >
                  +
                </button>
                <em>{formatMinutes(item.minutes)}</em>
              </div>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function InterestTable({ interests }: { interests: Interest[] }) {
  const rows = interests.flatMap((item) => {
    const primary = primaryMinutes(item);
    const list: Array<{
      key: string;
      item: Interest;
      minutes: number;
      role: "основное" | "вспомогательное";
    }> = [
      {
        key: `${item.id}-primary`,
        item,
        minutes: primary,
        role: "основное",
      },
    ];
    if (item.auxMinutes > 0) {
      list.push({
        key: `${item.id}-aux`,
        item,
        minutes: item.auxMinutes,
        role: "вспомогательное",
      });
    }
    return list;
  });

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Сфера</th>
            <th>Уровень</th>
            <th>В неделю</th>
            <th>В сутки</th>
            <th>Тип</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const slice = { ...row.item, minutes: row.minutes };
            return (
              <tr key={row.key}>
                <td style={{ borderLeft: `3px solid ${weekToneForInterest(slice)}` }}>
                  {row.item.name}
                </td>
                <td>{weekLevelValue(row.minutes)}</td>
                <td>{formatMinutes(row.minutes)}</td>
                <td>{formatMinutes(dailyMinutes(row.minutes))}</td>
                <td>{row.role}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
