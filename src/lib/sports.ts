export interface SportGroup {
  id: string;
  name: string;
  /** token CSS de la serie (orden fijo, nunca se recicla) */
  color: string;
}

export interface Sport {
  id: string;
  name: string;
  group: string;
  emoji: string;
  hasDistance: boolean;
  hasSets?: boolean;
  /** Equivalente metabólico aproximado, para estimar calorías */
  met: number;
}

export const GROUPS: SportGroup[] = [
  { id: 'run', name: 'Carrera', color: 'var(--s1)' },
  { id: 'ride', name: 'Ciclismo', color: 'var(--s2)' },
  { id: 'swim', name: 'Natación', color: 'var(--s3)' },
  { id: 'strength', name: 'Fuerza', color: 'var(--s4)' },
  { id: 'hike', name: 'Montaña', color: 'var(--s5)' },
  { id: 'ball', name: 'Equipo y raqueta', color: 'var(--s6)' },
  { id: 'mind', name: 'Movilidad', color: 'var(--s7)' },
  { id: 'other', name: 'Otros', color: 'var(--s8)' },
];

export const SPORTS: Sport[] = [
  { id: 'run', name: 'Correr', group: 'run', emoji: '🏃', hasDistance: true, met: 9.8 },
  { id: 'trail', name: 'Trail', group: 'run', emoji: '⛰️', hasDistance: true, met: 10.5 },
  { id: 'walk', name: 'Caminar', group: 'hike', emoji: '🚶', hasDistance: true, met: 3.8 },
  { id: 'hike', name: 'Senderismo', group: 'hike', emoji: '🥾', hasDistance: true, met: 6 },
  { id: 'ride', name: 'Ciclismo', group: 'ride', emoji: '🚴', hasDistance: true, met: 8 },
  { id: 'mtb', name: 'MTB', group: 'ride', emoji: '🚵', hasDistance: true, met: 8.5 },
  { id: 'swim', name: 'Natación', group: 'swim', emoji: '🏊', hasDistance: true, met: 8 },
  { id: 'gym', name: 'Gimnasio', group: 'strength', emoji: '🏋️', hasDistance: false, hasSets: true, met: 5 },
  { id: 'crossfit', name: 'CrossFit / HIIT', group: 'strength', emoji: '🤸', hasDistance: false, hasSets: true, met: 8 },
  { id: 'football', name: 'Fútbol', group: 'ball', emoji: '⚽', hasDistance: true, met: 7 },
  { id: 'padel', name: 'Pádel', group: 'ball', emoji: '🎾', hasDistance: false, met: 6 },
  { id: 'tennis', name: 'Tenis', group: 'ball', emoji: '🎾', hasDistance: false, met: 7.3 },
  { id: 'basket', name: 'Baloncesto', group: 'ball', emoji: '🏀', hasDistance: false, met: 6.5 },
  { id: 'yoga', name: 'Yoga', group: 'mind', emoji: '🧘', hasDistance: false, met: 2.8 },
  { id: 'pilates', name: 'Pilates', group: 'mind', emoji: '🤍', hasDistance: false, met: 3 },
  { id: 'climb', name: 'Escalada', group: 'other', emoji: '🧗', hasDistance: false, met: 7.5 },
  { id: 'row', name: 'Remo', group: 'other', emoji: '🚣', hasDistance: true, met: 7 },
  { id: 'ski', name: 'Esquí', group: 'other', emoji: '⛷️', hasDistance: true, met: 7 },
  { id: 'box', name: 'Boxeo', group: 'other', emoji: '🥊', hasDistance: false, met: 9 },
  { id: 'other', name: 'Otro', group: 'other', emoji: '✨', hasDistance: false, met: 5 },
];

const byId = new Map(SPORTS.map((s) => [s.id, s]));
const groupById = new Map(GROUPS.map((g) => [g.id, g]));

export const sportOf = (id: string): Sport => byId.get(id) ?? byId.get('other')!;
export const groupOf = (sportId: string): SportGroup => groupById.get(sportOf(sportId).group)!;
export const sportName = (id: string) => (id === 'all' ? 'Todos los deportes' : sportOf(id).name);

export const EXERCISES = [
  'Sentadilla', 'Press banca', 'Peso muerto', 'Press militar', 'Dominadas', 'Remo con barra',
  'Hip thrust', 'Zancadas', 'Fondos', 'Curl de bíceps', 'Plancha', 'Prensa',
];
