import { addDays, dayKey, estimateCalories, startOfDay, startOfWeek, weekdayIdx } from './metrics';
import type { Activity, BodyEntry, DB, GymSet, User } from './types';

export const DB_VERSION = 3;
export const DEMO_PASSWORD = 'demo1234';

/** Generador determinista: los datos de ejemplo son los mismos en cada carga */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRoute(rnd: () => number): [number, number][] {
  const n = 9 + Math.floor(rnd() * 5);
  const rot = rnd() * Math.PI * 2;
  const open = rnd() < 0.35 ? 0.82 : 1; // algunas rutas no cierran el bucle
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const ang = rot + (i / n) * Math.PI * 2 * open;
    const r = 22 + rnd() * 20;
    pts.push([Math.round(50 + Math.cos(ang) * r), Math.round(50 + Math.sin(ang) * r * 0.9)]);
  }
  if (open === 1) pts.push([pts[0][0] + 3, pts[0][1] - 4]);
  return pts;
}

function makeElev(rnd: () => number, gain: number): number[] {
  const out: number[] = [];
  const base = 600 + rnd() * 200;
  const p1 = rnd() * 6;
  const p2 = rnd() * 6;
  for (let i = 0; i < 48; i++) {
    const x = i / 47;
    out.push(Math.round(base + (gain / 2.4) * (Math.sin(x * 5 + p1) + 0.5 * Math.sin(x * 13 + p2)) + gain * 0.15 * Math.sin(x * Math.PI)));
  }
  return out;
}

const user = (id: string, name: string, role: User['role'], color: string, bio: string, extra: Partial<User> = {}): User => ({
  id, name, role, color, bio,
  email: `${name.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}@rutalibre.app`,
  passHash: 'demo', createdAt: new Date(Date.now() - 200 * 86400000).toISOString(), status: 'active',
  friends: [], units: 'km', weightKg: 70, defaultVisibility: 'friends', ...extra,
});

const RUN_TITLES = ['Rodaje suave', 'Vuelta al Retiro', 'Series en pista', 'Tirada larga', 'Casa de Campo', 'Madrid Río', 'Rodaje progresivo', 'Cuestas en Ferraz'];
const RIDE_TITLES = ['Salida a El Pardo', 'Anillo Verde', 'Puerto de la Morcuera', 'Colmenar y vuelta', 'Rodillo en casa'];
const COMMENTS = [
  'La cuesta del final casi me mata, pero qué vistas arriba 😅', 'Contento con el ritmo, piernas frescas.',
  'Poco a poco tras la lesión.', 'Hoy costó arrancar, luego fluyó.', 'Mucho viento de cara a la vuelta.',
  'Sesión redonda, de las que enganchan.', '', '', '',
];
const REPLIES = ['¡Qué máquina! 💪', 'Buen ritmo, a por más.', 'El domingo me apunto.', 'Brutal esa subida.', '¡Vamos!'];

interface Profile {
  runs: number[]; // días de la semana (0 = lunes)
  gym: number[];
  ride: number[];
  extra: [number, string][];
  pace: number; // seg/km
  skip: number;
}

const PROFILES: Record<string, Profile> = {
  u_alex: { runs: [1, 3, 6], gym: [0, 4], ride: [5], extra: [[2, 'padel']], pace: 335, skip: 0.2 },
  u_marta: { runs: [0, 2, 4, 6], gym: [3], ride: [], extra: [[5, 'yoga']], pace: 318, skip: 0.18 },
  u_diego: { runs: [2], gym: [0, 3], ride: [5, 6], extra: [[1, 'football']], pace: 345, skip: 0.28 },
  u_laura: { runs: [1, 5], gym: [], ride: [], extra: [[3, 'swim'], [6, 'hike'], [0, 'pilates']], pace: 362, skip: 0.3 },
  u_elena: { runs: [0, 3], gym: [1], ride: [5], extra: [[6, 'trail']], pace: 295, skip: 0.25 },
};

