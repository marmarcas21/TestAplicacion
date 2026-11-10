import { Download, Globe, Heart, Lock, MessageCircle, Pencil, Plus, Search, Send, Trash2, Upload, Users } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { LineChart } from '../components/charts';
import { Avatar, Empty, Field, Modal, RouteThumb, Seg, StarInput, Stars, saveFile, useUi } from '../components/ui';
import { parseGpx } from '../lib/gpx';
import { epley1RM, estimateCalories, fmtAgo, fmtDateTime, fmtDist, fmtDur, fmtEffort, fmtNum, fromUnit, toLocalInput, toUnit, totals } from '../lib/metrics';
import { can, canEditActivity, canViewActivity } from '../lib/permissions';
import { EXERCISES, GROUPS, groupOf, SPORTS, sportOf } from '../lib/sports';
import { addComment, deleteActivity, deleteComment, exportCsv, rateActivity, saveActivity, toggleKudos, useDB, userById, currentUser } from '../lib/store';
import type { Activity, GymSet, User, Visibility } from '../lib/types';

export const VIS: Record<Visibility, { label: string; icon: typeof Globe }> = {
  public: { label: 'Pública', icon: Globe },
  friends: { label: 'Amigos', icon: Users },
  private: { label: 'Solo yo', icon: Lock },
};

export function ActivityRow({ a, me, showUser }: { a: Activity; me: User; showUser?: boolean }) {
  const ui = useUi();
  const owner = userById(a.userId);
  return (
    <button className="act-row" onClick={() => ui.openActivity(a.id)}>
      <RouteThumb route={a.route} sport={a.sport} color={groupOf(a.sport).color} size={52} />
      <div className="act-row__body">
        <div className="act-row__title">{a.title || sportOf(a.sport).name}</div>
        <div className="act-row__meta">{showUser && owner ? `${owner.name} · ` : ''}{sportOf(a.sport).name} · {fmtAgo(a.date)}</div>
      </div>
      <div className="act-row__nums num">
        {a.distanceKm ? <div><strong>{fmtNum(toUnit(a.distanceKm, me.units))}</strong><span>{me.units}</span></div> : null}
        <div><strong>{fmtDur(a.durationSec).replace(' min', '′').replace(' h ', ':')}</strong><span>tiempo</span></div>
        {a.distanceKm ? <div className="hide-sm"><strong>{fmtEffort(a, me.units).split(' ')[0]}</strong><span>{fmtEffort(a, me.units).split(' ')[1]}</span></div> : null}
      </div>
    </button>
  );
}

export function KudosButton({ a, me }: { a: Activity; me: User }) {
  const ui = useUi();
  const [pop, setPop] = useState(false);
  const liked = a.kudos.includes(me.id);
  const allowed = can(me, 'social.interact');
  return (
    <button className={`like-btn ${liked ? 'liked' : ''} ${pop ? 'pop' : ''}`} disabled={!allowed} title={allowed ? 'Dar ánimos' : 'Los invitados no pueden dar ánimos'}
      onClick={() => { if (ui.run(() => toggleKudos(a.id))) { setPop(true); setTimeout(() => setPop(false), 260); } }}>
      <Heart /> {a.kudos.length}
    </button>
  );
}

