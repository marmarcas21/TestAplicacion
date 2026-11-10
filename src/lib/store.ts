import { useSyncExternalStore } from 'react';
import { estimateCalories } from './metrics';
import { can, canEditActivity, ROLE_LABEL, type Permission } from './permissions';
import { createSeed, DB_VERSION, DEMO_PASSWORD } from './seed';
import type { Activity, BodyEntry, Challenge, DB, Goal, Plan, Role, ThemePref, User } from './types';

/*
 * Capa de datos. Todo vive en el navegador (localStorage), así que los roles
 * se aplican aquí, en cada acción, y no solo escondiendo botones en la interfaz.
 * Para pasar a un backend real basta con reimplementar estas funciones.
 */

const KEY = 'rutalibre-sport-db';
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const db = JSON.parse(raw) as DB;
      if (db.version === DB_VERSION && Array.isArray(db.users)) return db;
    }
  } catch {
    /* almacenamiento bloqueado o corrupto: se arranca con los datos de ejemplo */
  }
  return createSeed();
}

let db: DB = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* sin almacenamiento la app sigue funcionando en memoria */
  }
}

function commit(next: DB) {
  db = next;
  persist();
  listeners.forEach((l) => l());
}

export const getDB = () => db;
export const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useDB = () => useSyncExternalStore(subscribe, getDB, getDB);
export const currentUser = (d: DB = db) => d.users.find((u) => u.id === d.sessionUserId && u.status === 'active') ?? null;
export const userById = (id: string, d: DB = db) => d.users.find((u) => u.id === id);

export class PermissionError extends Error {}

function requireUser(perm?: Permission): User {
  const me = currentUser();
  if (!me) throw new PermissionError('Inicia sesión para continuar.');
  if (perm && !can(me, perm)) throw new PermissionError(`Tu rol (${ROLE_LABEL[me.role]}) no permite esta acción.`);
  return me;
}

function audit(d: DB, userId: string, action: string, detail: string): DB {
  return { ...d, audit: [{ id: uid(), at: new Date().toISOString(), userId, action, detail }, ...d.audit].slice(0, 300) };
}

/* ---------- Sesión ---------- */
export async function hashPassword(email: string, password: string): Promise<string> {
  const text = `rutalibre:${email.toLowerCase()}:${password}`;
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return 'f' + (h >>> 0).toString(16);
}

export async function login(email: string, password: string) {
  const u = db.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
  if (!u) throw new Error('No hay ninguna cuenta con ese correo.');
  const ok = u.passHash === 'demo' ? password === DEMO_PASSWORD : u.passHash === (await hashPassword(u.email, password));
  if (!ok) throw new Error('La contraseña no es correcta.');
  if (u.status !== 'active') throw new Error('Esta cuenta está suspendida. Habla con un administrador.');
  commit({ ...db, sessionUserId: u.id });
}

export function loginAs(userId: string) {
  const u = userById(userId);
  if (!u || u.passHash !== 'demo' || u.status !== 'active') throw new Error('Cuenta de ejemplo no disponible.');
  commit({ ...db, sessionUserId: u.id });
}

const COLORS = ['#e0522b', '#2b6fe0', '#1b8a5a', '#a855c9', '#0e8f9c', '#c2410c', '#be185d'];

export async function register(name: string, email: string, password: string) {
  name = name.trim();
  email = email.trim().toLowerCase();
  if (name.length < 2) throw new Error('Escribe tu nombre.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Ese correo no parece válido.');
  if (password.length < 8) throw new Error('La contraseña necesita al menos 8 caracteres.');
  if (db.users.some((u) => u.email.toLowerCase() === email)) throw new Error('Ya existe una cuenta con ese correo.');
  const u: User = {
    id: 'u_' + uid(), name, email, passHash: await hashPassword(email, password), role: 'athlete',
    color: COLORS[db.users.length % COLORS.length], bio: '', createdAt: new Date().toISOString(), status: 'active',
    friends: [], units: 'km', weightKg: 70, defaultVisibility: 'friends',
  };
  commit(audit({ ...db, users: [...db.users, u], sessionUserId: u.id }, u.id, 'Alta de usuario', `${name} se ha registrado`));
}

export const logout = () => commit({ ...db, sessionUserId: null });
export const setTheme = (theme: ThemePref) => commit({ ...db, theme });

/* ---------- Perfil y amistades ---------- */
export function updateProfile(patch: Partial<Pick<User, 'name' | 'bio' | 'units' | 'weightKg' | 'defaultVisibility' | 'color'>>) {
  const me = requireUser();
  commit({ ...db, users: db.users.map((u) => (u.id === me.id ? { ...u, ...patch } : u)) });
}

