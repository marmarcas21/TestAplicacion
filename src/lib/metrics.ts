import { GROUPS, groupOf, sportOf } from './sports';
import type { Activity, Challenge, Goal, GoalMetric, Units } from './types';

export const DAY = 86400000;
const pad = (n: number) => String(n).padStart(2, '0');

/* ---------- Fechas (siempre en hora local) ---------- */
export const dayKey = (d: Date | string) => {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** Lunes de la semana de `d` */
export const startOfWeek = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
/** 0 = lunes … 6 = domingo */
export const weekdayIdx = (d: Date) => (d.getDay() + 6) % 7;
export const toLocalInput = (d: Date) =>
  `${dayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export const DAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const DAYS_LONG = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const MONTHS_LONG = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const fmtDate = (d: Date | string) => {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getDate()} ${MONTHS[x.getMonth()]}`;
};
export const fmtDateTime = (iso: string) => {
  const x = new Date(iso);
  return `${fmtDate(x)} · ${pad(x.getHours())}:${pad(x.getMinutes())}`;
};
export function fmtAgo(iso: string, now = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  const days = Math.round((startOfDay(now).getTime() - startOfDay(new Date(iso)).getTime()) / DAY);
  if (diff < 0) return fmtDate(iso);
  if (diff < 3600000) return `hace ${Math.max(1, Math.round(diff / 60000))} min`;
  if (days === 0) return `hace ${Math.round(diff / 3600000)} h`;
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  return fmtDate(iso);
}

/* ---------- Formato de magnitudes ---------- */
export const KM_PER_MI = 1.609344;
export const toUnit = (km: number, u: Units) => (u === 'mi' ? km / KM_PER_MI : km);
export const fromUnit = (v: number, u: Units) => (u === 'mi' ? v * KM_PER_MI : v);
export const fmtNum = (n: number, dec = 1) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: dec });
export const fmtDist = (km: number, u: Units, dec = 1) => `${fmtNum(toUnit(km, u), dec)} ${u}`;

