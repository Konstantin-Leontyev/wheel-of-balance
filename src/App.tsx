import { useEffect, useMemo, useRef, useState } from "react";
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
  applyMinutesByDates,
  actualDayFor,
  aggregateWeek,
  buildBackup,
  clampDayMinutes,
  closedCurve,
  colorAtLevel,
  dailyMinutes,
  dateKeyToDayId,
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
  pauseRunningTimer,
  resumeRunningTimer,
  startRunningTimer,
  parseBackup,
  palette,
  parseDateKey,
  polar,
  levelValue,
  sanitizeWeek,
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

function emptyStore(): AppPersist {
  return {
    feelWeek: defaultWeek(),
    actualByDate: {},
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
  const [mobileTab, setMobileTab] = useState<"map" | "timer" | "calendar" | "export" | "import">(
    "timer",
  );
  const [calCursor, setCalCursor] = useState(() => {
    const date = parseDateKey(todayDateKey());
    return { year: date.getFullYear(), month: date.getMonth() };
  });
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const toastSeq = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const isMobile = useMediaQuery("(max-width: 720px)");
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
    if (!introOpen && !resetOpen && !timeEditId) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (timeEditId) setTimeEditId(null);
      else if (resetOpen) setResetOpen(false);
      else closeIntro();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [introOpen, resetOpen, timeEditId]);

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

  function setActualDay(dateKey: DateKey, next: Interest[]) {
    setStore((prev) => ({
      ...prev,
      actualByDate: { ...prev.actualByDate, [dateKey]: clampDayMinutes(next) },
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
  const timerLive = running ? timerElapsedMs(running, now) : 0;
  const timerPaused = running != null && running.runningSince == null;

  function writeDayMinutes(id: string, next: number) {
    const current = interests.find((item) => item.id === id);
    if (!current || next === current.minutes) return;
    const used = dayUsedMinutes(interests);
    const nextInterests = interests.map((item) =>
      item.id === id ? { ...item, minutes: next } : item,
    );
    const nextSleep = nextInterests.find((item) => item.locked) ?? nextInterests[0];
    const nextWork = nextInterests.find((item) => item.id === "work");
    if (sleep.minutes >= SLEEP_NORM_MINUTES && nextSleep.minutes < SLEEP_NORM_MINUTES) {
      addToast(
        "danger",
        "Сон ниже нормы",
        `8 ч в сутки — норма и полезный максимум. Сейчас ${formatMinutes(nextSleep.minutes)} в день. Это уже жертва здоровьем.`,
      );
    }
    if (sleep.minutes <= SLEEP_NORM_MINUTES && nextSleep.minutes > SLEEP_NORM_MINUTES) {
      addToast(
        "warning",
        "Сон выше полезного максимума",
        "Больше 8 ч в сутки поставить можно, но пользы уже нет — эти часы не усиливают восстановление.",
      );
    }
    if (
      work &&
      nextWork &&
      work.minutes <= WORK_NORM_MINUTES &&
      nextWork.minutes > WORK_NORM_MINUTES
    ) {
      addToast(
        "danger",
        "Работа ушла в перегруз",
        "Норма рабочего дня — 8 ч (5-й уровень). Дальше часов больше, эффективность падает, баланс нарушается.",
      );
    }
    if (used < DAY_MINUTES && used - current.minutes + next >= DAY_MINUTES) {
      addToast(
        "warning",
        "В сутках только 24 часа",
        "Этот день заполнен. Чтобы поднять одну сферу, сначала уберите часы у другой.",
      );
    }
    if (viewMode === "feel") setFeelDay(nextInterests);
    else setActualDay(viewDateKey, nextInterests);
  }

  function setItemMinutes(id: string, minutes: number) {
    const current = interests.find((item) => item.id === id);
    if (!current) return;
    const floor = floorFor(current, viewMode === "fact");
    const used = dayUsedMinutes(interests);
    const room = Math.max(0, DAY_MINUTES - used + current.minutes);
    const next = Math.max(
      floor,
      Math.min(MAX_MINUTES_PER_INTEREST, minutes, room),
    );
    writeDayMinutes(id, next);
  }

  function bump(id: string, dir: 1 | -1, source: "wheel" | "list") {
    const used = dayUsedMinutes(interests);
    const current = interests.find((item) => item.id === id);
    if (!current) return;
    const actual = viewMode === "fact";
    const floor = floorFor(current, actual);
    const room = Math.max(0, DAY_MINUTES - used);
    const next =
      source === "wheel"
        ? nextWheelMinutes(current.minutes, dir, floor, MAX_MINUTES_PER_INTEREST, room)
        : nextListMinutes(current.minutes, dir, floor, MAX_MINUTES_PER_INTEREST, room);
    if (next == null) {
      if (
        !actual &&
        dir < 0 &&
        (current.id === "sleep" || current.locked) &&
        current.minutes <= floor
      ) {
        addToast(
          "warning",
          "Сон нельзя снизить",
          "Ниже 4 ч в сутки опустить сон нельзя.",
        );
      }
      if (dir > 0 && room < (source === "wheel" ? WHEEL_STEP_MINUTES : LIST_STEP_DAILY_MINUTES)) {
        addToast(
          "warning",
          "В сутках только 24 часа",
          "В этом дне больше нельзя добавить время. Чтобы поднять одну сферу, сначала уберите часы у другой.",
        );
      }
      return;
    }
    writeDayMinutes(id, next);
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
    const created: Interest = { id, name, locked: false, minutes: 0 };
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
    if (viewMode === "feel") setFeelDay(next);
    else setActualDay(viewDateKey, next);
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

  function startTimer(interestId: string) {
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
    commitStore((prev) => ({
      ...prev,
      runningTimer: startRunningTimer(interestId, todayKey),
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
    const result = applyMinutesByDates(
      store.actualByDate,
      store.feelWeek,
      timer.interestId,
      chunks,
    );
    commitStore((prev) => ({
      ...prev,
      runningTimer: null,
      actualByDate: result.actualByDate,
    }));
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
        const next = { ...prev.actualByDate };
        delete next[viewDateKey];
        return { ...prev, actualByDate: next };
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

  return (
    <>
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
                  : mobileTab === "export"
                    ? "Выгрузка"
                    : mobileTab === "import"
                      ? "Загрузка"
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

      {timeEdit ? (
        <TimeEditModal
          name={timeEdit.name}
          dateLabel={formatDateTitle(viewDateKey)}
          minutes={timeEdit.minutes}
          minMinutes={floorFor(timeEdit, viewMode === "fact")}
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
          runningLabel={runningItem?.name}
          elapsed={formatElapsed(timerLive)}
          paused={timerPaused}
          onStart={startTimer}
          onPause={pauseTimer}
          onStop={stopTimer}
        />
      ) : null}

      <section
        className={`backup${mobileTab !== "export" && mobileTab !== "import" ? " tab-hidden" : ""}`}
      >
        <div>
          <strong>{mobileTab === "import" ? "Загрузка" : "Выгрузка"}</strong>
          <p>
            Обновление сайта само сейв не сотрёт. Файл нужен, если почистите
            браузер или смените телефон.
          </p>
        </div>
        <div className="backup-actions">
          {mobileTab !== "import" ? (
            <button type="button" className="pill ghost" onClick={() => void saveBackup()}>
              Скачать файл
            </button>
          ) : null}
          {mobileTab !== "export" ? (
            <button
              type="button"
              className="pill"
              onClick={() => fileInput.current?.click()}
            >
              Загрузить
            </button>
          ) : null}
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
                onEditTime={setTimeEditId}
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
            id="export"
            label="Выгрузка"
            active={mobileTab === "export"}
            onClick={() => setMobileTab("export")}
          />
          <TabButton
            id="import"
            label="Загрузка"
            active={mobileTab === "import"}
            onClick={() => setMobileTab("import")}
          />
        </nav>
      ) : null}
    </>
  );
}

function TimerPanel({
  className,
  dateKey,
  spheres,
  runningId,
  runningLabel,
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
  runningLabel?: string;
  elapsed: string;
  paused: boolean;
  onStart: (id: string) => void;
  onPause: () => void;
  onStop: () => void;
}) {
  const fallbackId = spheres.find((item) => item.id === "work")?.id ?? spheres[0]?.id ?? "";
  const [userPickedId, setUserPickedId] = useState(fallbackId);
  const pickedId =
    runningId ??
    (spheres.some((item) => item.id === userPickedId) ? userPickedId : fallbackId);
  const selected = spheres.find((item) => item.id === pickedId);
  const locked = runningId != null;

  return (
    <section className={`timer${className ? ` ${className}` : ""}`} aria-label="Секундомер">
      <div className="timer-stage">
        <div className="timer-above">
          <p className="timer-date">{formatDateTitle(dateKey)}</p>
          <SphereDrum
            spheres={spheres}
            value={pickedId}
            disabled={locked}
            onChange={setUserPickedId}
          />
        </div>
        <p className="timer-time" aria-live="polite">
          {elapsed}
        </p>
        <div className="timer-below">
          {runningId && runningLabel ? (
            <p className="timer-running">
              {paused ? `Пауза: ${runningLabel}` : `Идёт: ${runningLabel}`}
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
                onClick={() => selected && onStart(selected.id)}
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

function ValueDrum<T extends string | number>({
  items,
  value,
  disabled = false,
  ariaLabel,
  format,
  onChange,
}: {
  items: readonly T[];
  value: T;
  disabled?: boolean;
  ariaLabel: string;
  format?: (item: T) => string;
  onChange: (value: T) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const snapTimer = useRef<number | null>(null);
  const key = items.join("|");
  const label = format ?? ((item: T) => String(item));

  useEffect(() => {
    const index = Math.max(0, items.indexOf(value));
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = index * DRUM_ITEM;
  }, [value, key]);

  function snapTo(index: number) {
    const node = listRef.current;
    if (!node) return;
    const nextIndex = Math.max(0, Math.min(items.length - 1, index));
    const next = items[nextIndex];
    if (next !== undefined && next !== value) onChange(next);
    node.scrollTo({ top: nextIndex * DRUM_ITEM, behavior: "smooth" });
  }

  return (
    <div className={`drum${disabled ? " locked" : ""}`} aria-label={ariaLabel}>
      <div className="drum-shade drum-shade-top" />
      <div className="drum-shade drum-shade-bottom" />
      <div className="drum-band" />
      <div
        ref={listRef}
        className="drum-list"
        onScroll={() => {
          if (disabled) return;
          const node = listRef.current;
          if (!node) return;
          const index = Math.round(node.scrollTop / DRUM_ITEM);
          const next = items[Math.max(0, Math.min(items.length - 1, index))];
          if (next !== undefined && next !== value) onChange(next);
          if (snapTimer.current != null) window.clearTimeout(snapTimer.current);
          snapTimer.current = window.setTimeout(() => snapTo(index), 90);
        }}
      >
        <div className="drum-pad" />
        {items.map((item) => (
          <button
            key={String(item)}
            type="button"
            className={`drum-item${item === value ? " active" : ""}`}
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              onChange(item);
              const index = items.indexOf(item);
              listRef.current?.scrollTo({ top: index * DRUM_ITEM, behavior: "smooth" });
            }}
          >
            {label(item)}
          </button>
        ))}
        <div className="drum-pad" />
      </div>
    </div>
  );
}

function SphereDrum({
  spheres,
  value,
  disabled,
  onChange,
}: {
  spheres: Interest[];
  value: string;
  disabled: boolean;
  onChange: (id: string) => void;
}) {
  return (
    <ValueDrum
      items={spheres.map((item) => item.id)}
      value={value}
      disabled={disabled}
      ariaLabel="Сфера"
      format={(id) => spheres.find((item) => item.id === id)?.name ?? id}
      onChange={onChange}
    />
  );
}

function rangeInts(from: number, to: number): number[] {
  const list: number[] = [];
  for (let n = from; n <= to; n += 1) list.push(n);
  return list;
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

  useEffect(() => {
    if (!minuteItems.includes(mins)) setMins(minuteItems[0] ?? 0);
  }, [minuteItems, mins]);

  const draft = hours * HOUR_MINUTES + mins;

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
                ariaLabel="Часы"
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
                ariaLabel="Минуты"
                format={(item) => String(item).padStart(2, "0")}
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
          <button type="button" className="pill" onClick={() => onSave(draft)}>
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
  id: "map" | "timer" | "calendar" | "export" | "import";
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

function TabIcon({ id }: { id: "map" | "timer" | "calendar" | "export" | "import" }) {
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
  if (id === "export") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M12 5v10M8.4 8.4 12 5l3.6 3.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M6 16.5v2.2h12v-2.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 19V9M8.4 15.6 12 19l3.6-3.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6 7.5V5.3h12v2.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
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
          {interests.map((item) => (
            <tr key={item.id}>
              <td style={{ borderLeft: `3px solid ${weekToneForInterest(item)}` }}>
                {item.name}
              </td>
              <td>{weekLevelValue(item.minutes)}</td>
              <td>{formatMinutes(item.minutes)}</td>
              <td>{formatMinutes(dailyMinutes(item.minutes))}</td>
              <td>{item.locked ? "обязательный" : "свой"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
