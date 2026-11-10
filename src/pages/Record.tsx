import { Flag, MapPin, Pause, Play, RotateCcw, Square } from 'lucide-react';
import { useEffect, useReducer } from 'react';
import { RouteThumb, useUi } from '../components/ui';
import { haversineKm, normalizeRoute, type TrackPoint } from '../lib/gpx';
import { fmtClock, fmtDist, fmtPace } from '../lib/metrics';
import { SPORTS, sportOf } from '../lib/sports';
import { currentUser, useDB } from '../lib/store';

/* El estado vive fuera del componente: puedes cambiar de pantalla sin parar el crono. */
const rec = {
  sport: 'run',
  status: 'idle' as 'idle' | 'running' | 'paused',
  startedAt: 0,
  accumulated: 0, // ms ya contados antes de la última reanudación
  resumedAt: 0,
  laps: [] as number[],
  points: [] as TrackPoint[],
  distanceKm: 0,
  gps: 'off' as 'off' | 'on' | 'denied',
  watchId: null as number | null,
  wakeLock: null as { release: () => Promise<void> } | null,
};
const elapsedMs = () => rec.accumulated + (rec.status === 'running' ? Date.now() - rec.resumedAt : 0);

function startGps(onChange: () => void) {
  if (!('geolocation' in navigator)) {
    rec.gps = 'denied';
    return onChange();
  }
  try {
    rec.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        rec.gps = 'on';
        if (rec.status !== 'running' || pos.coords.accuracy > 40) return onChange();
        const p: TrackPoint = { lat: pos.coords.latitude, lon: pos.coords.longitude, ele: pos.coords.altitude ?? undefined, time: pos.timestamp };
        const last = rec.points[rec.points.length - 1];
        if (last) {
          const d = haversineKm(last, p);
          if (d < 0.004) return; // menos de 4 m: ruido
          rec.distanceKm += d;
        }
        rec.points.push(p);
        onChange();
      },
      () => { rec.gps = 'denied'; onChange(); },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
  } catch {
    rec.gps = 'denied';
    onChange();
  }
}
function stopGps() {
  if (rec.watchId != null) navigator.geolocation?.clearWatch(rec.watchId);
  rec.watchId = null;
}