export function toggleFriend(otherId: string) {
  const me = requireUser('social.interact');
  const has = me.friends.includes(otherId);
  commit({
    ...db,
    users: db.users.map((u) => {
      if (u.id === me.id) return { ...u, friends: has ? u.friends.filter((f) => f !== otherId) : [...u.friends, otherId] };
      if (u.id === otherId) return { ...u, friends: has ? u.friends.filter((f) => f !== me.id) : [...u.friends, me.id] };
      return u;
    }),
  });
}

/* ---------- Sesiones de entrenamiento ---------- */
export type ActivityInput = Omit<Activity, 'id' | 'userId' | 'kudos' | 'comments'> & { id?: string };

export function saveActivity(input: ActivityInput): string {
  const me = requireUser('activity.write');
  if (!input.durationSec || input.durationSec <= 0) throw new Error('Indica cuánto duró la sesión.');
  if (input.id) {
    const prev = db.activities.find((a) => a.id === input.id);
    if (!prev) throw new Error('Esa sesión ya no existe.');
    if (!canEditActivity(me, prev)) throw new PermissionError('Solo puedes editar tus propias sesiones.');
    const owner = userById(prev.userId) ?? me;
    const next: Activity = { ...prev, ...input, id: prev.id, calories: input.calories || estimateCalories(input.sport, input.durationSec, owner.weightKg) };
    commit({ ...db, activities: db.activities.map((a) => (a.id === prev.id ? next : a)) });
    return prev.id;
  }
  const a: Activity = {
    ...input, id: 'a_' + uid(), userId: me.id, kudos: [], comments: [],
    calories: input.calories || estimateCalories(input.sport, input.durationSec, me.weightKg),
  };
  let next: DB = { ...db, activities: [a, ...db.activities] };
  if (a.planSessionKey) next = { ...next, planDone: { ...next.planDone, [a.planSessionKey]: true } };
  commit(next);
  return a.id;
}

export function deleteActivity(id: string) {
  const me = requireUser();
  const a = db.activities.find((x) => x.id === id);
  if (!a) return;
  if (!canEditActivity(me, a)) throw new PermissionError('No puedes borrar esta sesión.');
  let next: DB = { ...db, activities: db.activities.filter((x) => x.id !== id) };
  if (a.userId !== me.id) next = audit(next, me.id, 'Sesión moderada', `Borrada «${a.title}» de ${userById(a.userId)?.name ?? '?'}`);
  commit(next);
}

export function rateActivity(id: string, rating: number) {
  const me = requireUser('activity.write');
  commit({ ...db, activities: db.activities.map((a) => (a.id === id && a.userId === me.id ? { ...a, rating } : a)) });
}

export function toggleKudos(id: string) {
  const me = requireUser('social.interact');
  commit({
    ...db,
    activities: db.activities.map((a) =>
      a.id === id ? { ...a, kudos: a.kudos.includes(me.id) ? a.kudos.filter((k) => k !== me.id) : [...a.kudos, me.id] } : a,
    ),
  });
}

export function addComment(id: string, text: string) {
  const me = requireUser('social.interact');
  text = text.trim();
  if (!text) return;
  commit({
    ...db,
    activities: db.activities.map((a) =>
      a.id === id ? { ...a, comments: [...a.comments, { id: uid(), userId: me.id, text: text.slice(0, 400), at: new Date().toISOString() }] } : a,
    ),
  });
}

export function deleteComment(activityId: string, commentId: string) {
  const me = requireUser();
  commit({
    ...db,
    activities: db.activities.map((a) => {
      if (a.id !== activityId) return a;
      return { ...a, comments: a.comments.filter((c) => c.id !== commentId || !(c.userId === me.id || a.userId === me.id || can(me, 'activity.moderate'))) };
    }),
  });
}

/* ---------- Objetivos ---------- */
export function saveGoal(g: Omit<Goal, 'id' | 'userId'> & { id?: string }) {
  const me = requireUser('goal.own');
  if (!(g.target > 0)) throw new Error('El objetivo debe ser mayor que cero.');
  const goal: Goal = { ...g, id: g.id ?? 'g_' + uid(), userId: me.id };
  commit({ ...db, goals: g.id ? db.goals.map((x) => (x.id === g.id && x.userId === me.id ? goal : x)) : [...db.goals, goal] });
}
export function deleteGoal(id: string) {
  const me = requireUser('goal.own');
  commit({ ...db, goals: db.goals.filter((g) => !(g.id === id && g.userId === me.id)) });
}

