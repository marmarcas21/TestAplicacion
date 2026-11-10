import { beforeEach, describe, expect, it } from 'vitest';
import { parseGpx, haversineKm } from '../src/lib/gpx';
import { epley1RM, fmtDur, fmtPace, goalProgress, personalRecords, startOfWeek, streaks, trainingLoad, weeklyBuckets } from '../src/lib/metrics';
import { can, canEditActivity, canViewActivity } from '../src/lib/permissions';
import { createSeed } from '../src/lib/seed';
import * as store from '../src/lib/store';
import type { Activity } from '../src/lib/types';

const NOW = new Date(2026, 10, 10, 20, 0); // martes
const act = (p: Partial<Activity>): Activity => ({
  id: Math.random().toString(36), userId: 'u_alex', sport: 'run', title: 't', date: NOW.toISOString(), durationSec: 1800,
  rating: 0, notes: '', visibility: 'friends', kudos: [], comments: [], ...p,
});
const daysAgo = (n: number) => new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - n, 9).toISOString();

describe('métricas', () => {
  it('formatea duración y ritmo', () => {
    expect(fmtDur(1920)).toBe('32 min');
    expect(fmtDur(3900)).toBe('1 h 05 min');
    expect(fmtPace(1800, 5, 'km')).toBe('6:00 /km');
  });
  it('la semana empieza en lunes', () => {
    expect(startOfWeek(NOW).getDay()).toBe(1);
    expect(startOfWeek(new Date(2026, 10, 15)).getDate()).toBe(9); // un domingo pertenece a la semana anterior
  });
  it('cuenta rachas, y la mantiene viva si hoy aún no has entrenado', () => {
    const acts = [1, 2, 3, 6, 7].map((d) => act({ date: daysAgo(d) }));
    expect(streaks(acts, NOW)).toMatchObject({ current: 3, best: 3, activeDays: 5 });
    expect(streaks([act({ date: daysAgo(2) })], NOW).current).toBe(0);
  });
  it('reparte el volumen por semana y grupo', () => {
    const b = weeklyBuckets([act({ distanceKm: 10 }), act({ sport: 'ride', distanceKm: 40 }), act({ date: daysAgo(8), distanceKm: 5 })], 2, 'distance', NOW);
    expect(b[1].total).toBe(50);
    expect(b[1].byGroup).toEqual({ run: 10, ride: 40 });
    expect(b[0].total).toBe(5);
  });
  it('calcula el progreso de un objetivo semanal', () => {
    const p = goalProgress({ id: 'g', userId: 'u_alex', sport: 'run', metric: 'distance', period: 'week', target: 20 },
      [act({ distanceKm: 8 }), act({ sport: 'ride', distanceKm: 30 }), act({ date: daysAgo(9), distanceKm: 12 })], NOW);
    expect(p.value).toBe(8);
    expect(p.pct).toBeCloseTo(0.4);
  });
  it('estima el 1RM y encuentra récords', () => {
    expect(epley1RM(100, 1)).toBe(100);
    expect(epley1RM(100, 6)).toBeCloseTo(120);
    const prs = personalRecords([act({ distanceKm: 10, durationSec: 3000 }), act({ distanceKm: 5, durationSec: 1400 })], 'km');
    expect(prs.find((p) => p.label === '5 km corriendo')?.value).toBe('23:20');
    expect(prs.find((p) => p.label === '10 km corriendo')?.value).toBe('50:00');
  });
  it('la fatiga reacciona antes que la forma', () => {
    const load = trainingLoad([0, 1, 2].map((d) => act({ date: daysAgo(d), durationSec: 3600, rpe: 8 })), 1, NOW)[0];
    expect(load.fatigue).toBeGreaterThan(load.fitness);
    expect(load.form).toBeLessThan(0);
  });
});

