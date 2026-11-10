export type Role = 'admin' | 'coach' | 'athlete' | 'guest';
export type Visibility = 'public' | 'friends' | 'private';
export type Units = 'km' | 'mi';
export type ThemePref = 'system' | 'light' | 'dark';

export interface User {
  id: string;
  name: string;
  email: string;
  /** SHA-256 con sal. 'demo' = cuenta de ejemplo (contraseña demo1234). */
  passHash: string;
  role: Role;
  color: string;
  bio: string;
  createdAt: string;
  status: 'active' | 'suspended';
  coachId?: string;
  friends: string[];
  units: Units;
  weightKg: number;
  defaultVisibility: Visibility;
}

export interface GymSet {
  exercise: string;
  reps: number;
  weight: number;
}

export interface Comment {
  id: string;
  userId: string;
  text: string;
  at: string;
}

export interface Activity {
  id: string;
  userId: string;
  sport: string;
  title: string;
  /** ISO con hora local */
  date: string;
  durationSec: number;
  distanceKm?: number;
  elevationM?: number;
  avgHr?: number;
  /** Esfuerzo percibido 1-10 */
  rpe?: number;
  calories?: number;
  /** Valoración de la sesión 0-5 (0 = sin puntuar) */
  rating: number;
  notes: string;
  /** Ruta normalizada a una caja 0-100 */
  route?: [number, number][];
  /** Perfil de altitud en metros, muestreado */
  elevProfile?: number[];
  sets?: GymSet[];
  visibility: Visibility;
  kudos: string[];
  comments: Comment[];
  planSessionKey?: string;
}

export type GoalMetric = 'distance' | 'time' | 'sessions';

export interface Goal {
  id: string;
  userId: string;
  /** id de deporte o 'all' */
  sport: string;
  metric: GoalMetric;
  period: 'week' | 'month';
  target: number;
}

export interface PlanSession {
  id: string;
  /** 0 = lunes … 6 = domingo */
  day: number;
  sport: string;
  title: string;
  desc: string;
  durationMin: number;
  distanceKm?: number;
}

export interface Plan {
  id: string;
  coachId: string;
  name: string;
  description: string;
  athleteIds: string[];
  /** Semana tipo que se repite */
  sessions: PlanSession[];
  createdAt: string;
}

export interface Challenge {
  id: string;
  name: string;
  desc: string;
  sport: string;
  metric: GoalMetric;
  target: number;
  start: string;
  end: string;
  createdBy: string;
  participants: string[];
}

export interface BodyEntry {
  id: string;
  userId: string;
  date: string;
  weightKg: number;
  fatPct?: number;
  restHr?: number;
  sleepH?: number;
}

export interface AuditEntry {
  id: string;
  at: string;
  userId: string;
  action: string;
  detail: string;
}

export interface DB {
  version: number;
  users: User[];
  activities: Activity[];
  goals: Goal[];
  plans: Plan[];
  /** clave `${userId}|${sessionId}|${fecha}` → hecha */
  planDone: Record<string, boolean>;
  challenges: Challenge[];
  body: BodyEntry[];
  audit: AuditEntry[];
  sessionUserId: string | null;
  theme: ThemePref;
}