function generateActivities(now: Date, users: User[]): Activity[] {
  const acts: Activity[] = [];
  const days = 150;
  let n = 0;
  for (const u of users) {
    const p = PROFILES[u.id];
    if (!p) continue;
    const rnd = mulberry32(u.id.split('').reduce((s, c) => s + c.charCodeAt(0), 7) * 9973);
    const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
    const others = users.filter((x) => x.id !== u.id && PROFILES[x.id]).map((x) => x.id);
    for (let d = days; d >= 0; d--) {
      const date = addDays(startOfDay(now), -d);
      const wd = weekdayIdx(date);
      const prog = 1 - d / days; // 0 al principio → 1 hoy: el ritmo y los pesos mejoran
      const todo: string[] = [];
      if (p.runs.includes(wd)) todo.push('run');
      if (p.gym.includes(wd)) todo.push('gym');
      if (p.ride.includes(wd)) todo.push('ride');
      for (const [day, s] of p.extra) if (day === wd) todo.push(s);
      for (const sport of todo) {
        if (rnd() < p.skip) continue;
        // Hoy solo cuenta lo que ya habría pasado
        const hour = rnd() < 0.18 ? 6 : pick([7, 8, 18, 19, 20]);
        const when = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, Math.floor(rnd() * 12) * 5);
        if (when.getTime() > now.getTime()) continue;
        const a: Activity = {
          id: `seed_${n++}`, userId: u.id, sport, title: '', date: when.toISOString(), durationSec: 0,
          rating: rnd() < 0.75 ? 3 + Math.floor(rnd() * 3) : 0, notes: '', visibility: rnd() < 0.2 ? 'public' : 'friends',
          kudos: others.filter(() => rnd() < 0.4), comments: [],
        };
        if (sport === 'run' || sport === 'trail') {
          const long = wd === 6;
          const km = long ? 12 + rnd() * 7 + prog * 4 : 5 + rnd() * 5;
          const pace = p.pace * (1.06 - prog * 0.09) * (long ? 1.04 : 1) * (0.97 + rnd() * 0.06) * (sport === 'trail' ? 1.25 : 1);
          a.distanceKm = Math.round(km * 10) / 10;
          a.durationSec = Math.round(a.distanceKm * pace);
          a.elevationM = Math.round(km * (sport === 'trail' ? 45 : 6 + rnd() * 10));
          a.avgHr = Math.round(142 + rnd() * 22);
          a.rpe = long ? 7 + Math.floor(rnd() * 2) : 4 + Math.floor(rnd() * 4);
          a.title = sport === 'trail' ? 'Trail por la Pedriza' : long ? 'Tirada larga' : pick(RUN_TITLES);
          a.route = makeRoute(rnd);
          a.elevProfile = makeElev(rnd, a.elevationM);
        } else if (sport === 'ride') {
          const km = 28 + rnd() * 45;
          a.distanceKm = Math.round(km * 10) / 10;
          a.durationSec = Math.round((km / (23 + rnd() * 5 + prog * 2)) * 3600);
          a.elevationM = Math.round(km * (8 + rnd() * 12));
          a.avgHr = Math.round(128 + rnd() * 22);
          a.rpe = 5 + Math.floor(rnd() * 3);
          a.title = pick(RIDE_TITLES);
          a.route = makeRoute(rnd);
          a.elevProfile = makeElev(rnd, a.elevationM);
        } else if (sport === 'gym') {
          const upper = rnd() < 0.5;
          const plan: [string, number][] = upper
            ? [['Press banca', 52], ['Dominadas', 0], ['Press militar', 34], ['Remo con barra', 48]]
            : [['Sentadilla', 72], ['Peso muerto', 92], ['Hip thrust', 80], ['Zancadas', 24]];
          const sets: GymSet[] = [];
          for (const [ex, base] of plan) {
            const w = base ? Math.round((base * (1 + prog * 0.18) * (0.97 + rnd() * 0.06)) / 2.5) * 2.5 : 0;
            for (let s = 0; s < 3; s++) sets.push({ exercise: ex, reps: base ? 5 + Math.floor(rnd() * 4) : 6 + Math.floor(rnd() * 5), weight: w });
          }
          a.sets = sets;
          a.durationSec = (50 + Math.floor(rnd() * 25)) * 60;
          a.rpe = 6 + Math.floor(rnd() * 3);
          a.title = upper ? 'Fuerza · tren superior' : 'Fuerza · tren inferior';
        } else if (sport === 'swim') {
          a.distanceKm = Math.round((1.2 + rnd() * 1.4) * 10) / 10;
          a.durationSec = Math.round(a.distanceKm * (1250 - prog * 80));
          a.rpe = 5 + Math.floor(rnd() * 2);
          a.title = 'Piscina · técnica y series';
        } else if (sport === 'hike') {
          a.distanceKm = Math.round((9 + rnd() * 9) * 10) / 10;
          a.durationSec = Math.round(a.distanceKm * (820 + rnd() * 140));
          a.elevationM = Math.round(450 + rnd() * 650);
          a.rpe = 5 + Math.floor(rnd() * 2);
          a.title = pick(['Siete Picos', 'Peñalara', 'La Pedriza', 'Cascada del Purgatorio']);
          a.route = makeRoute(rnd);
          a.elevProfile = makeElev(rnd, a.elevationM);
        } else {
          a.durationSec = (sport === 'football' ? 90 : 60 + Math.floor(rnd() * 4) * 10) * 60;
          a.rpe = sport === 'yoga' || sport === 'pilates' ? 3 : 6 + Math.floor(rnd() * 2);
          if (sport === 'football') a.distanceKm = Math.round((6 + rnd() * 3) * 10) / 10;
          a.title = { padel: 'Partido de pádel', football: 'Liga de los martes', yoga: 'Vinyasa', pilates: 'Pilates suelo' }[sport] ?? 'Sesión';
        }
        a.calories = estimateCalories(sport, a.durationSec, u.weightKg);
        a.notes = pick(COMMENTS);
        if (d < 21 && rnd() < 0.3 && others.length) {
          const who = pick(others);
          a.comments.push({ id: `c_${a.id}`, userId: who, text: pick(REPLIES), at: new Date(when.getTime() + 3 * 3600000).toISOString() });
        }
        acts.push(a);
      }
    }
  }
  return acts;
}