describe('GPX', () => {
  const gpx = `<?xml version="1.0"?><gpx><trk><name>Vuelta al Retiro</name><trkseg>
    <trkpt lat="40.4150" lon="-3.6840"><ele>650</ele><time>2026-11-08T08:00:00Z</time></trkpt>
    <trkpt lon="-3.6840" lat="40.4195"><ele>662</ele><time>2026-11-08T08:03:00Z</time></trkpt>
    <trkpt lat="40.4195" lon="-3.6790"><ele>661</ele><time>2026-11-08T08:06:00Z</time></trkpt>
    <trkpt lat="40.4150" lon="-3.6790"><ele>655</ele><time>2026-11-08T08:09:00Z</time></trkpt>
  </trkseg></trk></gpx>`;
  it('mide distancia, desnivel y duración', () => {
    const t = parseGpx(gpx);
    expect(t.name).toBe('Vuelta al Retiro');
    expect(t.distanceKm).toBeGreaterThan(1.3);
    expect(t.distanceKm).toBeLessThan(1.5);
    expect(t.elevationM).toBe(12);
    expect(t.durationSec).toBe(540);
    expect(t.route).toHaveLength(4);
    expect(t.route.flat().every((v) => v >= 8 && v <= 92)).toBe(true);
  });
  it('rechaza archivos sin ruta', () => expect(() => parseGpx('<gpx></gpx>')).toThrow());
  it('haversine: un grado de latitud ≈ 111 km', () => expect(haversineKm({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111.19, 1));
});

describe('roles y permisos', () => {
  const db = createSeed(NOW);
  const u = (id: string) => db.users.find((x) => x.id === id)!;
  beforeEach(() => store.__setDB(createSeed(NOW)));

  it('cada rol tiene su alcance', () => {
    expect(can(u('u_invitado'), 'activity.write')).toBe(false);
    expect(can(u('u_alex'), 'activity.write')).toBe(true);
    expect(can(u('u_alex'), 'plan.manage')).toBe(false);
    expect(can(u('u_elena'), 'plan.manage')).toBe(true);
    expect(can(u('u_elena'), 'user.manage')).toBe(false);
    expect(can(u('u_sofia'), 'user.manage')).toBe(true);
    expect(can({ role: 'admin', status: 'suspended' }, 'user.manage')).toBe(false);
  });
  it('la privacidad de una sesión depende de quién mira', () => {
    const priv = act({ visibility: 'private' });
    expect(canViewActivity(u('u_alex'), priv, u('u_alex'))).toBe(true);
    expect(canViewActivity(u('u_marta'), priv, u('u_alex'))).toBe(false);
    expect(canViewActivity(u('u_elena'), priv, u('u_alex'))).toBe(true); // su entrenadora
    expect(canViewActivity(u('u_sofia'), priv, u('u_alex'))).toBe(true); // administración
    expect(canViewActivity(u('u_invitado'), act({ visibility: 'friends' }), u('u_alex'))).toBe(false);
    expect(canViewActivity(u('u_invitado'), act({ visibility: 'public' }), u('u_alex'))).toBe(true);
    expect(canEditActivity(u('u_elena'), priv)).toBe(false);
    expect(canEditActivity(u('u_sofia'), priv)).toBe(true);
  });
  it('la capa de datos rechaza lo que el rol no permite', () => {
    store.loginAs('u_invitado');
    expect(() => store.saveActivity(act({}))).toThrow(/rol/);
    expect(() => store.toggleKudos('seed_0')).toThrow(/rol/);
    store.loginAs('u_alex');
    expect(() => store.setRole('u_alex', 'admin')).toThrow(/rol/);
    expect(() => store.savePlan({ name: 'x', description: '', athleteIds: [], sessions: [] })).toThrow(/rol/);
    const id = store.saveActivity({ sport: 'run', title: 'Prueba', date: NOW.toISOString(), durationSec: 1800, distanceKm: 5, rating: 4, notes: '', visibility: 'private' });
    expect(store.getDB().activities.find((a) => a.id === id)?.calories).toBeGreaterThan(0);
    store.loginAs('u_marta');
    expect(() => store.deleteActivity(id)).toThrow();
  });
  it('un atleta no puede editar la sesión de otro, un admin sí puede borrarla', () => {
    store.loginAs('u_sofia');
    const target = store.getDB().activities.find((a) => a.userId === 'u_alex')!;
    store.deleteActivity(target.id);
    expect(store.getDB().activities.some((a) => a.id === target.id)).toBe(false);
    expect(store.getDB().audit[0].action).toBe('Sesión moderada');
  });
  it('siempre queda un administrador activo', () => {
    store.loginAs('u_sofia');
    expect(() => store.setRole('u_sofia', 'athlete')).toThrow(/administrador/);
    store.setRole('u_marta', 'admin');
    store.setRole('u_sofia', 'athlete');
    expect(store.currentUser()?.role).toBe('athlete');
  });
  it('registro e inicio de sesión con contraseña', async () => {
    await store.register('Nuria', 'nuria@example.com', 'secreto-123');
    expect(store.currentUser()?.role).toBe('athlete');
    store.logout();
    await expect(store.login('nuria@example.com', 'otra')).rejects.toThrow(/contraseña/);
    await store.login('NURIA@example.com', 'secreto-123');
    expect(store.currentUser()?.name).toBe('Nuria');
    await expect(store.register('Otra', 'nuria@example.com', 'secreto-123')).rejects.toThrow(/Ya existe/);
  });
  it('una cuenta suspendida no puede entrar', async () => {
    store.loginAs('u_sofia');
    store.setStatus('u_diego', 'suspended');
    store.logout();
    await expect(store.login('diego@rutalibre.app', 'demo1234')).rejects.toThrow(/suspendida/);
  });
});