/* ---------- Planes ---------- */
export function savePlan(p: Omit<Plan, 'id' | 'coachId' | 'createdAt'> & { id?: string }) {
  const me = requireUser('plan.manage');
  if (!p.name.trim()) throw new Error('Ponle un nombre al plan.');
  if (p.id) {
    const prev = db.plans.find((x) => x.id === p.id);
    if (!prev) throw new Error('Ese plan ya no existe.');
    if (prev.coachId !== me.id && !can(me, 'user.manage')) throw new PermissionError('Solo su autor puede editar este plan.');
    commit(audit({ ...db, plans: db.plans.map((x) => (x.id === p.id ? { ...prev, ...p, id: prev.id } : x)) }, me.id, 'Plan editado', p.name));
  } else {
    const plan: Plan = { ...p, id: 'p_' + uid(), coachId: me.id, createdAt: new Date().toISOString() };
    commit(audit({ ...db, plans: [...db.plans, plan] }, me.id, 'Plan creado', p.name));
  }
}
export function deletePlan(id: string) {
  const me = requireUser('plan.manage');
  const prev = db.plans.find((x) => x.id === id);
  if (!prev) return;
  if (prev.coachId !== me.id && !can(me, 'user.manage')) throw new PermissionError('Solo su autor puede borrar este plan.');
  commit(audit({ ...db, plans: db.plans.filter((x) => x.id !== id) }, me.id, 'Plan borrado', prev.name));
}
export function togglePlanDone(key: string) {
  requireUser('activity.write');
  const planDone = { ...db.planDone };
  if (planDone[key]) delete planDone[key];
  else planDone[key] = true;
  commit({ ...db, planDone });
}

/* ---------- Retos ---------- */
export function saveChallenge(c: Omit<Challenge, 'id' | 'createdBy' | 'participants'>) {
  const me = requireUser('challenge.manage');
  if (!c.name.trim()) throw new Error('Ponle un nombre al reto.');
  if (!(c.target > 0)) throw new Error('La meta debe ser mayor que cero.');
  if (c.end < c.start) throw new Error('La fecha de fin es anterior a la de inicio.');
  const ch: Challenge = { ...c, id: 'ch_' + uid(), createdBy: me.id, participants: [me.id] };
  commit(audit({ ...db, challenges: [ch, ...db.challenges] }, me.id, 'Reto creado', c.name));
}
export function deleteChallenge(id: string) {
  const me = requireUser('challenge.manage');
  const c = db.challenges.find((x) => x.id === id);
  if (!c) return;
  if (c.createdBy !== me.id && !can(me, 'user.manage')) throw new PermissionError('Solo su autor puede borrar este reto.');
  commit(audit({ ...db, challenges: db.challenges.filter((x) => x.id !== id) }, me.id, 'Reto borrado', c.name));
}
export function toggleChallenge(id: string) {
  const me = requireUser('challenge.join');
  commit({
    ...db,
    challenges: db.challenges.map((c) =>
      c.id === id ? { ...c, participants: c.participants.includes(me.id) ? c.participants.filter((p) => p !== me.id) : [...c.participants, me.id] } : c,
    ),
  });
}

/* ---------- Cuerpo ---------- */
export function saveBody(e: Omit<BodyEntry, 'id' | 'userId'>) {
  const me = requireUser('body.own');
  if (!(e.weightKg > 20 && e.weightKg < 400)) throw new Error('Revisa el peso: debe estar en kilos.');
  const rest = db.body.filter((b) => !(b.userId === me.id && b.date === e.date));
  commit({
    ...db,
    body: [...rest, { ...e, id: 'b_' + uid(), userId: me.id }],
    users: db.users.map((u) => (u.id === me.id ? { ...u, weightKg: e.weightKg } : u)),
  });
}
export function deleteBody(id: string) {
  const me = requireUser('body.own');
  commit({ ...db, body: db.body.filter((b) => !(b.id === id && b.userId === me.id)) });
}

/* ---------- Administración ---------- */
function guardLastAdmin(target: User, stillAdmin: boolean) {
  if (target.role === 'admin' && !stillAdmin) {
    const admins = db.users.filter((u) => u.role === 'admin' && u.status === 'active');
    if (admins.length <= 1) throw new Error('Tiene que quedar al menos un administrador activo.');
  }
}

