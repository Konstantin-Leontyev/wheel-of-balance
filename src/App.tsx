import { useEffect, useMemo, useRef, useState } from "react";
import {
  CX,
  CY,
  DAYS,
  DAY_HOURS,
  DAY_MINUTES,
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
  addActualMinutes,
  actualDayFor,
  aggregateWeek,
  clampDayMinutes,
  closedCurve,
  colorAtLevel,
  dailyMinutes,
  dateKeyToDayId,
  dayUsedMinutes,
  defaultWeek,
  elapsedMinutes,
  floorFor,
  formatDateTitle,
  formatElapsed,
  formatMinutes,
  isAppPersist,
  isSleepInterest,
  isWeekPlan,
  mergeInterestLists,
  migrateInterest,
  nextListMinutes,
  nextWheelMinutes,
  palette,
  parseDateKey,
  polar,
  levelValue,
  sanitizeWeek,
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
  tone: "danger" | "warning";
  title: string;
  body: string;
};

function loadStore(): AppPersist {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isAppPersist(parsed)) {
        return {
          ...parsed,
          feelWeek: sanitizeWeek(parsed.feelWeek),
          actualByDate: Object.fromEntries(
            Object.entries(parsed.actualByDate).map(([key, items]) => [
              key,
              clampDayMinutes(items.map((item) => migrateInterest(item))),
            ]),
          ),
        };
      }
    }
  } catch {
    /* keep looking */
  }
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed: unknown = JSON.parse(legacy);
      if (isWeekPlan(parsed)) {
        return {
          feelWeek: sanitizeWeek(parsed),
          actualByDate: {},
          runningTimer: null,
          feelConfirmed: true,
          introSeen: false,
        };
      }
    }
  } catch {
    /* keep default */
  }
  return {
    feelWeek: defaultWeek(),
    actualByDate: {},
    runningTimer: null,
    feelConfirmed: false,
    introSeen: false,
  };
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
  const [store, setStore] = useState<AppPersist>(loadStore);
  const [pickedDayId, setPickedDayId] = useState<DayId>(todayDayId);
  const [pickedDateKey, setPickedDateKey] = useState<DateKey>(todayDateKey);
  const [mode, setMode] = useState<"feel" | "fact">(
    store.feelConfirmed ? "fact" : "feel",
  );
  const [draft, setDraft] = useState("");
  const [seq, setSeq] = useState(20);
  const [introOpen, setIntroOpen] = useState(!store.introSeen);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const toastSeq = useRef(0);
  const isMobile = useMediaQuery("(max-width: 720px)");
  const todayKey = useTodayKey();
  const viewMode = store.feelConfirmed ? mode : "feel";
  const dayId = isMobile ? dateKeyToDayId(todayKey) : pickedDayId;
  const viewDateKey = isMobile ? todayKey : pickedDateKey;
  const weekKeys = useMemo(() => weekDateKeys(parseDateKey(todayKey)), [todayKey]);

  const interests =
    viewMode === "feel"
      ? store.feelWeek[dayId]
      : actualDayFor(store.actualByDate, viewDateKey, store.feelWeek);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [store]);

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
    if (!introOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeIntro();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [introOpen]);

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
    setStore((prev) => ({ ...prev, feelConfirmed: true }));
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
  const timerSpheres = actualDayFor(store.actualByDate, todayKey, store.feelWeek).filter(
    (item) => !isSleepInterest(item),
  );
  const running = store.runningTimer;
  const runningItem = running
    ? timerSpheres.find((item) => item.id === running.interestId) ??
      interests.find((item) => item.id === running.interestId)
    : undefined;

  function bump(id: string, dir: 1 | -1, source: "wheel" | "list") {
    if (viewMode === "fact") {
      const current = interests.find((item) => item.id === id);
      if (current && !isSleepInterest(current)) {
        addToast(
          "warning",
          "Время — с таймера",
          "Для этой сферы засеките время сверху. Руками правится только сон.",
        );
        return;
      }
    }

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
    if (store.runningTimer) {
      addToast("warning", "Таймер уже идёт", "Сначала остановите текущую сферу.");
      return;
    }
    setStore((prev) => ({
      ...prev,
      runningTimer: {
        interestId,
        startedAt: Date.now(),
        dateKey: todayKey,
      },
    }));
  }

  function stopTimer() {
    const timer = store.runningTimer;
    if (!timer) return;
    const minutes = elapsedMinutes(timer.startedAt, Date.now());
    if (minutes < 1) {
      setStore((prev) => ({ ...prev, runningTimer: null }));
      addToast(
        "warning",
        "Меньше минуты",
        "Сессия короче минуты не записалась. Засеките ещё раз, когда сядете за дело.",
      );
      return;
    }
    const dayItems = actualDayFor(store.actualByDate, timer.dateKey, store.feelWeek);
    const { items, added } = addActualMinutes(dayItems, timer.interestId, minutes);
    setStore((prev) => ({
      ...prev,
      runningTimer: null,
      actualByDate: { ...prev.actualByDate, [timer.dateKey]: items },
    }));
    if (added === 0) {
      addToast(
        "warning",
        "В сутках только 24 часа",
        "Этот день уже заполнен. Сессия не записалась.",
      );
    } else if (added < minutes) {
      addToast(
        "warning",
        "Записана часть времени",
        `Влезло только ${formatMinutes(added)} из ${formatMinutes(minutes)}.`,
      );
    }
  }

  function resetView() {
    if (viewMode === "feel") {
      setStore((prev) => ({ ...prev, feelWeek: defaultWeek() }));
      return;
    }
    setStore((prev) => {
      const next = { ...prev.actualByDate };
      delete next[viewDateKey];
      return { ...prev, actualByDate: next };
    });
  }

  const usageTotal = viewMode === "feel" || !isMobile ? WEEK_MINUTES : DAY_MINUTES;
  const usageUsed =
    viewMode === "feel" ? usedMinutesFeel : isMobile ? usedMinutesActualDay : usedMinutesActualWeek;
  const usageLabel = viewMode === "feel" || !isMobile ? "Неделя" : "Сегодня";
  const usageCapLabel =
    viewMode === "feel" || !isMobile ? `${WEEK_HOURS} ч` : `${DAY_HOURS} ч`;

  return (
    <div className="page">
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
              <h1 id="intro-title">Карта баланса с привязкой ко времени</h1>

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

              <h2>Почему карта привязана ко времени</h2>
              <p>
                Время — это независящий от вас ресурс. Вы не можете остановить
                время равно как не можете добавить часов в сутках.
              </p>
              <p>
                Каждый час, отданный одной сфере, забран у другой. Это и есть
                главный смысл карты:{" "}
                <strong>
                  усилиться в одном можно только ценой просадки в другом.
                </strong>{" "}
                Нельзя усидеть на двух стульях — чем именно пожертвовать,
                решаете только вы.
              </p>

              <h2>Как работать с картой</h2>
              <ol>
                <li>
                  Заполните карту так, как <strong>вам кажется</strong> — как вы
                  распределяете своё время. Можно пропустить.
                </li>
                <li>
                  Дальше каждый день засекайте сферы секундомером: сели —
                  Старт, закончили — Стоп. Время пишется в сегодняшнюю дату.
                </li>
                <li>К концу недели карта — это уже факт, не ощущение.</li>
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
                «На экран Домой». Данные останутся в этом браузере.
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

      {viewMode === "feel" && !store.feelConfirmed ? (
        <section className="feel-banner">
          <p>
            Заполните карту как чувствуете. Можно пропустить и сразу засекать
            время.
          </p>
          <div className="feel-banner-actions">
            <button type="button" className="pill ghost" onClick={confirmFeel}>
              Пропустить
            </button>
            <button type="button" className="pill" onClick={confirmFeel}>
              Дальше
            </button>
          </div>
        </section>
      ) : null}

      {viewMode === "fact" ? (
        <TimerPanel
          dateKey={todayKey}
          spheres={timerSpheres}
          runningId={running?.interestId ?? null}
          runningLabel={runningItem?.name}
          elapsed={running ? formatElapsed(now - running.startedAt) : "0:00"}
          onStart={startTimer}
          onStop={stopTimer}
        />
      ) : null}

      <section className="stats" aria-label="Часы недели">
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

      <UsageBar
        usedMinutes={usageUsed}
        totalMinutes={usageTotal}
        label={usageLabel}
        capLabel={usageCapLabel}
      />

      <div className="layout">
        <section className="map-panel">
          <div className="map-head">
            <h2>{viewMode === "feel" ? "Как чувствую" : "Карта баланса"}</h2>
            <div className="day-tabs" role="tablist" aria-label="Дни недели">
              {viewMode === "feel"
                ? DAYS.map((day) => (
                    <button
                      key={day.id}
                      type="button"
                      role="tab"
                      aria-selected={day.id === dayId}
                      className={`day-tab${day.id === dayId ? " active" : ""}`}
                      onClick={() => setPickedDayId(day.id)}
                    >
                      {day.short}
                    </button>
                  ))
                : weekKeys.map((key, index) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={key === viewDateKey}
                      className={`day-tab${key === viewDateKey ? " active" : ""}`}
                      onClick={() => setPickedDateKey(key)}
                    >
                      {DAYS[index].short}
                    </button>
                  ))}
            </div>
            <div className="map-actions">
              {store.feelConfirmed && !isMobile ? (
                <button
                  type="button"
                  className="pill ghost"
                  onClick={() => setMode(viewMode === "feel" ? "fact" : "feel")}
                >
                  {viewMode === "feel" ? "К факту" : "Как чувствую"}
                </button>
              ) : null}
              <button type="button" className="pill" onClick={resetView}>
                Сброс
              </button>
            </div>
          </div>
          {viewMode === "fact" ? (
            <p className="date-line">{formatDateTitle(viewDateKey)}</p>
          ) : null}
          <div className="wheel-slot">
            <BalanceWheel
              interests={interests}
              roomMinutes={dayRoom}
              timerOnly={viewMode === "fact"}
              onBump={bump}
              onRename={renameInterest}
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

        <InterestEditor
          interests={interests}
          roomMinutes={dayRoom}
          draft={draft}
          canAdd={canAdd}
          timerOnly={viewMode === "fact"}
          onDraft={setDraft}
          onAdd={addInterest}
          onBump={bump}
          onRemove={removeInterest}
          onRename={renameInterest}
        />
      </div>

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
  );
}

