import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Avatar, Empty, Field, Modal, useUi } from '../components/ui';
import { addDays, dayKey, DAYS_LONG, DAYS_SHORT, fmtNum, MONTHS_LONG, startOfWeek, toUnit, weekdayIdx } from '../lib/metrics';
import { can } from '../lib/permissions';
import { SPORTS, sportOf } from '../lib/sports';
import { currentUser, deletePlan, savePlan, togglePlanDone, uid, useDB, userById } from '../lib/store';
import type { Plan, PlanSession } from '../lib/types';

export function PlanPage() {
  const db = useDB();
  const ui = useUi();
  const me = currentUser(db)!;
  const now = useMemo(() => new Date(), [db]);
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [editing, setEditing] = useState<Plan | 'new' | null>(null);
  const manage = can(me, 'plan.manage');
  const myPlans = db.plans.filter((p) => p.athleteIds.includes(me.id));
  const authored = manage ? db.plans.filter((p) => p.coachId === me.id || can(me, 'user.manage')) : [];
  const mine = db.activities.filter((a) => a.userId === me.id);
  const byDay = useMemo(() => {
    const m = new Map<string, typeof mine>();
    for (const a of mine) m.set(dayKey(a.date), [...(m.get(dayKey(a.date)) ?? []), a]);
    return m;
  }, [db.activities, me.id]);

  const gridStart = startOfWeek(cursor);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  // La sexta fila solo se pinta si aún pertenece al mes
  const rows = cells.slice(0, cells[35].getMonth() === cursor.getMonth() ? 42 : 35);
  const today = dayKey(now);
  const weekStart = startOfWeek(now);
  const weekPlanned = myPlans.flatMap((p) => p.sessions.map((s) => ({ s, p })));
  const weekDone = weekPlanned.filter(({ s }) => db.planDone[`${me.id}|${s.id}|${dayKey(addDays(weekStart, s.day))}`]).length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Plan y calendario</h1>
          <p className="page-sub">{myPlans.length ? `Esta semana: ${weekDone} de ${weekPlanned.length} sesiones del plan hechas.` : 'Tu historial día a día. Un entrenador puede asignarte un plan.'}</p>
        </div>
        {manage && <button className="btn btn-primary" onClick={() => setEditing('new')}><Plus /> Crear plan</button>}
      </div>

      <div className="card glass">
        <div className="card-head">
          <h3>{MONTHS_LONG[cursor.getMonth()]} {cursor.getFullYear()}</h3>
          <div className="row">
            <button className="icon-btn" aria-label="Mes anterior" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft /></button>
            <button className="btn btn-sm" onClick={() => setCursor(new Date(now.getFullYear(), now.getMonth(), 1))}>Hoy</button>
            <button className="icon-btn" aria-label="Mes siguiente" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight /></button>
          </div>
        </div>
        <div className="cal">
          {DAYS_SHORT.map((d) => <div key={d} className="cal-head">{d}</div>)}
          {rows.map((d) => {
            const key = dayKey(d);
            const acts = byDay.get(key) ?? [];
            const future = key >= today;
            const planned = myPlans.flatMap((p) => p.sessions.filter((s) => s.day === weekdayIdx(d) && key >= dayKey(p.createdAt)));
            return (
              <div key={key} className={`cal-day ${d.getMonth() !== cursor.getMonth() ? 'out' : ''} ${key === today ? 'today' : ''}`}>
                <span className="cal-day__n num">{d.getDate()}</span>
                {acts.slice(0, 3).map((a) => (
                  <button key={a.id} className="cal-chip" onClick={() => ui.openActivity(a.id)} title={a.title}><span>{sportOf(a.sport).emoji}</span><span>{a.title}</span></button>
                ))}
                {planned.map((s) => {
                  const k = `${me.id}|${s.id}|${key}`;
                  const done = !!db.planDone[k];
                  if (!future && !done) return null; // lo pasado sin hacer no se arrastra
                  if (done && acts.length) return null;
                  return (
                    <button key={s.id} className={`cal-chip planned ${done ? 'done' : ''}`} title={`${s.title} · ${s.desc}`}
                      onClick={() => (key === today ? ui.editActivity(undefined, { sport: s.sport, title: s.title, durationSec: s.durationMin * 60, distanceKm: s.distanceKm, planSessionKey: k }) : ui.toast(`${DAYS_LONG[s.day]}: ${s.title} · ${s.durationMin} min`))}>
                      <span>{sportOf(s.sport).emoji}</span><span>{s.title}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="legend" style={{ marginTop: '.7rem' }}>
          <span><i className="dot" style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)' }} />Sesión hecha</span>
          <span><i className="dot" style={{ border: '1.5px dashed var(--text-muted)' }} />Planificada</span>
        </div>
      </div>

      {myPlans.map((p) => (
        <div className="card glass" key={p.id}>
          <div className="card-head">
            <div><h3>{p.name}</h3><span className="card-sub">Asignado por {userById(p.coachId, db)?.name ?? 'tu entrenador'} · {p.description}</span></div>
          </div>
          <WeekTable plan={p} units={me.units} doneKey={(s) => `${me.id}|${s.id}|${dayKey(addDays(weekStart, s.day))}`} done={db.planDone}
            onToggle={can(me, 'activity.write') ? (k) => ui.run(() => togglePlanDone(k)) : undefined} />
        </div>
      ))}

      {manage && (
        <div className="card glass">
          <div className="card-head"><h3>Planes que diriges</h3></div>
          {authored.length ? (
            <div className="stack">
              {authored.map((p) => (
                <div key={p.id} className="badge" style={{ alignItems: 'flex-start' }}>
                  <div className="badge__body">
                    <strong>{p.name}</strong>
                    <span className="muted small">{p.sessions.length} sesiones por semana · {p.description}</span>
                    <div className="row" style={{ gap: '.3rem' }}>
                      {p.athleteIds.map((id) => <span key={id} className="pill"><Avatar user={userById(id, db)} size={1.1} /> {userById(id, db)?.name}</span>)}
                      {!p.athleteIds.length && <span className="pill pill-warn">Sin atletas asignados</span>}
                    </div>
                  </div>
                  <button className="icon-btn" aria-label="Editar plan" onClick={() => setEditing(p)}><Pencil /></button>
                  <button className="icon-btn" aria-label="Borrar plan" onClick={async () => {
                    if (await ui.confirm({ title: `¿Borrar «${p.name}»?`, body: 'Sus atletas dejarán de verlo en el calendario.', action: 'Borrar plan', danger: true })) ui.run(() => deletePlan(p.id), 'Plan borrado');
                  }}><Trash2 /></button>
                </div>
              ))}
            </div>
          ) : <Empty icon="🗓️" title="Aún no has creado ningún plan" />}
        </div>
      )}
      {editing && <PlanForm plan={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function WeekTable({ plan, units, doneKey, done, onToggle }: { plan: Plan; units: 'km' | 'mi'; doneKey: (s: PlanSession) => string; done: Record<string, boolean>; onToggle?: (k: string) => void }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Día</th><th>Sesión</th><th className="r">Duración</th><th className="r hide-xs">Distancia</th><th className="r">Esta semana</th></tr></thead>
        <tbody>
          {[...plan.sessions].sort((a, b) => a.day - b.day).map((s) => {
            const k = doneKey(s);
            return (
              <tr key={s.id}>
                <td>{DAYS_LONG[s.day]}</td>
                <td><strong>{sportOf(s.sport).emoji} {s.title}</strong><div className="muted small">{s.desc}</div></td>
                <td className="r">{s.durationMin} min</td>
                <td className="r hide-xs">{s.distanceKm ? `${fmtNum(toUnit(s.distanceKm, units))} ${units}` : '–'}</td>
                <td className="r">
                  <button className={`pill ${done[k] ? 'pill-good' : ''}`} style={{ border: 'none' }} disabled={!onToggle} onClick={() => onToggle?.(k)}>{done[k] ? 'Hecha ✓' : 'Pendiente'}</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PlanForm({ plan, onClose }: { plan?: Plan; onClose: () => void }) {
  const db = useDB();
  const ui = useUi();
  const me = currentUser(db)!;
  const [name, setName] = useState(plan?.name ?? '');
  const [description, setDescription] = useState(plan?.description ?? '');
  const [athleteIds, setAthleteIds] = useState<string[]>(plan?.athleteIds ?? []);
  const [sessions, setSessions] = useState<PlanSession[]>(plan?.sessions ?? [{ id: uid(), day: 0, sport: 'run', title: 'Rodaje suave', desc: '', durationMin: 45 }]);
  // Un entrenador asigna a sus atletas; un administrador, a cualquiera
  const candidates = db.users.filter((u) => u.status === 'active' && u.role !== 'guest' && u.id !== me.id && (can(me, 'user.manage') || u.coachId === me.id));
  const patch = (i: number, p: Partial<PlanSession>) => setSessions(sessions.map((s, k) => (k === i ? { ...s, ...p } : s)));
  return (
    <Modal title={plan ? 'Editar plan' : 'Nuevo plan'} size="wide" onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); if (ui.run(() => savePlan({ id: plan?.id, name, description, athleteIds, sessions }), 'Plan guardado')) onClose(); }}>
        <div className="form-grid">
          <Field label="Nombre"><input id="p-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="10K en 8 semanas" required /></Field>
          <Field label="Descripción"><input id="p-desc" className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Objetivo y enfoque" /></Field>
        </div>
        <div>
          <h4 style={{ marginBottom: '.4rem' }}>Atletas</h4>
          {candidates.length ? (
            <div className="row">
              {candidates.map((u) => {
                const on = athleteIds.includes(u.id);
                return <button type="button" key={u.id} className={`pill ${on ? 'pill-accent' : ''}`} style={{ border: 'none', padding: '.35rem .7rem' }} aria-pressed={on}
                  onClick={() => setAthleteIds(on ? athleteIds.filter((x) => x !== u.id) : [...athleteIds, u.id])}><Avatar user={u} size={1.2} /> {u.name}</button>;
              })}
            </div>
          ) : <p className="muted small">Todavía no tienes atletas a tu cargo. Un administrador los asigna desde Administración.</p>}
        </div>
        <h4>Semana tipo</h4>
        {sessions.map((s, i) => (
          <div key={s.id} className="form-grid" style={{ padding: '.7rem', borderRadius: 'var(--radius-md)', background: 'var(--surface-tint)' }}>
            <Field label="Día"><select className="input" value={s.day} onChange={(e) => patch(i, { day: Number(e.target.value) })}>{DAYS_LONG.map((d, k) => <option key={d} value={k}>{d}</option>)}</select></Field>
            <Field label="Deporte"><select className="input" value={s.sport} onChange={(e) => patch(i, { sport: e.target.value })}>{SPORTS.map((x) => <option key={x.id} value={x.id}>{x.emoji} {x.name}</option>)}</select></Field>
            <Field label="Título"><input className="input" value={s.title} onChange={(e) => patch(i, { title: e.target.value })} required /></Field>
            <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-end' }}>
              <Field label="Minutos"><input className="input" type="number" min="5" value={s.durationMin} onChange={(e) => patch(i, { durationMin: Number(e.target.value) })} /></Field>
              <Field label="Km"><input className="input" type="number" min="0" step="any" value={s.distanceKm ?? ''} onChange={(e) => patch(i, { distanceKm: e.target.value ? Number(e.target.value) : undefined })} /></Field>
              <button type="button" className="icon-btn" aria-label="Quitar sesión" onClick={() => setSessions(sessions.filter((_, k) => k !== i))}><Trash2 /></button>
            </div>
            <Field label="Indicaciones" full><input className="input" value={s.desc} onChange={(e) => patch(i, { desc: e.target.value })} placeholder="Ritmo, zonas, descansos…" /></Field>
          </div>
        ))}
        <button type="button" className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setSessions([...sessions, { id: uid(), day: Math.min(6, (sessions[sessions.length - 1]?.day ?? -1) + 1), sport: 'run', title: '', desc: '', durationMin: 45 }])}><Plus /> Añadir sesión</button>
        <div className="modal-foot"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" className="btn btn-primary">Guardar plan</button></div>
      </form>
    </Modal>
  );
}