function generateBody(now: Date): BodyEntry[] {
  const rnd = mulberry32(4242);
  const out: BodyEntry[] = [];
  for (let w = 20; w >= 0; w--) {
    const date = addDays(startOfDay(now), -w * 7);
    out.push({
      id: `b_${w}`, userId: 'u_alex', date: dayKey(date),
      weightKg: Math.round((74.6 - (20 - w) * 0.14 + (rnd() - 0.5) * 0.7) * 10) / 10,
      fatPct: Math.round((18.4 - (20 - w) * 0.11 + (rnd() - 0.5) * 0.5) * 10) / 10,
      restHr: Math.round(58 - (20 - w) * 0.25 + (rnd() - 0.5) * 3),
      sleepH: Math.round((7 + (rnd() - 0.5) * 1.6) * 10) / 10,
    });
  }
  return out;
}

export function createSeed(now = new Date()): DB {
  const users: User[] = [
    user('u_alex', 'Álex', 'athlete', '#e0522b', 'Corro, levanto y los miércoles pádel. Objetivo: media maratón en primavera.', { coachId: 'u_elena', weightKg: 72 }),
    user('u_marta', 'Marta', 'athlete', '#2b6fe0', 'Maratoniana en construcción.', { coachId: 'u_elena', weightKg: 58 }),
    user('u_diego', 'Diego', 'athlete', '#1b8a5a', 'Bici los findes, fútbol los martes.', { coachId: 'u_elena', weightKg: 78 }),
    user('u_laura', 'Laura', 'athlete', '#a855c9', 'Volviendo poco a poco tras la lesión.', { weightKg: 61 }),
    user('u_elena', 'Elena', 'coach', '#0e8f9c', 'Entrenadora de resistencia. Trail los domingos.', { weightKg: 60 }),
    user('u_sofia', 'Sofía', 'admin', '#4b4f66', 'Administra el club RutaLibre.'),
    user('u_invitado', 'Invitado', 'guest', '#8a8f9c', 'Cuenta de solo lectura.'),
  ];
  const crew = ['u_alex', 'u_marta', 'u_diego', 'u_laura', 'u_elena'];
  for (const u of users) if (crew.includes(u.id)) u.friends = crew.filter((id) => id !== u.id);

  const week = startOfWeek(now);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    version: DB_VERSION,
    users,
    activities: generateActivities(now, users),
    goals: [
      { id: 'g1', userId: 'u_alex', sport: 'run', metric: 'distance', period: 'week', target: 30 },
      { id: 'g2', userId: 'u_alex', sport: 'all', metric: 'sessions', period: 'week', target: 5 },
      { id: 'g3', userId: 'u_alex', sport: 'all', metric: 'time', period: 'month', target: 24 },
    ],
    plans: [
      {
        id: 'p1', coachId: 'u_elena', name: 'Media maratón · 12 semanas', createdAt: addDays(week, -42).toISOString(),
        description: 'Base aeróbica con una sesión de calidad y tirada larga progresiva el domingo.',
        athleteIds: ['u_alex', 'u_marta'],
        sessions: [
          { id: 'ps1', day: 0, sport: 'gym', title: 'Fuerza general', desc: 'Sentadilla, peso muerto y core. Sin llegar al fallo.', durationMin: 50 },
          { id: 'ps2', day: 1, sport: 'run', title: 'Rodaje suave', desc: 'Ritmo de conversación, zona 2.', durationMin: 45, distanceKm: 8 },
          { id: 'ps3', day: 3, sport: 'run', title: 'Series 6 × 800 m', desc: 'Recupera 2 min al trote entre series.', durationMin: 55, distanceKm: 9 },
          { id: 'ps4', day: 4, sport: 'yoga', title: 'Movilidad', desc: 'Caderas y tobillos, 30 minutos.', durationMin: 30 },
          { id: 'ps5', day: 6, sport: 'run', title: 'Tirada larga', desc: 'Últimos 3 km a ritmo de media.', durationMin: 100, distanceKm: 17 },
        ],
      },
      {
        id: 'p2', coachId: 'u_elena', name: 'Base ciclista', createdAt: addDays(week, -20).toISOString(),
        description: 'Volumen en bici con fuerza de apoyo.',
        athleteIds: ['u_diego'],
        sessions: [
          { id: 'ps6', day: 0, sport: 'gym', title: 'Fuerza de piernas', desc: 'Prensa y zancadas.', durationMin: 50 },
          { id: 'ps7', day: 5, sport: 'ride', title: 'Fondo', desc: 'Cadencia alta, zona 2.', durationMin: 150, distanceKm: 60 },
          { id: 'ps8', day: 6, sport: 'ride', title: 'Puertos', desc: 'Dos subidas largas a ritmo sostenido.', durationMin: 120, distanceKm: 45 },
        ],
      },
    ],
    planDone: {},
    challenges: [
      { id: 'ch1', name: '100 km corriendo este mes', desc: 'Todo suma: rodajes, series y tiradas largas.', sport: 'run', metric: 'distance', target: 100, start: dayKey(new Date(now.getFullYear(), now.getMonth(), 1)), end: dayKey(monthEnd), createdBy: 'u_elena', participants: ['u_alex', 'u_marta', 'u_laura', 'u_elena'] },
      { id: 'ch2', name: '20 sesiones en 30 días', desc: 'Constancia por encima de todo. Vale cualquier deporte.', sport: 'all', metric: 'sessions', target: 20, start: dayKey(addDays(now, -12)), end: dayKey(addDays(now, 18)), createdBy: 'u_sofia', participants: ['u_alex', 'u_diego', 'u_marta'] },
      { id: 'ch3', name: '15 horas sobre la bici', desc: 'Carretera, montaña o rodillo.', sport: 'ride', metric: 'time', target: 15, start: dayKey(addDays(now, -5)), end: dayKey(addDays(now, 25)), createdBy: 'u_elena', participants: ['u_diego'] },
    ],
    body: generateBody(now),
    audit: [
      { id: 'au1', at: addDays(now, -42).toISOString(), userId: 'u_elena', action: 'Plan creado', detail: 'Media maratón · 12 semanas' },
      { id: 'au2', at: addDays(now, -30).toISOString(), userId: 'u_sofia', action: 'Rol cambiado', detail: 'Elena → Entrenador' },
      { id: 'au3', at: addDays(now, -12).toISOString(), userId: 'u_sofia', action: 'Reto creado', detail: '20 sesiones en 30 días' },
    ],
    sessionUserId: null,
    theme: 'system',
  };
}