/** Tarjeta social: la misma pieza del feed de RutaLibre Amigos, ahora multideporte */
export function ActivityPost({ a, me }: { a: Activity; me: User }) {
  const ui = useUi();
  const owner = userById(a.userId);
  return (
    <article className="post glass">
      <div className="post__head">
        <Avatar user={owner} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="post__name">{owner?.name ?? 'Usuario'}</div>
          <div className="post__meta">{sportOf(a.sport).emoji} {a.title || sportOf(a.sport).name} · {fmtAgo(a.date)}</div>
        </div>
        {a.rating > 0 && <Stars value={a.rating} />}
      </div>
      <button className="post__main" onClick={() => ui.openActivity(a.id)} aria-label="Ver la sesión">
        <RouteThumb route={a.route} sport={a.sport} color={owner?.color} size={84} />
        <div className="post__stats num">
          {a.distanceKm ? <div><strong>{fmtDist(a.distanceKm, me.units)}</strong><span>distancia</span></div> : null}
          <div><strong>{fmtDur(a.durationSec)}</strong><span>tiempo</span></div>
          {a.distanceKm ? <div><strong>{fmtEffort(a, me.units)}</strong><span>ritmo</span></div> : null}
          {a.sets?.length ? <div><strong>{a.sets.length}</strong><span>series</span></div> : null}
        </div>
      </button>
      {a.notes && <p className="post__comment">{a.notes}</p>}
      <div className="row">
        <KudosButton a={a} me={me} />
        <button className="like-btn" onClick={() => ui.openActivity(a.id)}><MessageCircle /> {a.comments.length}</button>
      </div>
    </article>
  );
}