function TimerPanel({
  dateKey,
  spheres,
  runningId,
  runningLabel,
  elapsed,
  onStart,
  onStop,
}: {
  dateKey: DateKey;
  spheres: Interest[];
  runningId: string | null;
  runningLabel?: string;
  elapsed: string;
  onStart: (id: string) => void;
  onStop: () => void;
}) {
  const fallbackId = spheres.find((item) => item.id === "work")?.id ?? spheres[0]?.id ?? "";
  const [userPickedId, setUserPickedId] = useState(fallbackId);
  const pickedId =
    runningId ??
    (spheres.some((item) => item.id === userPickedId) ? userPickedId : fallbackId);
  const selected = spheres.find((item) => item.id === pickedId);

  return (
    <section className="timer" aria-label="Секундомер">
      <p className="timer-date">{formatDateTitle(dateKey)}</p>
      <p className="timer-time" aria-live="polite">
        {elapsed}
      </p>
      {runningId && runningLabel ? (
        <p className="timer-running">Идёт: {runningLabel}</p>
      ) : (
        <p className="timer-running">Выберите сферу и нажмите Старт</p>
      )}
      <div className="timer-spheres" role="group" aria-label="Сфера для таймера">
        {spheres.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`timer-chip${item.id === pickedId ? " active" : ""}${item.id === runningId ? " running" : ""}`}
            disabled={runningId != null && item.id !== runningId}
            onClick={() => setUserPickedId(item.id)}
          >
            {item.name}
          </button>
        ))}
      </div>
      <div className="timer-actions">
        {runningId ? (
          <button type="button" className="pill timer-btn" onClick={onStop}>
            Стоп
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
      </div>
    </section>
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
}: {
  interests: Interest[];
  roomMinutes: number;
  timerOnly: boolean;
  onBump: (id: string, dir: 1 | -1, source: "wheel" | "list") => void;
  onRename: (id: string, name: string) => void;
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
      <svg viewBox={`0 0 ${VIEW} ${VIEW}`} role="img" aria-label="Карта баланса интересов за выбранный день">
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
            className="spoke"
            style={{
              left: `${(pos.x / VIEW) * 100}%`,
              top: `${(pos.y / VIEW) * 100}%`,
            }}
          >
            <SpokeName item={item} onRename={onRename} />
            <em>{formatMinutes(item.minutes)}</em>
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

function SpokeName({
  item,
  onRename,
}: {
  item: Interest;
  onRename: (id: string, name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.name);
  const timer = useRef<number | null>(null);

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
    setDraft(item.name);
    setEditing(true);
  }

  function commit() {
    onRename(item.id, draft);
    setEditing(false);
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
              setEditing(false);
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
        title={item.locked ? undefined : "Удерживайте, чтобы переименовать"}
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
