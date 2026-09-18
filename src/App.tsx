import { useEffect, useMemo, useRef, useState } from "react";
import {
  CX,
  CY,
  DAYS,
  DAY_MINUTES,
  LABEL_R,
  MAX_INTERESTS,
  MAX_R,
  MAX_MINUTES_PER_INTEREST,
  WEEK_MINUTES,
  RING_COUNT,
  SLEEP_NORM_MINUTES,
  VIEW,
  WEEK_HOURS,
  WORK_NORM_MINUTES,
  aggregateWeek,
  closedCurve,
  colorAtLevel,
  dailyMinutes,
  defaultWeek,
  floorFor,
  formatMinutes,
  isWeekPlan,
  migrateInterest,
  nextListMinutes,
  nextWheelMinutes,
  palette,
  polar,
  levelValue,
  todayDayId,
  toneForInterest,
  weekLevelValue,
  weekToneForInterest,
  weekUsedMinutes,
  type DayId,
  type Interest,
  type WeekPlan,
} from "./lib";

const STORAGE_KEY = "wheel-of-balance-v7";

type ToastItem = {
  id: number;
  tone: "danger" | "warning";
  title: string;
  body: string;
};

function loadWeek(): WeekPlan {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultWeek();
    const parsed: unknown = JSON.parse(raw);
    if (isWeekPlan(parsed)) {
      const loaded = Object.fromEntries(
        DAYS.map((day) => [
          day.id,
          parsed[day.id].map((item) => migrateInterest(item)),
        ]),
      ) as WeekPlan;
      const dirty = DAYS.some((day) =>
        loaded[day.id].some((item) => item.minutes % 10 !== 0),
      );
      if (!dirty) return loaded;
    }
  } catch {
    /* keep default */
  }
  return defaultWeek();
}