/* ---------- Listado ---------- */
export function ActivitiesPage() {
  const db = useDB();
  const ui = useUi();
  const me = currentUser(db)!;
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all');
  const [sort, setSort] = useState<'date' | 'distance' | 'time'>('date');
  const mine = useMemo(() => db.activities.filter((a) => a.userId === me.id), [db.activities, me.id]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return mine
      .filter((a) => (group === 'all' || groupOf(a.sport).id === group) && (!needle || `${a.title} ${a.notes} ${sportOf(a.sport).name}`.toLowerCase().includes(needle)))
      .sort((a, b) => sort === 'date' ? b.date.localeCompare(a.date) : sort === 'distance' ? (b.distanceKm ?? 0) - (a.distanceKm ?? 0) : b.durationSec - a.durationSec);
  }, [mine, q, group, sort]);
  const [limit, setLimit] = useState(30);
  const t = totals(list);
  const usedGroups = GROUPS.filter((g) => mine.some((a) => groupOf(a.sport).id === g.id));
  const doExport = async () => {
    try {
      const res = await saveFile('rutalibre-sesiones.csv', exportCsv(), 'text/csv');
      ui.toast(res === 'copied' ? 'CSV exportado y copiado al portapapeles' : 'CSV exportado');
    } catch (e) {
      ui.toast((e as Error).message, 'error');
    }
  };
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Mis sesiones</h1>
          <p className="page-sub">{t.sessions} sesiones · {fmtDur(t.timeSec)} · {fmtDist(t.distanceKm, me.units, 0)}</p>
        </div>
        <div className="row">
          <button className="btn" onClick={doExport}><Download /> CSV</button>
          <button className="btn btn-primary" onClick={() => ui.editActivity()}><Plus /> Añadir sesión</button>
        </div>
      </div>
      <div className="card glass">
        <div className="row" style={{ marginBottom: '.8rem' }}>
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 0 }}>
            <Search style={{ position: 'absolute', left: 12, top: 11, width: 16, height: 16, color: 'var(--text-muted)' }} />
            <input id="act-search" className="input" style={{ paddingLeft: '2.2rem' }} placeholder="Buscar por título o nota…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar sesiones" />
          </div>
          <select id="act-group" className="input" style={{ width: 'auto' }} value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Filtrar por deporte">
            <option value="all">Todos los deportes</option>
            {usedGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <Seg value={sort} onChange={setSort} options={[['date', 'Recientes'], ['distance', 'Distancia'], ['time', 'Duración']]} />
        </div>
        {list.length === 0 ? (
          <Empty icon="🗒️" title={mine.length ? 'Ninguna sesión coincide con el filtro' : 'Todavía no has registrado ninguna sesión'}>
            {!mine.length && <button className="btn btn-primary" onClick={() => ui.editActivity()}><Plus /> Registrar la primera</button>}
          </Empty>
        ) : (
          <div className="stack" style={{ gap: '.15rem' }}>
            {list.slice(0, limit).map((a) => <ActivityRow key={a.id} a={a} me={me} />)}
            {list.length > limit && <button className="btn" style={{ alignSelf: 'center', marginTop: '.6rem' }} onClick={() => setLimit(limit + 30)}>Ver más ({list.length - limit})</button>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Detalle ---------- */
export function ActivityDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const db = useDB();
  const ui = useUi();
  const me = currentUser(db)!;
  const a = db.activities.find((x) => x.id === id);
  const [text, setText] = useState('');
  if (!a) return null;
  const owner = userById(a.userId, db);
  if (!canViewActivity(me, a, owner)) {
    return <Modal title="Sesión privada" size="narrow" onClose={onClose}><p className="muted">Su autor no la comparte con tu perfil.</p></Modal>;
  }
  const s = sportOf(a.sport);
  const isMine = a.userId === me.id;
  const editable = canEditActivity(me, a);
  const VisIcon = VIS[a.visibility].icon;
  const bestSets = new Map<string, number>();
  a.sets?.forEach((x) => x.weight && bestSets.set(x.exercise, Math.max(bestSets.get(x.exercise) ?? 0, epley1RM(x.weight, x.reps))));
  const remove = async () => {
    if (await ui.confirm({ title: '¿Borrar esta sesión?', body: isMine ? 'Dejará de contar en tus estadísticas. No se puede deshacer.' : `Vas a borrar una sesión de ${owner?.name}. Quedará anotado en la auditoría.`, action: 'Borrar', danger: true })) {
      if (ui.run(() => deleteActivity(a.id), 'Sesión borrada')) onClose();
    }
  };
  return (
    <Modal title={a.title || s.name} size="wide" onClose={onClose}>
      <div className="stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="row">
            <Avatar user={owner} size={2.2} />
            <div>
              <div style={{ fontWeight: 700 }}>{owner?.name}</div>
              <div className="muted small">{s.emoji} {s.name} · {fmtDateTime(a.date)}</div>
            </div>
          </div>
          <div className="row">
            <span className="pill"><VisIcon /> {VIS[a.visibility].label}</span>
            {editable && isMine && <button className="btn btn-sm" onClick={() => { onClose(); ui.editActivity(a.id); }}><Pencil /> Editar</button>}
            {editable && <button className="btn btn-sm btn-danger" onClick={remove}><Trash2 /> Borrar</button>}
          </div>
        </div>

        {a.route && <RouteThumb route={a.route} sport={a.sport} color={owner?.color} size="100%" animate />}

        <div className="kv num">
          {a.distanceKm ? <div className="stat"><span className="stat__label">Distancia</span><span className="stat__value">{fmtNum(toUnit(a.distanceKm, me.units), 2)}<small>{me.units}</small></span></div> : null}
          <div className="stat"><span className="stat__label">Tiempo</span><span className="stat__value">{fmtDur(a.durationSec)}</span></div>
          {a.distanceKm ? <div className="stat"><span className="stat__label">Ritmo medio</span><span className="stat__value">{fmtEffort(a, me.units).split(' ')[0]}<small>{fmtEffort(a, me.units).split(' ')[1]}</small></span></div> : null}
          {a.elevationM ? <div className="stat"><span className="stat__label">Desnivel +</span><span className="stat__value">{fmtNum(a.elevationM, 0)}<small>m</small></span></div> : null}
          {a.avgHr ? <div className="stat"><span className="stat__label">FC media</span><span className="stat__value">{a.avgHr}<small>ppm</small></span></div> : null}
          {a.rpe ? <div className="stat"><span className="stat__label">Esfuerzo (RPE)</span><span className="stat__value">{a.rpe}<small>/10</small></span></div> : null}
          {a.calories ? <div className="stat"><span className="stat__label">Energía</span><span className="stat__value">{fmtNum(a.calories, 0)}<small>kcal</small></span></div> : null}
        </div>

        {a.elevProfile && a.elevProfile.length > 2 && (
          <div>
            <h4 style={{ marginBottom: '.4rem' }}>Perfil de altitud</h4>
            <LineChart height={150} unit="m" series={[{ name: 'Altitud', color: 'var(--s5)', values: a.elevProfile, area: false }]}
              labels={a.elevProfile.map((_, i) => `${fmtNum(toUnit(((a.distanceKm ?? 0) * i) / (a.elevProfile!.length - 1), me.units))} ${me.units}`)} />
          </div>
        )}

        {a.sets?.length ? (
          <div>
            <h4 style={{ marginBottom: '.4rem' }}>Series</h4>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Ejercicio</th><th className="r">Reps</th><th className="r">Peso</th><th className="r">1RM est.</th></tr></thead>
                <tbody>
                  {a.sets.map((x, i) => (
                    <tr key={i}><td>{x.exercise}</td><td className="r">{x.reps}</td><td className="r">{x.weight ? `${fmtNum(x.weight)} kg` : 'Peso corporal'}</td><td className="r">{x.weight ? `${fmtNum(epley1RM(x.weight, x.reps), 0)} kg` : '–'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <div>
          <h4 style={{ marginBottom: '.3rem' }}>{isMine ? '¿Qué tal la sesión?' : 'Valoración'}</h4>
          {isMine && can(me, 'activity.write') ? <StarInput value={a.rating} onChange={(n) => ui.run(() => rateActivity(a.id, n))} /> : <Stars value={a.rating} />}
        </div>
        {a.notes && <p style={{ overflowWrap: 'anywhere' }}>{a.notes}</p>}

        <div className="row"><KudosButton a={a} me={me} />
          {a.kudos.length > 0 && <span className="muted small">{a.kudos.map((k) => userById(k, db)?.name).filter(Boolean).slice(0, 4).join(', ')}{a.kudos.length > 4 ? ` y ${a.kudos.length - 4} más` : ''}</span>}
        </div>

        <div className="stack" style={{ gap: '.5rem' }}>
          {a.comments.map((c) => {
            const cu = userById(c.userId, db);
            const canDel = c.userId === me.id || isMine || can(me, 'activity.moderate');
            return (
              <div className="comment" key={c.id}>
                <Avatar user={cu} size={1.8} />
                <div className="comment__bubble"><strong>{cu?.name}</strong> <span className="muted small">· {fmtAgo(c.at)}</span><br />{c.text}</div>
                {canDel && <button className="icon-btn" aria-label="Borrar comentario" onClick={() => ui.run(() => deleteComment(a.id, c.id))}><Trash2 /></button>}
              </div>
            );
          })}
          {can(me, 'social.interact') ? (
            <form className="row" style={{ flexWrap: 'nowrap' }} onSubmit={(e) => { e.preventDefault(); if (ui.run(() => addComment(a.id, text))) setText(''); }}>
              <input id="comment-text" className="input" placeholder="Escribe un comentario…" value={text} onChange={(e) => setText(e.target.value)} maxLength={400} aria-label="Comentario" />
              <button className="icon-btn" type="submit" aria-label="Enviar comentario" disabled={!text.trim()}><Send /></button>
            </form>
          ) : <p className="muted small">Los invitados pueden leer, pero no comentar.</p>}
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Formulario ---------- */
const num = (v: string) => (v.trim() === '' ? undefined : Number(v.replace(',', '.')));

export function ActivityForm({ id, preset, onClose }: { id?: string; preset?: Record<string, unknown>; onClose: () => void }) {
  const db = useDB();
  const ui = useUi();
  const me = currentUser(db)!;
  const prev = id ? db.activities.find((a) => a.id === id) : undefined;
  const init = { ...(prev ?? {}), ...(preset ?? {}) } as Partial<Activity>;
  const [sport, setSport] = useState(init.sport ?? 'run');
  const [title, setTitle] = useState(init.title ?? '');
  const [date, setDate] = useState(toLocalInput(init.date ? new Date(init.date) : new Date()));
  const [h, setH] = useState(init.durationSec ? String(Math.floor(init.durationSec / 3600)) : '');
  const [m, setM] = useState(init.durationSec ? String(Math.round((init.durationSec % 3600) / 60)) : '');
  const [dist, setDist] = useState(init.distanceKm ? String(Math.round(toUnit(init.distanceKm, me.units) * 100) / 100) : '');
  const [elev, setElev] = useState(init.elevationM ? String(init.elevationM) : '');
  const [hr, setHr] = useState(init.avgHr ? String(init.avgHr) : '');
  const [rpe, setRpe] = useState(init.rpe ?? 5);
  const [rating, setRating] = useState(init.rating ?? 0);
  const [notes, setNotes] = useState(init.notes ?? '');
  const [visibility, setVisibility] = useState<Visibility>(init.visibility ?? me.defaultVisibility);
  const [sets, setSets] = useState<GymSet[]>(init.sets ?? []);
  const [route, setRoute] = useState(init.route);
  const [elevProfile, setElevProfile] = useState(init.elevProfile);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const s = sportOf(sport);
  const durationSec = (Number(h) || 0) * 3600 + (Number(m) || 0) * 60;

  const onGpx = async (file?: File) => {
    if (!file) return;
    try {
      const t = parseGpx(await file.text());
      setDist(String(Math.round(toUnit(t.distanceKm, me.units) * 100) / 100));
      if (t.elevationM) setElev(String(t.elevationM));
      if (t.durationSec) { setH(String(Math.floor(t.durationSec / 3600))); setM(String(Math.round((t.durationSec % 3600) / 60))); }
      if (t.startedAt) setDate(toLocalInput(new Date(t.startedAt)));
      if (t.name && !title) setTitle(t.name);
      setRoute(t.route);
      setElevProfile(t.elevProfile);
      if (!sportOf(sport).hasDistance) setSport('run');
      ui.toast(`Ruta importada: ${fmtDist(t.distanceKm, me.units, 2)}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const when = new Date(date);
      if (isNaN(when.getTime())) throw new Error('Revisa la fecha.');
      if (when.getTime() > Date.now() + 5 * 60000) throw new Error('La fecha está en el futuro. Las sesiones planificadas van en el plan.');
      const d = num(dist);
      if (d !== undefined && (!isFinite(d) || d < 0)) throw new Error('La distancia no es un número válido.');
      saveActivity({
        id, sport, title: title.trim() || s.name, date: when.toISOString(), durationSec,
        distanceKm: s.hasDistance && d ? Math.round(fromUnit(d, me.units) * 1000) / 1000 : undefined,
        elevationM: num(elev), avgHr: num(hr), rpe, rating, notes: notes.trim(), visibility,
        sets: s.hasSets && sets.length ? sets.filter((x) => x.exercise && x.reps > 0) : undefined,
        route: s.hasDistance ? route : undefined, elevProfile: s.hasDistance ? elevProfile : undefined,
        calories: undefined, planSessionKey: init.planSessionKey,
      });
      ui.toast(id ? 'Cambios guardados' : 'Sesión guardada');
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Modal title={id ? 'Editar sesión' : 'Nueva sesión'} size="wide" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="sport-grid" role="radiogroup" aria-label="Deporte">
          {SPORTS.map((x) => (
            <button type="button" key={x.id} role="radio" aria-checked={sport === x.id} className={`sport-opt ${sport === x.id ? 'active' : ''}`} onClick={() => setSport(x.id)}>
              <span>{x.emoji}</span><span>{x.name}</span>
            </button>
          ))}
        </div>
        <div className="form-grid">
          <Field label="Título" full><input id="f-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={s.name} maxLength={80} /></Field>
          <Field label="Fecha y hora"><input id="f-date" className="input" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
          <Field label="Duración">
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input id="f-h" className="input" type="number" min="0" max="48" inputMode="numeric" placeholder="0" value={h} onChange={(e) => setH(e.target.value)} aria-label="Horas" /><span className="muted">h</span>
              <input id="f-m" className="input" type="number" min="0" max="59" inputMode="numeric" placeholder="45" value={m} onChange={(e) => setM(e.target.value)} aria-label="Minutos" /><span className="muted">min</span>
            </div>
          </Field>
          {s.hasDistance && (
            <>
              <Field label={`Distancia (${me.units})`}><input id="f-dist" className="input" inputMode="decimal" placeholder="8,5" value={dist} onChange={(e) => setDist(e.target.value)} /></Field>
              <Field label="Desnivel positivo (m)"><input id="f-elev" className="input" type="number" min="0" inputMode="numeric" value={elev} onChange={(e) => setElev(e.target.value)} /></Field>
            </>
          )}
          <Field label="FC media (ppm)"><input id="f-hr" className="input" type="number" min="40" max="230" inputMode="numeric" value={hr} onChange={(e) => setHr(e.target.value)} /></Field>
          <Field label={`Esfuerzo percibido: ${rpe}/10`} hint="1 = paseo · 5 = cómodo · 8 = duro · 10 = máximo">
            <input id="f-rpe" type="range" min="1" max="10" value={rpe} onChange={(e) => setRpe(Number(e.target.value))} style={{ accentColor: 'var(--accent)' }} />
          </Field>
          <Field label="Quién puede verla">
            <select id="f-vis" className="input" value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}>
              {(Object.keys(VIS) as Visibility[]).map((v) => <option key={v} value={v}>{VIS[v].label}</option>)}
            </select>
          </Field>
        </div>

        {s.hasDistance && (
          <div className="row">
            <input ref={fileRef} type="file" accept=".gpx,application/gpx+xml" hidden onChange={(e) => onGpx(e.target.files?.[0])} />
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}><Upload /> Importar GPX</button>
            {route ? <span className="pill pill-good">Ruta cargada</span> : <span className="muted small">Rellena distancia, tiempo, desnivel y dibuja la ruta.</span>}
            {route && <button type="button" className="btn btn-sm" onClick={() => { setRoute(undefined); setElevProfile(undefined); }}>Quitar ruta</button>}
          </div>
        )}

        {s.hasSets && (
          <div className="stack" style={{ gap: '.5rem' }}>
            <h4>Series</h4>
            {sets.map((x, i) => (
              <div className="row" key={i} style={{ flexWrap: 'nowrap' }}>
                <input className="input" list="exercises" value={x.exercise} placeholder="Ejercicio" aria-label="Ejercicio" onChange={(e) => setSets(sets.map((y, k) => (k === i ? { ...y, exercise: e.target.value } : y)))} style={{ flex: 2 }} />
                <input className="input" type="number" min="0" value={x.reps || ''} placeholder="Reps" aria-label="Repeticiones" onChange={(e) => setSets(sets.map((y, k) => (k === i ? { ...y, reps: Number(e.target.value) } : y)))} style={{ flex: 1 }} />
                <input className="input" type="number" min="0" step="0.5" value={x.weight || ''} placeholder="kg" aria-label="Peso en kilos" onChange={(e) => setSets(sets.map((y, k) => (k === i ? { ...y, weight: Number(e.target.value) } : y)))} style={{ flex: 1 }} />
                <button type="button" className="icon-btn" aria-label="Quitar serie" onClick={() => setSets(sets.filter((_, k) => k !== i))}><Trash2 /></button>
              </div>
            ))}
            <datalist id="exercises">{EXERCISES.map((x) => <option key={x} value={x} />)}</datalist>
            <button type="button" className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setSets([...sets, sets.length ? { ...sets[sets.length - 1] } : { exercise: '', reps: 8, weight: 0 }])}><Plus /> Añadir serie</button>
          </div>
        )}

        <Field label="¿Qué tal ha ido?"><StarInput value={rating} onChange={setRating} /></Field>
        <Field label="Notas"><textarea id="f-notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="El tramo, el ritmo, cómo te sentiste…" maxLength={600} /></Field>
        {durationSec > 0 && <p className="muted small">Gasto estimado: {fmtNum(estimateCalories(sport, durationSec, me.weightKg), 0)} kcal con tu peso de {fmtNum(me.weightKg)} kg.</p>}
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary">{id ? 'Guardar cambios' : 'Guardar sesión'}</button>
        </div>
      </form>
    </Modal>
  );
}
