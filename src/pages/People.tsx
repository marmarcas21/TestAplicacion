import { Check, ChevronLeft, Minus, ShieldCheck, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { LineChart } from '../components/charts';
import { Avatar, Empty, Field, RolePill, Seg, Stat, useUi } from '../components/ui';
import { addDays, dayKey, fmtAgo, fmtDate, fmtDateTime, fmtNum, formStatus, inRange, startOfWeek, totals, toUnit, trainingLoad } from '../lib/metrics';
import { can, PERMISSION_LABEL, ROLE_DESC, ROLE_LABEL, ROLE_PERMS, type Permission } from '../lib/permissions';
import { assignCoach, currentUser, deleteBody, saveBody, setRole, setStatus, useDB, userById } from '../lib/store';
import type { Role } from '../lib/types';
import { ActivityRow } from './Activities';
import { StatsView } from './Stats';

/* ---------- Cuerpo ---------- */
export function BodyPage() {
  const db = useDB();
  const ui = useUi();
  const me = currentUser(db)!;
  const entries = useMemo(() => db.body.filter((b) => b.userId === me.id).sort((a, b) => a.date.localeCompare(b.date)), [db.body, me.id]);
  const [metric, setMetric] = useState<'weightKg' | 'fatPct' | 'restHr' | 'sleepH'>('weightKg');
  const [f, setF] = useState({ date: dayKey(new Date()), weightKg: '', fatPct: '', restHr: '', sleepH: '' });
  const META = { weightKg: ['Peso', 'kg', 1], fatPct: ['Grasa corporal', '%', 1], restHr: ['FC en reposo', 'ppm', 0], sleepH: ['Sueño', 'h', 1] } as const;
  const last = entries[entries.length - 1];
  const first = entries[0];
  const month = entries.filter((e) => e.date >= dayKey(addDays(new Date(), -30)));
  const delta = (k: 'weightKg' | 'fatPct' | 'restHr') => (last && month[0] && last[k] != null && month[0][k] != null ? (last[k] as number) - (month[0][k] as number) : null);
  const sign = (v: number | null, unit: string) => (v == null ? 'sin datos del mes' : `${v > 0 ? '+' : ''}${fmtNum(v)} ${unit} en 30 días`);
  const n = (v: string) => (v.trim() ? Number(v.replace(',', '.')) : undefined);
  const bmiHint = last ? `Has registrado ${entries.length} mediciones desde el ${fmtDate(first.date + 'T12:00')}.` : '';

  return (
    <div className="page">
      <div className="page-head"><div><h1 className="page-title">Cuerpo</h1><p className="page-sub">Peso, composición, pulso en reposo y sueño. Estas mediciones solo las ves tú.</p></div></div>
      {last ? (
        <div className="card glass">
          <div className="grid g-4">
            <div><Stat label="Peso" value={fmtNum(last.weightKg)} unit="kg" /><span className="muted small">{sign(delta('weightKg'), 'kg')}</span></div>
            <div><Stat label="Grasa corporal" value={last.fatPct != null ? fmtNum(last.fatPct) : '–'} unit="%" /><span className="muted small">{sign(delta('fatPct'), 'pt')}</span></div>
            <div><Stat label="FC en reposo" value={last.restHr != null ? String(last.restHr) : '–'} unit="ppm" /><span className="muted small">{sign(delta('restHr'), 'ppm')}</span></div>
            <div><Stat label="Sueño" value={last.sleepH != null ? fmtNum(last.sleepH) : '–'} unit="h" /><span className="muted small">última medición</span></div>
          </div>
        </div>
      ) : null}

      <div className="grid g-main">
        <div className="card glass">
          <div className="card-head"><h3>Evolución</h3>
            <Seg value={metric} onChange={setMetric} options={[['weightKg', 'Peso'], ['fatPct', 'Grasa'], ['restHr', 'Pulso'], ['sleepH', 'Sueño']]} />
          </div>
          {entries.length > 1 ? (
            <LineChart height={240} unit={META[metric][1]} dec={META[metric][2]} labels={entries.map((e) => fmtDate(e.date + 'T12:00'))}
              series={[{ name: META[metric][0], color: 'var(--s2)', values: entries.map((e) => e[metric] ?? null), area: false }]} />
          ) : <Empty icon="⚖️" title="Añade dos mediciones para ver la evolución" />}
          <p className="muted small" style={{ marginTop: '.5rem' }}>{bmiHint}</p>
        </div>

        <form className="card glass stack" onSubmit={(e) => {
          e.preventDefault();
          if (ui.run(() => saveBody({ date: f.date, weightKg: n(f.weightKg) ?? 0, fatPct: n(f.fatPct), restHr: n(f.restHr), sleepH: n(f.sleepH) }), 'Medición guardada')) setF({ ...f, weightKg: '', fatPct: '', restHr: '', sleepH: '' });
        }}>
          <h3 style={{ fontSize: '1.02rem', fontWeight: 800 }}>Nueva medición</h3>
          <Field label="Fecha"><input id="b-date" className="input" type="date" value={f.date} max={dayKey(new Date())} onChange={(e) => setF({ ...f, date: e.target.value })} required /></Field>
          <div className="form-grid">
            <Field label="Peso (kg)"><input id="b-w" className="input" inputMode="decimal" value={f.weightKg} onChange={(e) => setF({ ...f, weightKg: e.target.value })} placeholder={last ? fmtNum(last.weightKg) : '70'} required /></Field>
            <Field label="Grasa (%)"><input id="b-f" className="input" inputMode="decimal" value={f.fatPct} onChange={(e) => setF({ ...f, fatPct: e.target.value })} /></Field>
            <Field label="FC reposo (ppm)"><input id="b-hr" className="input" inputMode="numeric" value={f.restHr} onChange={(e) => setF({ ...f, restHr: e.target.value })} /></Field>
            <Field label="Sueño (h)"><input id="b-s" className="input" inputMode="decimal" value={f.sleepH} onChange={(e) => setF({ ...f, sleepH: e.target.value })} /></Field>
          </div>
          <button className="btn btn-primary" type="submit">Guardar medición</button>
          <p className="muted small">El peso también ajusta tu estimación de calorías.</p>
        </form>
      </div>

      {entries.length > 0 && (
        <div className="card glass">
          <div className="card-head"><h3>Historial</h3></div>
          <div className="table-wrap"><table>
            <thead><tr><th>Fecha</th><th className="r">Peso</th><th className="r">Grasa</th><th className="r">FC reposo</th><th className="r">Sueño</th><th /></tr></thead>
            <tbody>
              {[...entries].reverse().slice(0, 12).map((e) => (
                <tr key={e.id}><td>{fmtDate(e.date + 'T12:00')}</td><td className="r">{fmtNum(e.weightKg)} kg</td><td className="r">{e.fatPct != null ? `${fmtNum(e.fatPct)} %` : '–'}</td><td className="r">{e.restHr ?? '–'}</td><td className="r">{e.sleepH != null ? `${fmtNum(e.sleepH)} h` : '–'}</td>
                  <td className="r"><button className="icon-btn" aria-label="Borrar medición" onClick={() => ui.run(() => deleteBody(e.id), 'Medición borrada')}><Trash2 /></button></td></tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}

/* ---------- Equipo (entrenador) ---------- */
export function TeamPage() {
  const db = useDB();
  const me = currentUser(db)!;
  const now = useMemo(() => new Date(), [db]);
  const [selected, setSelected] = useState<string | null>(null);
  const athletes = db.users.filter((u) => u.status === 'active' && u.id !== me.id && (can(me, 'user.manage') ? u.role === 'athlete' || u.role === 'coach' : u.coachId === me.id));
  const subject = selected ? userById(selected, db) : null;
  const ws = startOfWeek(now);

  if (subject) {
    const acts = db.activities.filter((a) => a.userId === subject.id).sort((a, b) => b.date.localeCompare(a.date));
    return (
      <div className="page">
        <div className="page-head">
          <div className="row">
            <button className="icon-btn" onClick={() => setSelected(null)} aria-label="Volver al equipo"><ChevronLeft /></button>
            <Avatar user={subject} size={2.8} />
            <div><h1 className="page-title">{subject.name}</h1><p className="page-sub">{subject.bio || 'Sin biografía'}</p></div>
          </div>
        </div>
        <StatsView subject={subject} viewer={me} />
        <div className="card glass">
          <div className="card-head"><h3>Sesiones recientes</h3></div>
          <div className="stack" style={{ gap: '.15rem' }}>{acts.slice(0, 8).map((a) => <ActivityRow key={a.id} a={a} me={me} />)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head"><div><h1 className="page-title">Mi equipo</h1><p className="page-sub">{can(me, 'user.manage') ? 'Todos los deportistas del club.' : 'Los atletas que tienes a tu cargo.'}</p></div></div>
      {!athletes.length && <div className="card glass"><Empty icon="🧢" title="Todavía no tienes atletas asignados">Un administrador puede asignártelos desde Administración.</Empty></div>}
      <div className="grid g-auto">
        {athletes.map((u) => {
          const acts = db.activities.filter((a) => a.userId === u.id);
          const wk = totals(inRange(acts, ws, addDays(ws, 7)));
          const load = trainingLoad(acts, 1, now)[0];
          const form = formStatus(load.form, load.fitness);
          const last = acts.reduce<string | null>((m, a) => (!m || a.date > m ? a.date : m), null);
          const plans = db.plans.filter((p) => p.athleteIds.includes(u.id));
          const planned = plans.flatMap((p) => p.sessions);
          const done = planned.filter((s) => db.planDone[`${u.id}|${s.id}|${dayKey(addDays(ws, s.day))}`]).length;
          const idle = !last || now.getTime() - new Date(last).getTime() > 5 * 86400000;
          return (
            <button key={u.id} className="card glass stack" style={{ textAlign: 'left', gap: '.7rem' }} onClick={() => setSelected(u.id)}>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <Avatar user={u} size={2.6} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong>{u.name}</strong>
                  <div className="muted small">{last ? `Última sesión ${fmtAgo(last, now)}` : 'Sin sesiones'}</div>
                </div>
                <span className={`pill pill-${idle ? 'warn' : form.tone === 'neutral' ? 'accent' : form.tone}`}>{idle ? 'Inactivo' : form.label}</span>
              </div>
              <div className="grid g-3 num" style={{ gap: '.4rem' }}>
                <Stat label="Sesiones" value={String(wk.sessions)} />
                <Stat label="Horas" value={fmtNum(wk.timeSec / 3600)} />
                <Stat label={me.units} value={fmtNum(toUnit(wk.distanceKm, me.units), 0)} />
              </div>
              <span className="muted small">{plans.length ? `${plans[0].name}: ${done}/${planned.length} sesiones esta semana` : 'Sin plan asignado'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Administración ---------- */
const ROLES: Role[] = ['admin', 'coach', 'athlete', 'guest'];

export function AdminPage() {
  const db = useDB();
  const ui = useUi();
  const me = currentUser(db)!;
  const [tab, setTab] = useState<'users' | 'roles' | 'audit'>('users');
  const coaches = db.users.filter((u) => (u.role === 'coach' || u.role === 'admin') && u.status === 'active');
  const count = (r: Role) => db.users.filter((u) => u.role === r).length;

  return (
    <div className="page">
      <div className="page-head">
        <div><h1 className="page-title">Administración</h1><p className="page-sub">{db.users.length} cuentas · {db.activities.length} sesiones · {db.plans.length} planes · {db.challenges.length} retos</p></div>
        <Seg value={tab} onChange={setTab} options={[['users', 'Usuarios'], ['roles', 'Roles y permisos'], ['audit', 'Auditoría']]} />
      </div>

      {tab === 'users' && (
        <div className="card glass">
          <div className="grid g-4" style={{ marginBottom: '1rem' }}>{ROLES.map((r) => <Stat key={r} label={ROLE_LABEL[r]} value={String(count(r))} />)}</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Usuario</th><th>Rol</th><th>Entrenador</th><th>Alta</th><th>Estado</th><th /></tr></thead>
              <tbody>
                {db.users.map((u) => (
                  <tr key={u.id}>
                    <td><div className="row" style={{ flexWrap: 'nowrap' }}><Avatar user={u} size={2} /><div><strong>{u.name}{u.id === me.id ? ' (tú)' : ''}</strong><div className="muted small">{u.email}</div></div></div></td>
                    <td>
                      <select className="input" style={{ width: 'auto', padding: '.35rem .5rem', fontSize: '.84rem' }} value={u.role} aria-label={`Rol de ${u.name}`}
                        onChange={(e) => ui.run(() => setRole(u.id, e.target.value as Role), `${u.name} ahora es ${ROLE_LABEL[e.target.value as Role]}`)}>
                        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select>
                    </td>
                    <td>
                      {u.role === 'athlete' ? (
                        <select className="input" style={{ width: 'auto', padding: '.35rem .5rem', fontSize: '.84rem' }} value={u.coachId ?? ''} aria-label={`Entrenador de ${u.name}`}
                          onChange={(e) => ui.run(() => assignCoach(u.id, e.target.value || undefined), 'Entrenador actualizado')}>
                          <option value="">Sin entrenador</option>
                          {coaches.filter((c) => c.id !== u.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      ) : <span className="muted">–</span>}
                    </td>
                    <td className="muted small">{fmtDate(u.createdAt)}</td>
                    <td><span className={`pill ${u.status === 'active' ? 'pill-good' : 'pill-bad'}`}>{u.status === 'active' ? 'Activa' : 'Suspendida'}</span></td>
                    <td className="r">
                      {u.id !== me.id && (
                        <button className={`btn btn-sm ${u.status === 'active' ? 'btn-danger' : ''}`} onClick={async () => {
                          if (u.status === 'active' && !(await ui.confirm({ title: `¿Suspender a ${u.name}?`, body: 'No podrá iniciar sesión hasta que reactives su cuenta. Sus datos se conservan.', action: 'Suspender', danger: true }))) return;
                          ui.run(() => setStatus(u.id, u.status === 'active' ? 'suspended' : 'active'), u.status === 'active' ? 'Cuenta suspendida' : 'Cuenta reactivada');
                        }}>{u.status === 'active' ? 'Suspender' : 'Reactivar'}</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'roles' && (
        <div className="card glass">
          <div className="grid g-4" style={{ marginBottom: '1rem' }}>
            {ROLES.map((r) => <div key={r}><RolePill role={r} /><p className="muted small" style={{ marginTop: '.3rem' }}>{ROLE_DESC[r]}</p></div>)}
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Permiso</th>{ROLES.map((r) => <th key={r} style={{ textAlign: 'center' }}>{ROLE_LABEL[r]}</th>)}</tr></thead>
              <tbody>
                <tr><td>Ver sesiones públicas, retos y clasificación</td>{ROLES.map((r) => <td key={r} style={{ textAlign: 'center' }}><Check className="check" size={17} aria-label="Sí" /></td>)}</tr>
                {(Object.keys(PERMISSION_LABEL) as Permission[]).map((p) => (
                  <tr key={p}><td>{PERMISSION_LABEL[p]}</td>
                    {ROLES.map((r) => <td key={r} style={{ textAlign: 'center' }}>{ROLE_PERMS[r].includes(p) ? <Check className="check" size={17} aria-label="Sí" /> : <Minus className="cross" size={17} aria-label="No" />}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small" style={{ marginTop: '.8rem' }}><ShieldCheck size={14} style={{ verticalAlign: '-2px' }} /> Cada acción comprueba el rol en la capa de datos, no solo en los botones. Siempre queda al menos un administrador activo.</p>
        </div>
      )}

      {tab === 'audit' && (
        <div className="card glass">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Cuándo</th><th>Quién</th><th>Acción</th><th>Detalle</th></tr></thead>
              <tbody>
                {db.audit.slice(0, 80).map((a) => (
                  <tr key={a.id}><td className="muted small" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(a.at)}</td><td>{userById(a.userId, db)?.name ?? '–'}</td><td><span className="pill">{a.action}</span></td><td>{a.detail}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