export function setRole(userId: string, role: Role) {
  const me = requireUser('user.manage');
  const target = userById(userId);
  if (!target || target.role === role) return;
  guardLastAdmin(target, role === 'admin');
  let users = db.users.map((u) => (u.id === userId ? { ...u, role } : u));
  // Si deja de ser entrenador, sus atletas quedan sin asignar
  if (target.role === 'coach' && role !== 'coach' && role !== 'admin') users = users.map((u) => (u.coachId === userId ? { ...u, coachId: undefined } : u));
  commit(audit({ ...db, users }, me.id, 'Rol cambiado', `${target.name}: ${ROLE_LABEL[target.role]} → ${ROLE_LABEL[role]}`));
}

export function setStatus(userId: string, status: User['status']) {
  const me = requireUser('user.manage');
  const target = userById(userId);
  if (!target) return;
  if (target.id === me.id) throw new Error('No puedes suspender tu propia cuenta.');
  guardLastAdmin(target, status === 'active');
  commit(audit({ ...db, users: db.users.map((u) => (u.id === userId ? { ...u, status } : u)) }, me.id, status === 'active' ? 'Cuenta reactivada' : 'Cuenta suspendida', target.name));
}

export function assignCoach(athleteId: string, coachId: string | undefined) {
  const me = requireUser('user.manage');
  const target = userById(athleteId);
  if (!target) return;
  commit(audit({ ...db, users: db.users.map((u) => (u.id === athleteId ? { ...u, coachId } : u)) }, me.id, 'Entrenador asignado', `${target.name} → ${coachId ? userById(coachId)?.name : 'sin entrenador'}`));
}

export function exportData(scope: 'mine' | 'all'): string {
  const me = requireUser();
  if (scope === 'all') {
    requireUser('data.admin');
    return JSON.stringify({ ...db, sessionUserId: null }, null, 2);
  }
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    profile: { name: me.name, email: me.email, units: me.units },
    activities: db.activities.filter((a) => a.userId === me.id),
    goals: db.goals.filter((g) => g.userId === me.id),
    body: db.body.filter((b) => b.userId === me.id),
  }, null, 2);
}

export function exportCsv(): string {
  const me = requireUser();
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = db.activities.filter((a) => a.userId === me.id).sort((a, b) => b.date.localeCompare(a.date))
    .map((a) => [a.date, a.sport, a.title, Math.round(a.durationSec / 60), a.distanceKm ?? '', a.elevationM ?? '', a.avgHr ?? '', a.rpe ?? '', a.calories ?? '', a.rating || '', a.notes].map(esc).join(','));
  return ['fecha,deporte,titulo,minutos,km,desnivel_m,fc_media,rpe,kcal,valoracion,notas', ...rows].join('\n');
}

export function importMyActivities(json: string): number {
  const me = requireUser('activity.write');
  let data: any;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  const list: any[] = Array.isArray(data) ? data : data?.activities;
  if (!Array.isArray(list)) throw new Error('No se han encontrado sesiones en el archivo.');
  const existing = new Set(db.activities.map((a) => a.id));
  const clean: Activity[] = [];
  for (const a of list) {
    if (!a || typeof a.sport !== 'string' || !a.date || !(a.durationSec > 0) || isNaN(Date.parse(a.date))) continue;
    clean.push({
      id: existing.has(a.id) || !a.id ? 'a_' + uid() : String(a.id), userId: me.id, sport: a.sport, title: String(a.title ?? 'Sesión importada'),
      date: new Date(a.date).toISOString(), durationSec: Number(a.durationSec), distanceKm: a.distanceKm ? Number(a.distanceKm) : undefined,
      elevationM: a.elevationM ? Number(a.elevationM) : undefined, avgHr: a.avgHr ? Number(a.avgHr) : undefined, rpe: a.rpe ? Number(a.rpe) : undefined,
      calories: a.calories ? Number(a.calories) : undefined, rating: Number(a.rating) || 0, notes: String(a.notes ?? ''),
      route: Array.isArray(a.route) ? a.route : undefined, elevProfile: Array.isArray(a.elevProfile) ? a.elevProfile : undefined,
      sets: Array.isArray(a.sets) ? a.sets : undefined, visibility: me.defaultVisibility, kudos: [], comments: [],
    });
  }
  if (!clean.length) throw new Error('Ninguna sesión del archivo tenía el formato esperado.');
  commit({ ...db, activities: [...clean, ...db.activities] });
  return clean.length;
}

export function resetData() {
  const me = requireUser('data.admin');
  const fresh = createSeed();
  commit({ ...fresh, sessionUserId: fresh.users.some((u) => u.id === me.id) ? me.id : null, theme: db.theme });
}

/** Solo para tests */
export function __setDB(next: DB) {
  db = next;
}
