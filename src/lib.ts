export const WEEK_HOURS = 168;
export const RING_COUNT = 10;
export const STEPS_PER_RING = 10;
export const MINUTES_PER_STEP = 67.2;
export const MAX_STEPS_PER_INTEREST = RING_COUNT * STEPS_PER_RING;
export const MAX_TOTAL_STEPS = 150;
export const MAX_INTERESTS = 12;
export const SLEEP_NORM_STEPS = 50;
export const SLEEP_MIN_STEPS = 25;
export const WORK_NORM_STEPS = 50;
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
  steps: number;
};

export const DEFAULT_INTERESTS: Interest[] = [
  { id: "sleep", name: "Сон", locked: true, steps: 50 },
  { id: "work", name: "Работа", locked: false, steps: 30 },
  { id: "family", name: "Семья", locked: false, steps: 20 },
  { id: "sport", name: "Спорт", locked: false, steps: 10 },
  { id: "fun", name: "Развлечения", locked: false, steps: 10 },
  { id: "education", name: "Образование", locked: false, steps: 10 },
  { id: "relations", name: "Отношения", locked: false, steps: 10 },
  { id: "craft", name: "Творчество", locked: false, steps: 10 },
  { id: "home", name: "Быт", locked: false, steps: 0 },
  { id: "money", name: "Финансы", locked: false, steps: 0 },
  { id: "spirit", name: "Духовность", locked: false, steps: 0 },
  { id: "rest", name: "Отдых", locked: false, steps: 0 },
];

export function formatMinutes(mins: number): string {
  const total = Math.max(0, Math.round(mins));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} мин`;
  return `${h} ч ${m} мин`;
}

export function weeklyMinutes(steps: number): number {
  return steps * MINUTES_PER_STEP;
}

export function floorFor(item: Interest): number {
  return item.id === "sleep" || item.locked ? SLEEP_MIN_STEPS : 0;
}

export function levelValue(steps: number): number {
  return Math.round(steps / STEPS_PER_RING);
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
  return colorAtLevel(item.steps / STEPS_PER_RING);
}

export function usageTone(interest: Interest): "red" | "orange" | "yellow" | "green" {
  const ring = interest.steps / STEPS_PER_RING;
  if (ring <= 2) return "red";
  if (ring < 4.5) return "orange";
  if (ring <= 5.5) return "green";
  if (ring < 8) return "yellow";
  return "red";
}

export function isInterestArray(value: unknown): value is Interest[] {
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
        typeof item.steps === "number",
    )
  );
}
