import { BarChart3, CalendarDays, Download, LogOut, RotateCcw, ShieldCheck, Trophy, Upload, Users } from 'lucide-react';
import { useRef, useState } from 'react';
import { Avatar, Field, RolePill, Seg, saveFile, useUi } from '../components/ui';
import { can, ROLE_DESC, ROLE_LABEL } from '../lib/permissions';
import { DEMO_PASSWORD } from '../lib/seed';
import { currentUser, exportData, importMyActivities, login, loginAs, logout, register, resetData, setTheme, updateProfile, useDB } from '../lib/store';
import type { ThemePref, Units, Visibility } from '../lib/types';
import { VIS } from './Activities';

export const BrandMark = () => (
  <span className="brand-mark" aria-hidden="true">
    <svg viewBox="0 0 100 100"><polyline points="18,82 14,52 34,30 58,36 52,14 78,10 86,36 66,48 60,80" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" /></svg>
  </span>
);

/* ---------- Acceso ---------- */
export function AuthPage() {
  const db = useDB();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const demos = db.users.filter((u) => u.passHash === 'demo' && u.status === 'active' && ['u_alex', 'u_elena', 'u_sofia', 'u_invitado'].includes(u.id));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(name, email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-hero">
        <div className="brand" style={{ padding: 0 }}><BrandMark /> RutaLibre Sport</div>
        <h1>Todo tu deporte, <em>en un solo sitio.</em></h1>
        <p>Registra cada sesión, mide tu carga y tus récords, sigue el plan de tu entrenador y comparte rutas con tus amigos.</p>
        <div className="auth-feats">
          <div className="auth-feat glass"><BarChart3 /> 20 deportes, carga y récords</div>
          <div className="auth-feat glass"><CalendarDays /> Planes y calendario</div>
          <div className="auth-feat glass"><Users /> Amigos, ánimos y comentarios</div>
          <div className="auth-feat glass"><Trophy /> Retos y clasificación</div>
          <div className="auth-feat glass"><Upload /> Importa GPX de tu reloj</div>
          <div className="auth-feat glass"><ShieldCheck /> 4 roles con permisos</div>
        </div>
      </div>

      <div className="auth-card glass">
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Entra con un perfil de ejemplo</h2>
          <p className="muted small">Cada rol ve una aplicación distinta. Pruébalos todos.</p>
        </div>
        <div className="demo-list">
          {demos.map((u) => (
            <button key={u.id} className="demo-btn" onClick={() => loginAs(u.id)}>
              <Avatar user={u} size={2.3} />
              <span style={{ flex: 1, minWidth: 0 }}><strong>{u.name}</strong> <RolePill role={u.role} /><small>{ROLE_DESC[u.role]}</small></span>
            </button>
          ))}
        </div>
        <div className="divider">o con tu cuenta</div>
        <Seg value={mode} onChange={(m) => { setMode(m); setError(''); }} options={[['login', 'Iniciar sesión'], ['register', 'Crear cuenta']]} />
        <form className="stack" onSubmit={submit}>
          {mode === 'register' && <Field label="Nombre"><input id="au-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></Field>}
          <Field label="Correo"><input id="au-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="alex@rutalibre.app" required /></Field>
          <Field label="Contraseña" hint={mode === 'register' ? 'Mínimo 8 caracteres.' : `Las cuentas de ejemplo usan «${DEMO_PASSWORD}».`}>
            <input id="au-pass" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
          </Field>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{mode === 'login' ? 'Entrar' : 'Crear cuenta'}</button>
        </form>
        <p className="muted small">Los datos se guardan solo en este navegador. Las cuentas nuevas empiezan como Atleta; un administrador puede cambiar el rol.</p>
      </div>
    </div>
  );
}

/* ---------- Ajustes ---------- */
const COLORS = ['#e0522b', '#2b6fe0', '#1b8a5a', '#a855c9', '#0e8f9c', '#be185d', '#4b4f66'];

export function SettingsPage() {
  const db = useDB();
  const ui = useUi();
  const me = currentUser(db)!;
  const [name, setName] = useState(me.name);
  const [bio, setBio] = useState(me.bio);
  const fileRef = useRef<HTMLInputElement>(null);
  const guest = me.role === 'guest';

  const doExport = async (scope: 'mine' | 'all') => {
    try {
      const res = await saveFile(scope === 'all' ? 'rutalibre-copia-completa.json' : 'rutalibre-mis-datos.json', exportData(scope), 'application/json');
      ui.toast(res === 'copied' ? 'Exportado y copiado al portapapeles' : 'Exportado');
    } catch (e) {
      ui.toast((e as Error).message, 'error');
    }
  };

  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <div className="page-head"><div><h1 className="page-title">Ajustes</h1><p className="page-sub">Perfil, preferencias y tus datos.</p></div></div>

      <div className="card glass stack">
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <Avatar user={{ name: name || me.name, color: me.color }} size={3.4} />
          <div style={{ minWidth: 0 }}>
            <div className="row"><strong style={{ fontSize: '1.1rem' }}>{me.name}</strong><RolePill role={me.role} /></div>
            <div className="muted small">{me.email}</div>
            <div className="muted small">{ROLE_DESC[me.role]}</div>
          </div>
        </div>
        {!guest && (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); ui.run(() => { if (name.trim().length < 2) throw new Error('El nombre es demasiado corto.'); updateProfile({ name: name.trim(), bio: bio.trim() }); }, 'Perfil actualizado'); }}>
            <div className="form-grid">
              <Field label="Nombre"><input id="s-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></Field>
              <Field label="Color del avatar">
                <div className="row">{COLORS.map((c) => (
                  <button type="button" key={c} aria-label={`Color ${c}`} aria-pressed={me.color === c} onClick={() => updateProfile({ color: c })}
                    style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: c, border: me.color === c ? '3px solid var(--text)' : '3px solid transparent' }} />
                ))}</div>
              </Field>
              <Field label="Sobre ti" full><textarea id="s-bio" className="input" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} /></Field>
            </div>
            <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} type="submit">Guardar perfil</button>
          </form>
        )}
      </div>

      <div className="card glass stack">
        <h3 style={{ fontSize: '1.02rem', fontWeight: 800 }}>Preferencias</h3>
        <div className="form-grid">
          <Field label="Tema"><Seg<ThemePref> value={db.theme} onChange={setTheme} options={[['system', 'Sistema'], ['light', 'Claro'], ['dark', 'Oscuro']]} /></Field>
          <Field label="Unidades"><Seg<Units> value={me.units} onChange={(u) => updateProfile({ units: u })} options={[['km', 'Kilómetros'], ['mi', 'Millas']]} /></Field>
          {!guest && (
            <Field label="Privacidad por defecto" hint="Se aplica a las sesiones nuevas. Puedes cambiarla en cada una.">
              <Seg<Visibility> value={me.defaultVisibility} onChange={(v) => updateProfile({ defaultVisibility: v })} options={(Object.keys(VIS) as Visibility[]).map((v) => [v, VIS[v].label])} />
            </Field>
          )}
        </div>
      </div>

      {!guest && (
        <div className="card glass stack">
          <h3 style={{ fontSize: '1.02rem', fontWeight: 800 }}>Tus datos</h3>
          <p className="muted small">Todo se guarda en este navegador. Exporta una copia para llevártela a otro dispositivo.</p>
          <div className="row">
            <button className="btn" onClick={() => doExport('mine')}><Download /> Exportar mis datos (JSON)</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              ui.run(() => { const n = importMyActivities(text); ui.toast(`${n} sesiones importadas`); });
              e.target.value = '';
            }} />
            <button className="btn" onClick={() => fileRef.current?.click()}><Upload /> Importar sesiones</button>
          </div>
        </div>
      )}

      {can(me, 'data.admin') && (
        <div className="card glass stack">
          <h3 style={{ fontSize: '1.02rem', fontWeight: 800 }}>Zona de administración</h3>
          <div className="row">
            <button className="btn" onClick={() => doExport('all')}><Download /> Copia completa del club</button>
            <button className="btn btn-danger" onClick={async () => {
              if (await ui.confirm({ title: '¿Restablecer todos los datos?', body: 'Se borran las cuentas, sesiones, planes y retos creados, y vuelven los datos de ejemplo. No se puede deshacer.', action: 'Restablecer', danger: true })) ui.run(() => resetData(), 'Datos de ejemplo restaurados');
            }}><RotateCcw /> Restablecer datos de ejemplo</button>
          </div>
        </div>
      )}

      <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={logout}><LogOut /> Cerrar sesión ({ROLE_LABEL[me.role]})</button>
    </div>
  );
}