export default function App() {
  const [week, setWeek] = useState<WeekPlan>(loadWeek);
  const [dayId, setDayId] = useState<DayId>(todayDayId);
  const [draft, setDraft] = useState("");
  const [seq, setSeq] = useState(20);
  const [introOpen, setIntroOpen] = useState(true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastSeq = useRef(0);
  const interests = week[dayId];

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

  function setDayInterests(next: Interest[]) {
    setWeek((prev) => ({ ...prev, [dayId]: next }));
  }

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(week));
  }, [week]);

  useEffect(() => {
    if (!introOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setIntroOpen(false);
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

  const usedMinutes = weekUsedMinutes(week);
  const freeMinutes = WEEK_MINUTES - usedMinutes;
  const sleep = interests.find((item) => item.locked) ?? interests[0];
  const sleepLow = sleep.minutes < SLEEP_NORM_MINUTES;
  const sleepHigh = sleep.minutes > SLEEP_NORM_MINUTES;
  const work = interests.find((item) => item.id === "work");
  const workHigh = (work?.minutes ?? 0) > WORK_NORM_MINUTES;
  const canAdd = interests.length < MAX_INTERESTS;
  const weeklyInterests = useMemo(() => aggregateWeek(week), [week]);

  function bump(id: string, dir: 1 | -1, source: "wheel" | "list") {
    const used = interests.reduce((sum, item) => sum + item.minutes, 0);
    const current = interests.find((item) => item.id === id);
    if (!current) return;
    const floor = floorFor(current);
    const room = DAY_MINUTES - used;
    const next =
      source === "wheel"
        ? nextWheelMinutes(current.minutes, dir, floor, MAX_MINUTES_PER_INTEREST, room)
        : nextListMinutes(current.minutes, dir, floor, MAX_MINUTES_PER_INTEREST, room);
    if (next == null) {
      if (dir < 0 && (current.id === "sleep" || current.locked) && current.minutes <= floor) {
        addToast(
          "warning",
          "Сон нельзя снизить",
          "Ниже 4 ч в сутки опустить сон нельзя.",
        );
      }
      if (dir > 0 && room <= 0) {
        addToast(
          "warning",
          "Свободных часов нет",
          "Чтобы поднять одну сферу, сначала нажмите «−» на другой. Новые часы из ниоткуда не появляются.",
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
        "Свободных часов нет",
        "Чтобы поднять одну сферу, сначала нажмите «−» на другой. Новые часы из ниоткуда не появляются.",
      );
    }
    setDayInterests(nextInterests);
  }

  function addInterest() {
    const name = draft.trim();
    if (!name || interests.length >= MAX_INTERESTS) return;
    const existingId = DAYS.map((day) => week[day.id])
      .flat()
      .find((item) => item.name === name)?.id;
    setDayInterests([
      ...interests,
      { id: existingId ?? `i-${seq}`, name, locked: false, minutes: 0 },
    ]);
    if (!existingId) setSeq((n) => n + 1);
    setDraft("");
  }

  function removeInterest(id: string) {
    setDayInterests(interests.filter((item) => item.id !== id || item.locked));
  }

  function renameInterest(id: string, name: string) {
    const next = name.trim();
    if (!next) return;
    setDayInterests(
      interests.map((item) =>
        item.id === id && !item.locked ? { ...item, name: next } : item,
      ),
    );
  }

  return (
    <div className="page">
      {introOpen ? (
        <div className="modal-backdrop" onClick={() => setIntroOpen(false)}>
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
                  распределяете своё время.
                </li>
                <li>Сохраните.</li>
                <li>
                  В течение недели фиксируйте в действительности, сколько времени
                  и на что ушло.
                </li>
                <li>Отредактируйте карту по фактам.</li>
              </ol>
              <p>
                Разница между первой и второй версией — это и есть честная
                картина вашего текущего результата.
              </p>
              <p>
                <strong>Не занимайтесь самообманом.</strong>
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
              <button type="button" className="pill" onClick={() => setIntroOpen(false)}>
                Начать
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="stats" aria-label="Часы недели">
        <Stat value={`${WEEK_HOURS} ч`} label="Всего в неделе" />
        <Stat value={formatMinutes(usedMinutes)} label="Уже распределено" />
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

      <UsageBar usedMinutes={usedMinutes} />

      <div className="layout">
        <section className="map-panel">
          <div className="map-head">
            <h2>Карта баланса</h2>
            <div className="day-tabs" role="tablist" aria-label="Дни недели">
              {DAYS.map((day) => (
                <button
                  key={day.id}
                  type="button"
                  role="tab"
                  aria-selected={day.id === dayId}
                  className={`day-tab${day.id === dayId ? " active" : ""}`}
                  onClick={() => setDayId(day.id)}
                >
                  {day.short}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="pill"
              onClick={() => setWeek(defaultWeek())}
            >
              Сброс
            </button>
          </div>
          <div className="wheel-slot">
            <BalanceWheel
              interests={interests}
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
          draft={draft}
          canAdd={canAdd}
          onDraft={setDraft}
          onAdd={addInterest}
          onBump={bump}
          onRemove={removeInterest}
          onRename={renameInterest}
        />
      </div>

      <section className="table-panel">
        <h2>Таблица распределения времени по сферам</h2>
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
}: {
  usedMinutes: number;
}) {
  const restMinutes = Math.max(0, WEEK_MINUTES - usedMinutes);
  return (
    <div className="usage">
      <div className="usage-labels">
        <span>Неделя</span>
        <span>
          {formatMinutes(usedMinutes)} / {WEEK_HOURS} ч
        </span>
      </div>
      <div
        className="usage-track"
        role="meter"
        aria-label="Распределённые часы недели"
        aria-valuemin={0}
        aria-valuemax={WEEK_MINUTES}
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
  onBump,
  onRename,
}: {
  interests: Interest[];
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
        const plusOff = item.minutes >= MAX_MINUTES_PER_INTEREST;
        const minusOff = item.minutes <= floorFor(item);
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
            <div className="spoke-btns">
              <button
                type="button"
                className="icon-btn"
                title={
                  minusOff && (item.id === "sleep" || item.locked)
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
                title={`Добавить: ${item.name}`}
                disabled={plusOff}
                onClick={() => onBump(item.id, 1, "wheel")}
              >
                +
              </button>
            </div>
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
  draft,
  canAdd,
  onDraft,
  onAdd,
  onBump,
  onRemove,
  onRename,
}: {
  interests: Interest[];
  draft: string;
  canAdd: boolean;
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
        {interests.map((item) => (
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
                  item.minutes <= floorFor(item) && (item.id === "sleep" || item.locked)
                    ? "Сон нельзя снизить ниже 4 ч в сутки"
                    : "Убавить: 10 мин."
                }
                disabled={item.minutes <= floorFor(item)}
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
                title="Добавить: 10 мин."
                disabled={item.minutes >= MAX_MINUTES_PER_INTEREST}
                onClick={() => onBump(item.id, 1, "list")}
              >
                +
              </button>
              <em>{formatMinutes(item.minutes)}</em>
            </div>
          </li>
        ))}
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
