import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CX,
  CY,
  LABEL_R,
  MAX_INTERESTS,
  MAX_R,
  MAX_STEPS_PER_INTEREST,
  MAX_TOTAL_STEPS,
  MINUTES_PER_STEP,
  DEFAULT_INTERESTS,
  RING_COUNT,
  SLEEP_NORM_STEPS,
  STEPS_PER_RING,
  VIEW,
  WEEK_HOURS,
  WORK_NORM_STEPS,
  closedCurve,
  colorAtLevel,
  floorFor,
  formatMinutes,
  isInterestArray,
  palette,
  polar,
  levelValue,
  toneForInterest,
  weeklyMinutes,
  type Interest,
} from "./lib";

const STORAGE_KEY = "wheel-of-balance-v2";

function loadInterests(): Interest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_INTERESTS;
    const parsed: unknown = JSON.parse(raw);
    if (isInterestArray(parsed)) return parsed;
  } catch {
    /* keep default */
  }
  return DEFAULT_INTERESTS;
}

export default function App() {
  const [interests, setInterests] = useState<Interest[]>(loadInterests);
  const [draft, setDraft] = useState("");
  const [seq, setSeq] = useState(20);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(interests));
  }, [interests]);

  const usedSteps = interests.reduce((sum, item) => sum + item.steps, 0);
  const freeSteps = MAX_TOTAL_STEPS - usedSteps;
  const allocatedMin = weeklyMinutes(usedSteps);
  const freeMin = weeklyMinutes(freeSteps);
  const sleep = interests.find((item) => item.locked) ?? interests[0];
  const sleepLow = sleep.steps < SLEEP_NORM_STEPS;
  const sleepHigh = sleep.steps > SLEEP_NORM_STEPS;
  const work = interests.find((item) => item.id === "work");
  const workHigh = (work?.steps ?? 0) > WORK_NORM_STEPS;
  const canAdd = interests.length < MAX_INTERESTS;

  function bump(id: string, delta: number) {
    setInterests((prev) => {
      const used = prev.reduce((sum, item) => sum + item.steps, 0);
      return prev.map((item) => {
        if (item.id !== id) return item;
        const next = item.steps + delta;
        const floor = floorFor(item);
        if (next < floor || next > MAX_STEPS_PER_INTEREST) return item;
        if (delta > 0 && used >= MAX_TOTAL_STEPS) return item;
        return { ...item, steps: next };
      });
    });
  }

  function addInterest() {
    const name = draft.trim();
    if (!name || interests.length >= MAX_INTERESTS) return;
    setInterests((prev) => [
      ...prev,
      { id: `i-${seq}`, name, locked: false, steps: 0 },
    ]);
    setSeq((n) => n + 1);
    setDraft("");
  }

  function removeInterest(id: string) {
    setInterests((prev) => prev.filter((item) => item.id !== id || item.locked));
  }

  return (
    <div className="page">
      <header className="hero">
        <h1>Колесо баланса</h1>
        <p>
          Неделя — 168 часов. Каждый час одной сфере можно отдать, только забрав
          его у другой. Сон обязателен и всегда на 12 часах; ниже 4 ч в сутки его
          опустить нельзя. 8 ч сна в сутки — и норма, и полезный максимум. Та же
          логика у всех сфер: к 5-му уровню цвет идёт к зелёному, дальше можно
          добавить часов, но шкала снова краснеет — эффективность падает, баланс
          ломается.
        </p>
      </header>

      <section className="stats" aria-label="Часы недели">
        <Stat value={`${WEEK_HOURS} ч`} label="Всего в неделе" />
        <Stat value={formatMinutes(allocatedMin)} label="Уже распределено" />
        <Stat
          value={formatMinutes(freeMin)}
          label="Ещё доступно"
          tone={freeSteps === 0 ? "warning" : undefined}
        />
        <Stat
          value={formatMinutes(weeklyMinutes(sleep.steps) / 7)}
          label="Сон в сутки"
          tone={sleepLow ? "danger" : sleepHigh ? "warning" : "success"}
        />
        {work ? (
          <Stat
            value={formatMinutes(weeklyMinutes(work.steps) / 7)}
            label="Работа в сутки"
            tone={workHigh ? "danger" : work.steps >= WORK_NORM_STEPS ? "success" : undefined}
          />
        ) : null}
      </section>

      <UsageBar usedSteps={usedSteps} allocatedMin={allocatedMin} />

      {sleepLow ? (
        <Callout tone="danger" title="Сон ниже нормы">
          8 ч в сутки — и норма, и полезный максимум (5-й уровень, 56 ч в неделю).
          Сейчас {formatMinutes(weeklyMinutes(sleep.steps) / 7)} в день. Часы,
          забранные у сна, появляются у других сфер, но это уже жертва здоровьем.
        </Callout>
      ) : null}

      {sleepHigh ? (
        <Callout tone="warning" title="Сон выше полезного максимума">
          Больше 8 ч в сутки поставить можно, но точка уходит от зелёного: пользы
          уже нет, эти часы не усиливают восстановление.
        </Callout>
      ) : null}

      {workHigh ? (
        <Callout tone="danger" title="Работа ушла в перегруз">
          Норма рабочего дня — 8 ч (5-й уровень). Дальше шкала специально идёт
          обратно к красному: часов больше, эффективность падает, баланс
          нарушается.
        </Callout>
      ) : null}

      {freeSteps === 0 ? (
        <Callout tone="warning" title="Свободных часов нет">
          Чтобы поднять одну сферу, сначала нажмите «−» на другой. Новые часы из
          ниоткуда не появляются.
        </Callout>
      ) : null}

      <div className="layout">
        <section className="map-panel">
          <h2>Карта недели</h2>
          <BalanceWheel interests={interests} onBump={bump} />
          <p className="legend-lead">
            Сетка: 10 уровней от центра (0 ч) к внешней окружности (максимум
            времени). Например норма сна и рабочего дня, 8 ч/день — пунктир на
            5-м уровне.
          </p>
          <div className="legend">
            <span>
              <i className="swatch" style={{ background: palette.red }} />
              0 уровень — недосып / перегруз
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
            От 5-го уровня шкала снова идёт к красному: избыток сна не улучшает
            состояние, а ведёт к недомоганию. Переработка ведёт к выгоранию и
            потере производительности.
          </p>
        </section>

        <InterestEditor
          interests={interests}
          draft={draft}
          canAdd={canAdd}
          freeSteps={freeSteps}
          onDraft={setDraft}
          onAdd={addInterest}
          onBump={bump}
          onRemove={removeInterest}
        />
      </div>

      <section className="table-panel">
        <h2>Распределение по сферам</h2>
        <InterestTable interests={interests} />
      </section>
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

function Callout({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "danger" | "warning";
  children: ReactNode;
}) {
  return (
    <aside className={`callout ${tone}`}>
      <strong>{title}</strong>
      <p>{children}</p>
    </aside>
  );
}

function UsageBar({
  usedSteps,
  allocatedMin,
}: {
  usedSteps: number;
  allocatedMin: number;
}) {
  const restSteps = Math.max(0, MAX_TOTAL_STEPS - usedSteps);
  return (
    <div className="usage">
      <div className="usage-labels">
        <span>Неделя · 1 шаг = {formatMinutes(MINUTES_PER_STEP)}</span>
        <span>
          {formatMinutes(allocatedMin)} / {WEEK_HOURS} ч
        </span>
      </div>
      <div
        className="usage-track"
        role="meter"
        aria-label="Распределённые часы недели"
        aria-valuemin={0}
        aria-valuemax={MAX_TOTAL_STEPS}
        aria-valuenow={usedSteps}
      >
        <span className="usage-fill" style={{ flexGrow: usedSteps }} />
        <span className="usage-rest" style={{ flexGrow: restSteps }} />
      </div>
    </div>
  );
}

function BalanceWheel({
  interests,
  onBump,
}: {
  interests: Interest[];
  onBump: (id: string, delta: number) => void;
}) {
  const count = interests.length;
  const used = interests.reduce((sum, item) => sum + item.steps, 0);
  const freeSteps = MAX_TOTAL_STEPS - used;

  const points = useMemo(
    () =>
      interests.map((item, index) => {
        const r = (item.steps / MAX_STEPS_PER_INTEREST) * MAX_R;
        return { ...polar(index, count, r), item };
      }),
    [interests, count],
  );

  const path = closedCurve(points);

  return (
    <div className="wheel">
      <svg viewBox={`0 0 ${VIEW} ${VIEW}`} role="img" aria-label="Колесо баланса интересов за неделю">
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
          const isNorm = ring === SLEEP_NORM_STEPS / STEPS_PER_RING;
          return (
            <circle
              key={`grid-${ring}`}
              cx={CX}
              cy={CY}
              r={(ring / RING_COUNT) * MAX_R}
              fill="none"
              stroke={isNorm ? palette.yellow : palette.line}
              strokeWidth={isNorm ? 1.4 : 1}
              strokeDasharray={isNorm ? "4 5" : undefined}
              opacity={isNorm ? 0.9 : 0.7}
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
        const plusOff = item.steps >= MAX_STEPS_PER_INTEREST || freeSteps <= 0;
        const minusOff = item.steps <= floorFor(item);
        return (
          <div
            key={item.id}
            className="spoke"
            style={{
              left: `${(pos.x / VIEW) * 100}%`,
              top: `${(pos.y / VIEW) * 100}%`,
            }}
          >
            <strong style={{ color: toneForInterest(item) }}>{item.name}</strong>
            <em>{formatMinutes(weeklyMinutes(item.steps))}</em>
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
                onClick={() => onBump(item.id, -1)}
              >
                −
              </button>
              <button
                type="button"
                className="icon-btn"
                title={`Добавить: ${item.name}`}
                disabled={plusOff}
                onClick={() => onBump(item.id, 1)}
              >
                +
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InterestEditor({
  interests,
  draft,
  canAdd,
  freeSteps,
  onDraft,
  onAdd,
  onBump,
  onRemove,
}: {
  interests: Interest[];
  draft: string;
  canAdd: boolean;
  freeSteps: number;
  onDraft: (value: string) => void;
  onAdd: () => void;
  onBump: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <aside className="editor">
      <div className="editor-head">
        <h2>Интересы</h2>
        <span>
          {interests.length} / {MAX_INTERESTS}
        </span>
      </div>
      <p>
        До 12 сфер вместе со сном. Новая сфера появляется в центре (0 ч) и
        встаёт на циферблат равномерно. Один шаг — {formatMinutes(MINUTES_PER_STEP)}.
      </p>
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
              <strong>{item.name}</strong>
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
                  item.steps <= floorFor(item) && (item.id === "sleep" || item.locked)
                    ? "Сон нельзя снизить ниже 4 ч в сутки"
                    : `Убавить: ${item.name}`
                }
                disabled={item.steps <= floorFor(item)}
                onClick={() => onBump(item.id, -1)}
              >
                −
              </button>
              <span>
                уровень {levelValue(item.steps)} / {RING_COUNT}
              </span>
              <button
                type="button"
                className="icon-btn"
                title={`Добавить: ${item.name}`}
                disabled={item.steps >= MAX_STEPS_PER_INTEREST || freeSteps <= 0}
                onClick={() => onBump(item.id, 1)}
              >
                +
              </button>
              <em>{formatMinutes(weeklyMinutes(item.steps) / 7)} / день</em>
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
              <td style={{ borderLeft: `3px solid ${toneForInterest(item)}` }}>
                {item.name}
              </td>
              <td>{levelValue(item.steps)}</td>
              <td>{formatMinutes(weeklyMinutes(item.steps))}</td>
              <td>{formatMinutes(weeklyMinutes(item.steps) / 7)}</td>
              <td>{item.locked ? "обязательный" : "свой"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