export function RecordPage() {
  const db = useDB();
  const ui = useUi();
  const me = currentUser(db)!;
  const [, tick] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const t = setInterval(() => rec.status === 'running' && tick(), 250);
    return () => clearInterval(t);
  }, []);

  const start = async () => {
    if (rec.status === 'idle') {
      rec.startedAt = Date.now();
      rec.accumulated = 0;
      rec.laps = [];
      rec.points = [];
      rec.distanceKm = 0;
      if (sportOf(rec.sport).hasDistance && rec.gps !== 'denied') startGps(tick);
    }
    rec.resumedAt = Date.now();
    rec.status = 'running';
    try {
      rec.wakeLock = await (navigator as any).wakeLock?.request('screen');
    } catch {
      /* la pantalla podrá apagarse; el crono sigue contando */
    }
    tick();
  };
  const pause = () => {
    rec.accumulated = elapsedMs();
    rec.status = 'paused';
    rec.wakeLock?.release().catch(() => {});
    tick();
  };
  const reset = () => {
    stopGps();
    rec.status = 'idle';
    rec.accumulated = 0;
    rec.laps = [];
    rec.points = [];
    rec.distanceKm = 0;
    if (rec.gps === 'on') rec.gps = 'off';
    tick();
  };
  const finish = () => {
    const ms = elapsedMs();
    if (ms < 10000) return ui.toast('Menos de 10 segundos: no hay nada que guardar.', 'error');
    pause();
    stopGps();
    const lapsNote = rec.laps.length ? `Parciales: ${[...rec.laps, ms].map((l, i, arr) => fmtClock((l - (arr[i - 1] ?? 0)) / 1000)).join(' · ')}` : '';
    ui.editActivity(undefined, {
      sport: rec.sport, durationSec: Math.round(ms / 1000), date: new Date(rec.startedAt).toISOString(), notes: lapsNote,
      distanceKm: rec.distanceKm > 0.05 ? Math.round(rec.distanceKm * 100) / 100 : undefined,
      route: rec.points.length > 2 ? normalizeRoute(rec.points) : undefined,
    });
    rec.status = 'idle';
    rec.accumulated = 0;
    tick();
  };

  const ms = elapsedMs();
  const s = sportOf(rec.sport);
  const idle = rec.status === 'idle';
  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div className="page-head"><div><h1 className="page-title">Cronómetro</h1><p className="page-sub">Entrena ahora y guarda la sesión al terminar.</p></div></div>

      {idle && ms === 0 && (
        <div className="card glass">
          <div className="card-head"><h3>¿Qué vas a hacer?</h3></div>
          <div className="sport-grid" role="radiogroup" aria-label="Deporte">
            {SPORTS.slice(0, 15).map((x) => (
              <button key={x.id} role="radio" aria-checked={rec.sport === x.id} className={`sport-opt ${rec.sport === x.id ? 'active' : ''}`} onClick={() => { rec.sport = x.id; tick(); }}>
                <span>{x.emoji}</span><span>{x.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card glass stack" style={{ alignItems: 'center', padding: '2rem 1.1rem', gap: '1.4rem' }}>
        <span className="pill pill-accent">{s.emoji} {s.name}{rec.status === 'paused' ? ' · en pausa' : ''}</span>
        <div className="clock" aria-live="off">{fmtClock(ms / 1000)}</div>
        {s.hasDistance && (
          <div className="row num" style={{ gap: '2rem', justifyContent: 'center' }}>
            <div className="stat" style={{ alignItems: 'center' }}><span className="stat__label">Distancia</span><span className="stat__value">{fmtDist(rec.distanceKm, me.units, 2)}</span></div>
            <div className="stat" style={{ alignItems: 'center' }}><span className="stat__label">Ritmo</span><span className="stat__value">{rec.distanceKm > 0.05 ? fmtPace(ms / 1000, rec.distanceKm, me.units) : '–'}</span></div>
          </div>
        )}
        <div className="row" style={{ gap: '1.2rem', justifyContent: 'center' }}>
          {!idle && <button className="rec-btn ghost" onClick={reset} aria-label="Descartar"><RotateCcw /></button>}
          {rec.status === 'running'
            ? <button className="rec-btn" onClick={pause} aria-label="Pausar"><Pause /></button>
            : <button className="rec-btn" onClick={start} aria-label={idle ? 'Empezar' : 'Reanudar'}><Play /></button>}
          {rec.status === 'running' && <button className="rec-btn ghost" onClick={() => { rec.laps.push(ms); tick(); }} aria-label="Marcar parcial"><Flag /></button>}
          {!idle && <button className="rec-btn ghost" onClick={finish} aria-label="Terminar y guardar"><Square /></button>}
        </div>
        {!idle && <p className="muted small">■ termina y abre el formulario para guardar · ⚑ marca un parcial</p>}
        {rec.points.length > 2 && <RouteThumb route={normalizeRoute(rec.points)} sport={rec.sport} size={160} />}
      </div>

      {s.hasDistance && (
        rec.gps === 'denied'
          ? <div className="notice"><MapPin /> No hay acceso al GPS en este navegador. El cronómetro funciona igual: añade la distancia a mano al guardar, o importa el GPX de tu reloj.</div>
          : <div className="notice info"><MapPin /> {rec.gps === 'on' ? `GPS activo · ${rec.points.length} puntos registrados.` : 'Al empezar se pedirá permiso de ubicación para medir distancia y dibujar la ruta.'}</div>
      )}

      {rec.laps.length > 0 && (
        <div className="card glass">
          <div className="card-head"><h3>Parciales</h3></div>
          <div className="table-wrap"><table>
            <thead><tr><th>Nº</th><th className="r">Parcial</th><th className="r">Acumulado</th></tr></thead>
            <tbody>{rec.laps.map((l, i) => <tr key={i}><td>{i + 1}</td><td className="r">{fmtClock((l - (rec.laps[i - 1] ?? 0)) / 1000)}</td><td className="r">{fmtClock(l / 1000)}</td></tr>)}</tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
