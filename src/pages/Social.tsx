import { Plus, Trash2, Trophy, UserMinus, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Avatar, Empty, Field, Modal, ProgressBar, RolePill, Seg, useUi } from '../components/ui';
import { addDays, challengeProgress, dayKey, fmtDate, fmtNum, leaderboard, metricLabel, metricUnit, startOfMonth, startOfWeek, toUnit, fromUnit } from '../lib/metrics';
import { can, canViewActivity } from '../lib/permissions';
import { SPORTS, sportName } from '../lib/sports';
import { currentUser, deleteChallenge, saveChallenge, toggleChallenge, toggleFriend, useDB, userById } from '../lib/store';
import type { GoalMetric } from '../lib/types';
import { ActivityPost } from './Activities';

export function SocialPage() {
  const db = useDB();
  const ui = useUi();
  const me = currentUser(db)!;
  const now = useMemo(() => new Date(), [db]);
  const [scope, setScope] = useState<'friends' | 'all'>(me.role === 'guest' || !me.friends.length ? 'all' : 'friends');
  const [metric, setMetric] = useState<GoalMetric>('time');
  const [range, setRange] = useState<'week' | 'month'>('week');
  const [limit, setLimit] = useState(8);
  const interact = can(me, 'social.interact');

  const feed = useMemo(() => db.activities
    .filter((a) => a.userId !== me.id && canViewActivity(me, a, userById(a.userId, db)) && (scope === 'all' || me.friends.includes(a.userId)))
    .sort((a, b) => b.date.localeCompare(a.date)), [db, me, scope]);

  const from = range === 'week' ? startOfWeek(now) : startOfMonth(now);
  const circle = [me.id, ...me.friends].filter((id) => userById(id, db)?.role !== 'guest');
  // La clasificación solo suma lo que cada persona deja ver a quien mira
  const visible = db.activities.filter((a) => canViewActivity(me, a, userById(a.userId, db)));
  const board = leaderboard(visible, me.role === 'guest' ? db.users.filter((u) => u.role !== 'guest' && u.status === 'active').map((u) => u.id) : circle, metric, from, addDays(now, 1));
  const top = Math.max(...board.map((b) => b.value), 0.001);
  const people = db.users.filter((u) => u.id !== me.id && u.status === 'active' && u.role !== 'guest');

  return (
    <div className="page">
      <div className="page-head">
        <div><h1 className="page-title">Amigos</h1><p className="page-sub">Lo que han entrenado esta semana.</p></div>
        <Seg value={scope} onChange={setScope} options={[['friends', 'Mis amigos'], ['all', 'Todo el club']]} />
      </div>
      {!interact && <div className="notice info">Estás en modo invitado: puedes ver las sesiones públicas, pero no dar ánimos ni comentar.</div>}

      <div className="grid g-main">
        <div className="stack">
          {feed.length ? feed.slice(0, limit).map((a) => <ActivityPost key={a.id} a={a} me={me} />)
            : <div className="card glass"><Empty icon="👥" title={scope === 'friends' ? 'Tus amigos aún no han compartido nada' : 'No hay sesiones públicas'}>{scope === 'friends' && <button className="btn" onClick={() => setScope('all')}>Ver todo el club</button>}</Empty></div>}
          {feed.length > limit && <button className="btn" style={{ alignSelf: 'center' }} onClick={() => setLimit(limit + 8)}>Ver más</button>}
        </div>

        <div className="stack">
          <div className="card glass">
            <div className="card-head"><h3><Trophy style={{ width: 16, height: 16, verticalAlign: '-2px' }} /> Clasificación</h3>
              <Seg value={range} onChange={setRange} options={[['week', 'Semana'], ['month', 'Mes']]} />
            </div>
            <div style={{ marginBottom: '.8rem' }}><Seg value={metric} onChange={setMetric} options={[['time', 'Tiempo'], ['distance', 'Distancia'], ['sessions', 'Sesiones']]} /></div>
            <div className="stack" style={{ gap: '.6rem' }}>
              {board.map((b, i) => {
                const u = userById(b.userId, db);
                const v = metric === 'distance' ? toUnit(b.value, me.units) : b.value;
                return (
                  <div key={b.userId} className="row" style={{ flexWrap: 'nowrap' }}>
                    <span className="rank num">{i + 1}</span>
                    <Avatar user={u} size={2} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                        <strong style={{ fontSize: '.88rem' }}>{u?.name}{b.userId === me.id ? ' (tú)' : ''}</strong>
                        <span className="num small" style={{ fontWeight: 700 }}>{fmtNum(v, metric === 'sessions' ? 0 : 1)} {metricUnit(metric, me.units)}</span>
                      </div>
                      <ProgressBar pct={b.value / top} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card glass">
            <div className="card-head"><h3>Gente del club</h3></div>
            <div className="stack" style={{ gap: '.5rem' }}>
              {people.map((u) => {
                const friend = me.friends.includes(u.id);
                return (
                  <div key={u.id} className="row" style={{ flexWrap: 'nowrap' }}>
                    <Avatar user={u} size={2.2} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row" style={{ gap: '.4rem' }}><strong style={{ fontSize: '.9rem' }}>{u.name}</strong>{u.role !== 'athlete' && <RolePill role={u.role} />}</div>
                      <div className="muted small" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.bio}</div>
                    </div>
                    {interact && (
                      <button className={`btn btn-sm ${friend ? '' : 'btn-primary'}`} onClick={() => ui.run(() => toggleFriend(u.id), friend ? `Ya no sigues a ${u.name}` : `Ahora sois amigos, ${u.name} y tú`)}>
                        {friend ? <><UserMinus /> Quitar</> : <><UserPlus /> Añadir</>}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Retos ---------- */
export function ChallengesPage() {
  const db = useDB();
  const ui = useUi();
  const me = currentUser(db)!;
  const now = useMemo(() => new Date(), [db]);
  const [open, setOpen] = useState(false);
  const today = dayKey(now);
  const sorted = [...db.challenges].sort((a, b) => Number(a.end < today) - Number(b.end < today) || a.end.localeCompare(b.end));

  return (
    <div className="page">
      <div className="page-head">
        <div><h1 className="page-title">Retos</h1><p className="page-sub">Metas compartidas con fecha de cierre.</p></div>
        {can(me, 'challenge.manage') && <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus /> Crear reto</button>}
      </div>
      {!sorted.length && <div className="card glass"><Empty icon="🏁" title="No hay retos abiertos" /></div>}
      <div className="grid g-2">
        {sorted.map((c) => {
          const joined = c.participants.includes(me.id);
          const ended = c.end < today;
          const ranking = c.participants.map((id) => ({ id, ...challengeProgress(c, db.activities, id) })).sort((a, b) => b.value - a.value);
          const mine = ranking.find((r) => r.id === me.id);
          const unit = metricUnit(c.metric, me.units);
          const show = (v: number) => fmtNum(c.metric === 'distance' ? toUnit(v, me.units) : v, c.metric === 'sessions' ? 0 : 1);
          const daysLeft = Math.ceil((new Date(c.end + 'T23:59').getTime() - now.getTime()) / 86400000);
          return (
            <div key={c.id} className="card glass stack">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: '1.08rem', fontWeight: 800 }}>{c.name}</h3>
                  <p className="muted small">{c.desc}</p>
                </div>
                {ended ? <span className="pill">Terminado</span> : <span className="pill pill-accent">{daysLeft <= 1 ? 'Último día' : `Quedan ${daysLeft} días`}</span>}
              </div>
              <div className="row small muted">
                <span className="pill">{sportName(c.sport)}</span>
                <span className="pill">{metricLabel[c.metric]}: {show(c.target)} {unit}</span>
                <span>{fmtDate(c.start + 'T12:00')} – {fmtDate(c.end + 'T12:00')}</span>
              </div>
              {mine && (
                <div>
                  <div className="row" style={{ justifyContent: 'space-between' }}><strong className="small">Tu progreso</strong><span className="num small">{show(mine.value)} / {show(c.target)} {unit}</span></div>
                  <ProgressBar pct={mine.pct} />
                </div>
              )}
              <div className="stack" style={{ gap: '.4rem' }}>
                {ranking.slice(0, 5).map((r, i) => (
                  <div key={r.id} className="row" style={{ flexWrap: 'nowrap' }}>
                    <span className="rank num">{i + 1}</span>
                    <Avatar user={userById(r.id, db)} size={1.7} />
                    <span style={{ flex: 1, fontWeight: 600, fontSize: '.86rem' }}>{userById(r.id, db)?.name}{r.pct >= 1 ? ' 🏅' : ''}</span>
                    <span className="num small">{show(r.value)} {unit}</span>
                  </div>
                ))}
                {!ranking.length && <p className="muted small">Nadie se ha apuntado todavía.</p>}
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted small">Creado por {userById(c.createdBy, db)?.name}</span>
                <div className="row">
                  {can(me, 'challenge.manage') && (c.createdBy === me.id || can(me, 'user.manage')) && (
                    <button className="icon-btn" aria-label="Borrar reto" onClick={async () => {
                      if (await ui.confirm({ title: `¿Borrar «${c.name}»?`, body: 'Desaparecerá para todos los participantes.', action: 'Borrar reto', danger: true })) ui.run(() => deleteChallenge(c.id), 'Reto borrado');
                    }}><Trash2 /></button>
                  )}
                  {can(me, 'challenge.join') && !ended && (
                    <button className={`btn btn-sm ${joined ? '' : 'btn-primary'}`} onClick={() => ui.run(() => toggleChallenge(c.id), joined ? 'Has salido del reto' : '¡Dentro! A por ello')}>{joined ? 'Salir' : 'Unirme'}</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {open && <ChallengeForm onClose={() => setOpen(false)} />}
    </div>
  );
}

function ChallengeForm({ onClose }: { onClose: () => void }) {
  const ui = useUi();
  const me = currentUser()!;
  const now = new Date();
  const [c, setC] = useState({ name: '', desc: '', sport: 'all', metric: 'distance' as GoalMetric, target: 50, start: dayKey(now), end: dayKey(addDays(now, 30)) });
  return (
    <Modal title="Nuevo reto" onClose={onClose}>
      <form className="stack" onSubmit={(e) => {
        e.preventDefault();
        if (ui.run(() => saveChallenge({ ...c, target: c.metric === 'distance' ? fromUnit(c.target, me.units) : c.target }), 'Reto publicado')) onClose();
      }}>
        <Field label="Nombre"><input id="c-name" className="input" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} placeholder="100 km en noviembre" required /></Field>
        <Field label="Descripción"><input id="c-desc" className="input" value={c.desc} onChange={(e) => setC({ ...c, desc: e.target.value })} /></Field>
        <div className="form-grid">
          <Field label="Deporte">
            <select id="c-sport" className="input" value={c.sport} onChange={(e) => setC({ ...c, sport: e.target.value })}>
              <option value="all">Todos</option>{SPORTS.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
            </select>
          </Field>
          <Field label="Se mide en">
            <select id="c-metric" className="input" value={c.metric} onChange={(e) => setC({ ...c, metric: e.target.value as GoalMetric })}>
              <option value="distance">Distancia</option><option value="time">Horas</option><option value="sessions">Sesiones</option>
            </select>
          </Field>
          <Field label={`Meta (${metricUnit(c.metric, me.units)})`}><input id="c-target" className="input" type="number" min="1" step="any" value={c.target} onChange={(e) => setC({ ...c, target: Number(e.target.value) })} required /></Field>
          <span />
          <Field label="Empieza"><input id="c-start" className="input" type="date" value={c.start} onChange={(e) => setC({ ...c, start: e.target.value })} required /></Field>
          <Field label="Termina"><input id="c-end" className="input" type="date" value={c.end} onChange={(e) => setC({ ...c, end: e.target.value })} required /></Field>
        </div>
        <div className="modal-foot"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" className="btn btn-primary">Publicar reto</button></div>
      </form>
    </Modal>
  );
}
