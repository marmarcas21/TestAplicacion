import { BarChart3, CalendarDays, Flag, HeartPulse, Home, List, LogOut, Menu, Plus, Settings, ShieldCheck, Timer, UserCog, Users, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Avatar, Modal, RolePill, UiCtx, useRoute, useUiState } from './components/ui';
import { can, type Permission } from './lib/permissions';
import { currentUser, logout, useDB } from './lib/store';
import type { User } from './lib/types';
import { AuthPage, BrandMark, SettingsPage } from './pages/Account';
import { ActivitiesPage, ActivityDetail, ActivityForm } from './pages/Activities';
import { DashboardPage } from './pages/Dashboard';
import { AdminPage, BodyPage, TeamPage } from './pages/People';
import { PlanPage } from './pages/Plan';
import { RecordPage } from './pages/Record';
import { ChallengesPage, SocialPage } from './pages/Social';
import { StatsPage } from './pages/Stats';

interface Route {
  id: string;
  label: string;
  icon: LucideIcon;
  page: () => JSX.Element;
  /** Permiso necesario; sin él la ruta ni aparece ni se puede abrir */
  needs?: Permission;
  section: 'Entreno' | 'Comunidad' | 'Gestión' | 'Cuenta';
}

const ROUTES: Route[] = [
  { id: 'inicio', label: 'Inicio', icon: Home, page: DashboardPage, needs: 'activity.write', section: 'Entreno' },
  { id: 'actividades', label: 'Sesiones', icon: List, page: ActivitiesPage, needs: 'activity.write', section: 'Entreno' },
  { id: 'registrar', label: 'Cronómetro', icon: Timer, page: RecordPage, needs: 'activity.write', section: 'Entreno' },
  { id: 'estadisticas', label: 'Estadísticas', icon: BarChart3, page: StatsPage, needs: 'stats.own', section: 'Entreno' },
  { id: 'plan', label: 'Plan y calendario', icon: CalendarDays, page: PlanPage, needs: 'activity.write', section: 'Entreno' },
  { id: 'cuerpo', label: 'Cuerpo', icon: HeartPulse, page: BodyPage, needs: 'body.own', section: 'Entreno' },
  { id: 'social', label: 'Amigos', icon: Users, page: SocialPage, section: 'Comunidad' },
  { id: 'retos', label: 'Retos', icon: Flag, page: ChallengesPage, section: 'Comunidad' },
  { id: 'equipo', label: 'Mi equipo', icon: UserCog, page: TeamPage, needs: 'team.view', section: 'Gestión' },
  { id: 'admin', label: 'Administración', icon: ShieldCheck, page: AdminPage, needs: 'user.manage', section: 'Gestión' },
  { id: 'ajustes', label: 'Ajustes', icon: Settings, page: SettingsPage, section: 'Cuenta' },
];

const allowed = (me: User) => ROUTES.filter((r) => !r.needs || can(me, r.needs));