export function fmtDur(sec: number): string {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${pad(m % 60)} min`;
}
export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}
/** Ritmo en min por km o por milla */
export function fmtPace(sec: number, km: number, u: Units): string {
  if (!km || !sec) return '–';
  const perUnit = sec / toUnit(km, u);
  return `${fmtClock(perUnit)} /${u}`;
}
export function fmtSpeed(sec: number, km: number, u: Units): string {
  if (!km || !sec) return '–';
  return `${fmtNum(toUnit(km, u) / (sec / 3600))} ${u}/h`;
}
/** Carrera y montaña se leen en ritmo; la bici en velocidad */
export function fmtEffort(a: Activity, u: Units): string {
  if (!a.distanceKm) return '';
  const g = sportOf(a.sport).group;
  return g === 'ride' || a.sport === 'ski' ? fmtSpeed(a.durationSec, a.distanceKm, u) : fmtPace(a.durationSec, a.distanceKm, u);
}

export const estimateCalories = (sport: string, durationSec: number, weightKg: number) =>
  Math.round(sportOf(sport).met * weightKg * (durationSec / 3600));

/* ---------- Agregados ---------- */
export interface Totals {
  sessions: number;
  timeSec: number;
  distanceKm: number;
  elevationM: number;
  calories: number;
}
export function totals(acts: Activity[]): Totals {
  const t: Totals = { sessions: 0, timeSec: 0, distanceKm: 0, elevationM: 0, calories: 0 };
  for (const a of acts) {
    t.sessions++;
    t.timeSec += a.durationSec;
    t.distanceKm += a.distanceKm ?? 0;
    t.elevationM += a.elevationM ?? 0;
    t.calories += a.calories ?? 0;
  }
  return t;
}

export const inRange = (acts: Activity[], from: Date, to: Date) =>
  acts.filter((a) => {
    const t = new Date(a.date).getTime();
    return t >= from.getTime() && t < to.getTime();
  });

export const metricValue = (a: Activity, m: GoalMetric) =>
  m === 'sessions' ? 1 : m === 'time' ? a.durationSec / 3600 : a.distanceKm ?? 0;
export const metricUnit = (m: GoalMetric, u: Units) => (m === 'sessions' ? 'sesiones' : m === 'time' ? 'h' : u);
export const metricLabel: Record<GoalMetric, string> = { distance: 'Distancia', time: 'Tiempo', sessions: 'Sesiones' };

export interface WeekBucket {
  start: Date;
  label: string;
  byGroup: Record<string, number>;
  total: number;
}
/** `weeks` semanas hasta la actual, con el valor repartido por grupo de deporte */
export function weeklyBuckets(acts: Activity[], weeks: number, metric: GoalMetric, now = new Date()): WeekBucket[] {
  const first = addDays(startOfWeek(now), -7 * (weeks - 1));
  const out: WeekBucket[] = [];
  for (let i = 0; i < weeks; i++) {
    const start = addDays(first, i * 7);
    out.push({ start, label: fmtDate(start), byGroup: {}, total: 0 });
  }
  for (const a of acts) {
    const idx = Math.floor((startOfWeek(new Date(a.date)).getTime() - first.getTime()) / (7 * DAY) + 0.5);
    if (idx < 0 || idx >= weeks) continue;
    const v = metricValue(a, metric);
    const g = groupOf(a.sport).id;
    out[idx].byGroup[g] = (out[idx].byGroup[g] ?? 0) + v;
    out[idx].total += v;
  }
  return out;
}

export function groupShare(acts: Activity[], metric: GoalMetric) {
  const sums: Record<string, number> = {};
  for (const a of acts) sums[groupOf(a.sport).id] = (sums[groupOf(a.sport).id] ?? 0) + metricValue(a, metric);
  return GROUPS.map((g) => ({ group: g, value: sums[g.id] ?? 0 })).filter((x) => x.value > 0);
}

/* ---------- Rachas ---------- */
export function streaks(acts: Activity[], now = new Date()) {
  const days = new Set(acts.map((a) => dayKey(a.date)));
  let current = 0;
  // La racha sigue viva si hoy aún no has entrenado pero ayer sí
  let cursor = days.has(dayKey(now)) ? startOfDay(now) : addDays(startOfDay(now), -1);
  while (days.has(dayKey(cursor))) {
    current++;
    cursor = addDays(cursor, -1);
  }
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const k of [...days].sort()) {
    const t = startOfDay(new Date(k + 'T12:00')).getTime();
    run = prev !== null && Math.round((t - prev) / DAY) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return { current, best, activeDays: days.size };
}

/* ---------- Objetivos y retos ---------- */
export function goalProgress(goal: Goal, acts: Activity[], now = new Date()) {
  const from = goal.period === 'week' ? startOfWeek(now) : startOfMonth(now);
  const to = goal.period === 'week' ? addDays(from, 7) : new Date(from.getFullYear(), from.getMonth() + 1, 1);
  const mine = inRange(acts, from, to).filter((a) => goal.sport === 'all' || a.sport === goal.sport);
  const value = mine.reduce((s, a) => s + metricValue(a, goal.metric), 0);
  return { value, pct: goal.target > 0 ? Math.min(1, value / goal.target) : 0, daysLeft: Math.ceil((to.getTime() - now.getTime()) / DAY) };
}

export function challengeProgress(c: Challenge, acts: Activity[], userId: string) {
  const from = new Date(c.start + 'T00:00');
  const to = addDays(new Date(c.end + 'T00:00'), 1);
  const mine = inRange(acts, from, to).filter((a) => a.userId === userId && (c.sport === 'all' || a.sport === c.sport));
  const value = mine.reduce((s, a) => s + metricValue(a, c.metric), 0);
  return { value, pct: c.target > 0 ? Math.min(1, value / c.target) : 0 };
}

/* ---------- Récords ---------- */
/** 1RM estimado (fórmula de Epley) */
export const epley1RM = (weight: number, reps: number) => (reps <= 1 ? weight : weight * (1 + reps / 30));

export interface PR {
  label: string;
  value: string;
  activity: Activity;
}
export function personalRecords(acts: Activity[], u: Units): PR[] {
  const out: PR[] = [];
  const best = (list: Activity[], score: (a: Activity) => number) =>
    list.reduce<Activity | null>((b, a) => (score(a) > (b ? score(b) : -Infinity) ? a : b), null);
  const runs = acts.filter((a) => groupOf(a.sport).id === 'run' && a.distanceKm);
  const rides = acts.filter((a) => groupOf(a.sport).id === 'ride' && a.distanceKm);
  for (const km of [5, 10, 21.1]) {
    const cand = best(runs.filter((a) => a.distanceKm! >= km), (a) => -a.durationSec / a.distanceKm!);
    if (cand) {
      const t = (cand.durationSec / cand.distanceKm!) * km;
      out.push({ label: km === 21.1 ? 'Media maratón' : `${km} km corriendo`, value: fmtClock(t), activity: cand });
    }
  }
  const longRun = best(runs, (a) => a.distanceKm!);
  if (longRun) out.push({ label: 'Carrera más larga', value: fmtDist(longRun.distanceKm!, u), activity: longRun });
  const longRide = best(rides, (a) => a.distanceKm!);
  if (longRide) out.push({ label: 'Salida en bici más larga', value: fmtDist(longRide.distanceKm!, u), activity: longRide });
  const fastRide = best(rides.filter((a) => a.distanceKm! >= 20), (a) => a.distanceKm! / a.durationSec);
  if (fastRide) out.push({ label: 'Bici más rápida (+20 km)', value: fmtSpeed(fastRide.durationSec, fastRide.distanceKm!, u), activity: fastRide });
  const climb = best(acts.filter((a) => a.elevationM), (a) => a.elevationM!);
  if (climb) out.push({ label: 'Mayor desnivel', value: `${fmtNum(climb.elevationM!, 0)} m`, activity: climb });
  const longest = best(acts, (a) => a.durationSec);
  if (longest) out.push({ label: 'Sesión más larga', value: fmtDur(longest.durationSec), activity: longest });
  return out;
}

/** Mejor 1RM estimado por ejercicio, y su evolución en el tiempo */
export function strengthRecords(acts: Activity[]) {
  const map = new Map<string, { best: number; history: { date: string; value: number }[] }>();
  const sorted = [...acts].sort((a, b) => a.date.localeCompare(b.date));
  for (const a of sorted) {
    if (!a.sets?.length) continue;
    const perEx = new Map<string, number>();
    for (const s of a.sets) {
      if (!s.weight) continue;
      perEx.set(s.exercise, Math.max(perEx.get(s.exercise) ?? 0, epley1RM(s.weight, s.reps)));
    }
    for (const [ex, v] of perEx) {
      const rec = map.get(ex) ?? { best: 0, history: [] };
      rec.best = Math.max(rec.best, v);
      rec.history.push({ date: a.date, value: Math.round(v * 10) / 10 });
      map.set(ex, rec);
    }
  }
  return [...map.entries()].map(([exercise, r]) => ({ exercise, ...r })).sort((a, b) => b.best - a.best);
}

/* ---------- Carga de entrenamiento ---------- */
/** Carga de una sesión por RPE: minutos × esfuerzo percibido */
export const sessionLoad = (a: Activity) => (a.durationSec / 60) * (a.rpe ?? 5);

/**
 * Modelo forma/fatiga: medias exponenciales de la carga diaria.
 * Forma física = 42 días, fatiga = 7 días, frescura = diferencia entre ambas.
 */
export function trainingLoad(acts: Activity[], days: number, now = new Date()) {
  const warmup = 180; // la media de 42 días necesita meses de historial para estabilizarse
  const start = addDays(startOfDay(now), -(days + warmup - 1));
  const daily = new Array(days + warmup).fill(0);
  for (const a of acts) {
    const i = Math.round((startOfDay(new Date(a.date)).getTime() - start.getTime()) / DAY);
    if (i >= 0 && i < daily.length) daily[i] += sessionLoad(a);
  }
  const kf = 1 - Math.exp(-1 / 42);
  const kt = 1 - Math.exp(-1 / 7);
  let fit = 0;
  let fat = 0;
  const out: { date: Date; fitness: number; fatigue: number; form: number; load: number }[] = [];
  daily.forEach((load, i) => {
    fit += (load - fit) * kf;
    fat += (load - fat) * kt;
    if (i >= warmup) out.push({ date: addDays(start, i), fitness: fit, fatigue: fat, form: fit - fat, load });
  });
  return out;
}

export function formStatus(form: number, fitness: number) {
  const r = fitness > 0 ? form / fitness : 0;
  if (r > 0.15) return { label: 'Descansado', tone: 'good' as const, hint: 'Buen momento para una sesión exigente.' };
  if (r > -0.2) return { label: 'En equilibrio', tone: 'neutral' as const, hint: 'Carga sostenible, sigue así.' };
  if (r > -0.5) return { label: 'Cargando', tone: 'warn' as const, hint: 'Estás acumulando fatiga productiva.' };
  return { label: 'Muy fatigado', tone: 'bad' as const, hint: 'Programa un día suave o de descanso.' };
}

/* ---------- Logros ---------- */
export interface Badge {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  progress: number; // 0..1
  done: boolean;
}
export function achievements(acts: Activity[], now = new Date()): Badge[] {
  const t = totals(acts);
  const st = streaks(acts, now);
  const sports = new Set(acts.map((a) => a.sport)).size;
  const longestRun = Math.max(0, ...acts.filter((a) => groupOf(a.sport).id === 'run').map((a) => a.distanceKm ?? 0));
  const early = acts.filter((a) => new Date(a.date).getHours() < 7).length;
  const mk = (id: string, emoji: string, name: string, desc: string, value: number, target: number): Badge => ({
    id, emoji, name, desc, progress: Math.min(1, value / target), done: value >= target,
  });
  return [
    mk('first', '🎬', 'Primer paso', 'Registra tu primera sesión', t.sessions, 1),
    mk('s25', '🔁', 'Constante', '25 sesiones registradas', t.sessions, 25),
    mk('s100', '💯', 'Centenario', '100 sesiones registradas', t.sessions, 100),
    mk('km100', '🛣️', '100 km', 'Suma 100 km en total', t.distanceKm, 100),
    mk('km500', '🌍', '500 km', 'Suma 500 km en total', t.distanceKm, 500),
    mk('streak7', '🔥', 'Semana perfecta', '7 días seguidos entrenando', st.best, 7),
    mk('half', '🏅', 'Media maratón', 'Corre 21,1 km de una vez', longestRun, 21.1),
    mk('multi', '🎽', 'Polideportivo', 'Practica 5 deportes distintos', sports, 5),
    mk('early', '🌅', 'Madrugador', '5 sesiones antes de las 7:00', early, 5),
    mk('climb', '⛰️', 'Cabra montesa', '5.000 m de desnivel acumulado', t.elevationM, 5000),
  ];
}

/* ---------- Clasificación ---------- */
export function leaderboard(acts: Activity[], userIds: string[], metric: GoalMetric, from: Date, to: Date) {
  const sums = new Map(userIds.map((id) => [id, 0]));
  for (const a of inRange(acts, from, to)) {
    if (sums.has(a.userId)) sums.set(a.userId, sums.get(a.userId)! + metricValue(a, metric));
  }
  return [...sums.entries()].map(([userId, value]) => ({ userId, value })).sort((a, b) => b.value - a.value);
}
