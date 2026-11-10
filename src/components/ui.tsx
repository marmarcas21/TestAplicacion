import { X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ROLE_LABEL } from '../lib/permissions';
import { sportOf } from '../lib/sports';
import type { Role, User } from '../lib/types';

/* ---------- Navegación por hash (#nombre, sin barras) ---------- */
const readHash = () => (typeof location !== 'undefined' ? location.hash.replace(/^#/, '') : '');
export function useRoute(): [string, (name: string) => void] {
  const [route, setRoute] = useState(readHash);
  useEffect(() => {
    const on = () => setRoute(readHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = useCallback((name: string) => {
    if (readHash() !== name) location.hash = name;
    setRoute(name);
    window.scrollTo({ top: 0 });
  }, []);
  return [route, go];
}

/* ---------- Contexto de interfaz: avisos, confirmaciones y ventanas de sesión ---------- */
interface Ui {
  toast: (msg: string, kind?: 'ok' | 'error') => void;
  confirm: (opts: { title: string; body?: string; action: string; danger?: boolean }) => Promise<boolean>;
  /** Ejecuta una acción de datos y muestra el error si el rol no la permite */
  run: (fn: () => void, okMsg?: string) => boolean;
  openActivity: (id: string) => void;
  editActivity: (id?: string, preset?: Record<string, unknown>) => void;
  go: (route: string) => void;
}
export const UiCtx = createContext<Ui>(null as unknown as Ui);
export const useUi = () => useContext(UiCtx);

export function useUiState() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: 'ok' | 'error' }[]>([]);
  const [ask, setAsk] = useState<null | { title: string; body?: string; action: string; danger?: boolean; resolve: (v: boolean) => void }>(null);
  const seq = useRef(0);
  const toast = useCallback((msg: string, kind: 'ok' | 'error' = 'ok') => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  const confirm = useCallback((opts: { title: string; body?: string; action: string; danger?: boolean }) =>
    new Promise<boolean>((resolve) => setAsk({ ...opts, resolve })), []);
  const run = useCallback((fn: () => void, okMsg?: string) => {
    try {
      fn();
      if (okMsg) toast(okMsg);
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Algo ha fallado.', 'error');
      return false;
    }
  }, [toast]);
  const layer = (
    <>
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.kind === 'error' ? 'error' : ''}`}>{t.msg}</div>)}
      </div>
      {ask && (
        <Modal title={ask.title} size="narrow" onClose={() => { ask.resolve(false); setAsk(null); }}>
          {ask.body && <p className="muted">{ask.body}</p>}
          <div className="modal-foot">
            <button className="btn" onClick={() => { ask.resolve(false); setAsk(null); }}>Cancelar</button>
            <button className={`btn ${ask.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => { ask.resolve(true); setAsk(null); }}>{ask.action}</button>
          </div>
        </Modal>
      )}
    </>
  );
  return { toast, confirm, run, layer };
}

/* ---------- Piezas ---------- */
export function Modal({ title, onClose, children, size }: { title: string; onClose: () => void; children: ReactNode; size?: 'wide' | 'narrow' }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size ?? ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><X /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Avatar({ user, size = 2.4 }: { user?: Pick<User, 'name' | 'color'>; size?: number }) {
  return (
    <span className="avatar" style={{ width: `${size}rem`, height: `${size}rem`, fontSize: `${size * 0.4}rem`, background: user?.color ?? '#8a8f9c' }} aria-hidden="true">
      {(user?.name ?? '?').charAt(0).toUpperCase()}
    </span>
  );
}

export const RolePill = ({ role }: { role: Role }) => <span className={`pill role-${role}`}>{ROLE_LABEL[role]}</span>;

const STAR = 'M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.8-6.2 3.8 1.6-7L2 9.2l7.1-.6z';
export function Stars({ value }: { value: number }) {
  return (
    <span className="stars" role="img" aria-label={`${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => <svg key={n} viewBox="0 0 24 24" className={n <= value ? 'star-filled' : 'star-empty'}><path d={STAR} /></svg>)}
    </span>
  );
}

export const RATING_LABELS = ['Sin puntuar', 'Floja', 'Regular', 'Bien', 'Muy bien', '¡Brutal!'];
export function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [pop, setPop] = useState(0);
  return (
    <div className="row" style={{ gap: '.2rem' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" className={`star-btn ${pop === n ? 'pop' : ''}`} aria-label={`${n} estrellas`}
          onClick={() => { onChange(value === n ? 0 : n); setPop(n); setTimeout(() => setPop(0), 300); }}>
          <svg viewBox="0 0 24 24" className={n <= value ? 'star-filled' : 'star-empty'}><path d={STAR} /></svg>
        </button>
      ))}
      <span className="pill pill-accent" style={{ marginLeft: '.4rem' }}>{RATING_LABELS[value]}</span>
    </div>
  );
}

/** Miniatura de la ruta; si la sesión no tiene traza, el emoji del deporte */
export function RouteThumb({ route, sport, color, size = 64, animate }: { route?: [number, number][]; sport: string; color?: string; size?: number | string; animate?: boolean }) {
  const style = typeof size === 'number' ? { width: size, height: size } : { width: size, aspectRatio: '1.6 / 1' };
  if (!route || route.length < 2) {
    return <div className="thumb" style={style}><span className="thumb__emoji" style={{ fontSize: typeof size === 'number' ? size * 0.42 : '3rem' }}>{sportOf(sport).emoji}</span></div>;
  }
  return (
    <div className="thumb" style={style}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style={{ color: color ?? 'var(--accent)' }} aria-hidden="true">
        <polyline className={animate ? 'route-draw' : ''} points={route.map((p) => p.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth={typeof size === 'number' && size < 80 ? 6 : 3} strokeLinecap="round" strokeLinejoin="round" opacity=".92" />
        <circle cx={route[0][0]} cy={route[0][1]} r={typeof size === 'number' && size < 80 ? 5 : 3} fill="var(--surface-solid)" stroke="currentColor" strokeWidth={typeof size === 'number' && size < 80 ? 3 : 2} />
      </svg>
    </div>
  );
}

export function Stat({ label, value, unit, delta, icon }: { label: string; value: string; unit?: string; delta?: number | null; icon?: ReactNode }) {
  return (
    <div className="stat">
      <span className="stat__label">{icon}{label}</span>
      <span className="stat__value num">{value}{unit && <small>{unit}</small>}</span>
      {delta != null && isFinite(delta) && (
        <span className={`stat__delta ${delta >= 0 ? 'up' : 'down'}`}>{delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(delta * 100))}%</span>
      )}
    </div>
  );
}

export function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="seg" role="tablist">
      {options.map(([v, label]) => (
        <button key={v} type="button" role="tab" aria-selected={v === value} className={v === value ? 'active' : ''} onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children, full }: { label: string; hint?: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={`field ${full ? 'full' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty__icon">{icon}</span>
      <strong>{title}</strong>
      {children}
    </div>
  );
}

export function ProgressBar({ pct }: { pct: number }) {
  return <div className="bar" role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.round(pct * 100)}%` }} /></div>;
}

/** Descarga un archivo; donde el navegador lo impide, copia el contenido al portapapeles */
export async function saveFile(name: string, content: string, mime: string): Promise<'downloaded' | 'copied' | 'failed'> {
  try {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch {
    /* seguimos con la copia */
  }
  try {
    await navigator.clipboard.writeText(content);
    return 'copied';
  } catch {
    return 'downloaded';
  }
}