export function App() {
  const db = useDB();
  const me = currentUser(db);
  const [route, go] = useRoute();
  const uiState = useUiState();
  const [detail, setDetail] = useState<string | null>(null);
  const [form, setForm] = useState<null | { id?: string; preset?: Record<string, unknown> }>(null);
  const [more, setMore] = useState(false);

  // El tema elegido en Ajustes manda sobre el del sistema
  useEffect(() => {
    const root = document.documentElement;
    if (db.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', db.theme);
  }, [db.theme]);

  const ui = useMemo(() => ({
    toast: uiState.toast, confirm: uiState.confirm, run: uiState.run, go,
    openActivity: (id: string) => setDetail(id),
    editActivity: (id?: string, preset?: Record<string, unknown>) => {
      const u = currentUser();
      if (!can(u, 'activity.write')) return uiState.toast('Tu rol no permite registrar sesiones.', 'error');
      setForm({ id, preset });
    },
  }), [uiState.toast, uiState.confirm, uiState.run, go]);

  if (!me) {
    return (
      <>
        <Blobs />
        <AuthPage />
      </>
    );
  }

  const routes = allowed(me);
  const current = routes.find((r) => r.id === route) ?? routes[0];
  const Page = current.page;
  const sections = ['Entreno', 'Comunidad', 'Gestión', 'Cuenta'] as const;
  const canWrite = can(me, 'activity.write');
  const tabs = canWrite ? ['inicio', 'actividades', 'social'] : ['social', 'retos', 'ajustes'];
  const exit = () => { setDetail(null); setForm(null); logout(); };

  return (
    <UiCtx.Provider value={ui}>
      <Blobs />
      <div className="shell">
        <aside className="sidebar">
          <div className="brand"><BrandMark /> RutaLibre</div>
          {canWrite && <button className="btn btn-primary" style={{ margin: '0 .2rem .4rem' }} onClick={() => ui.editActivity()}><Plus /> Añadir sesión</button>}
          <nav aria-label="Principal">
            {sections.map((s) => {
              const items = routes.filter((r) => r.section === s);
              if (!items.length) return null;
              return (
                <div key={s}>
                  <div className="nav-label">{s}</div>
                  {items.map((r) => (
                    <button key={r.id} className={`nav-item ${current.id === r.id ? 'active' : ''}`} aria-current={current.id === r.id ? 'page' : undefined} onClick={() => go(r.id)}>
                      <r.icon /> {r.label}
                    </button>
                  ))}
                </div>
              );
            })}
          </nav>
          <div className="sidebar-foot">
            <div className="user-chip glass">
              <Avatar user={me} size={2.2} />
              <div className="user-chip__text"><div className="user-chip__name">{me.name}</div><RolePill role={me.role} /></div>
              <button className="icon-btn" onClick={exit} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut /></button>
            </div>
          </div>
        </aside>

        <div>
          <header className="topbar">
            <div className="brand"><BrandMark /> RutaLibre</div>
            <div className="row"><RolePill role={me.role} /><button className="icon-btn" onClick={() => go('ajustes')} aria-label="Ajustes"><Avatar user={me} size={2.1} /></button></div>
          </header>
          <main className="main"><Page key={current.id + me.id} /></main>
        </div>

        <nav className="bottom-nav" aria-label="Principal">
          {tabs.slice(0, canWrite ? 2 : 3).map((id) => <Tab key={id} r={ROUTES.find((r) => r.id === id)!} active={current.id === id} go={go} />)}
          {canWrite && <button className="tab-fab" onClick={() => ui.editActivity()} aria-label="Añadir sesión"><Plus /></button>}
          {canWrite && <Tab r={ROUTES.find((r) => r.id === 'social')!} active={current.id === 'social'} go={go} />}
          {canWrite && <button className={`tab ${!tabs.includes(current.id) ? 'active' : ''}`} onClick={() => setMore(true)}><Menu /><span>Más</span></button>}
        </nav>
      </div>

      {more && (
        <Modal title="Más" size="narrow" onClose={() => setMore(false)}>
          <div className="stack" style={{ gap: '.2rem' }}>
            {routes.filter((r) => !tabs.includes(r.id)).map((r) => (
              <button key={r.id} className={`nav-item ${current.id === r.id ? 'active' : ''}`} onClick={() => { setMore(false); go(r.id); }}><r.icon /> {r.label}</button>
            ))}
            <button className="nav-item" onClick={() => { setMore(false); exit(); }}><LogOut /> Cerrar sesión</button>
          </div>
        </Modal>
      )}
      {detail && <ActivityDetail id={detail} onClose={() => setDetail(null)} />}
      {form && <ActivityForm id={form.id} preset={form.preset} onClose={() => setForm(null)} />}
      {uiState.layer}
    </UiCtx.Provider>
  );
}

function Tab({ r, active, go }: { r: Route; active: boolean; go: (id: string) => void }) {
  return <button className={`tab ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => go(r.id)}><r.icon /><span>{r.label}</span></button>;
}

const Blobs = () => <div className="blobs" aria-hidden="true"><div className="blob blob-a" /><div className="blob blob-b" /><div className="blob blob-c" /></div>;
