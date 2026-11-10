import type { Activity, Role, User } from './types';

export type Permission =
  | 'activity.write' // registrar y editar sesiones propias
  | 'activity.viewAll' // ver sesiones de cualquiera, sea cual sea su privacidad
  | 'activity.moderate' // borrar sesiones o comentarios ajenos
  | 'social.interact' // dar ánimos, comentar, seguir
  | 'stats.own'
  | 'body.own'
  | 'goal.own'
  | 'plan.manage' // crear planes y asignarlos
  | 'team.view' // ver el panel de atletas
  | 'challenge.manage'
  | 'challenge.join'
  | 'user.manage' // cambiar roles, suspender, asignar entrenador
  | 'audit.view'
  | 'data.admin'; // importar / restablecer todos los datos

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador',
  coach: 'Entrenador',
  athlete: 'Atleta',
  guest: 'Invitado',
};

export const ROLE_DESC: Record<Role, string> = {
  admin: 'Control total: usuarios, roles, moderación y datos.',
  coach: 'Crea planes y retos, y sigue a sus atletas.',
  athlete: 'Registra y analiza su propio entrenamiento.',
  guest: 'Solo lectura: ve lo que es público.',
};

const ATHLETE: Permission[] = [
  'activity.write', 'social.interact', 'stats.own', 'body.own', 'goal.own', 'challenge.join',
];
const COACH: Permission[] = [...ATHLETE, 'plan.manage', 'team.view', 'challenge.manage'];

export const ROLE_PERMS: Record<Role, Permission[]> = {
  guest: [],
  athlete: ATHLETE,
  coach: COACH,
  admin: [...COACH, 'activity.viewAll', 'activity.moderate', 'user.manage', 'audit.view', 'data.admin'],
};

export const PERMISSION_LABEL: Record<Permission, string> = {
  'activity.write': 'Registrar y editar sus sesiones',
  'stats.own': 'Estadísticas y récords propios',
  'body.own': 'Seguimiento corporal',
  'goal.own': 'Objetivos personales',
  'social.interact': 'Dar ánimos, comentar y seguir',
  'challenge.join': 'Unirse a retos',
  'plan.manage': 'Crear y asignar planes',
  'team.view': 'Ver el progreso de sus atletas',
  'challenge.manage': 'Crear y borrar retos',
  'activity.viewAll': 'Ver cualquier sesión',
  'activity.moderate': 'Moderar sesiones y comentarios',
  'user.manage': 'Gestionar usuarios y roles',
  'audit.view': 'Ver el registro de auditoría',
  'data.admin': 'Importar y restablecer datos',
};

export function can(user: Pick<User, 'role' | 'status'> | null | undefined, perm: Permission): boolean {
  if (!user || user.status !== 'active') return false;
  return ROLE_PERMS[user.role].includes(perm);
}

/** ¿Puede `viewer` ver la sesión `a` de `owner`? */
export function canViewActivity(viewer: User | null, a: Activity, owner: User | undefined): boolean {
  if (!viewer || !owner) return false;
  if (a.userId === viewer.id) return true;
  if (can(viewer, 'activity.viewAll')) return true;
  if (viewer.role === 'coach' && owner.coachId === viewer.id) return true;
  if (a.visibility === 'public') return true;
  if (a.visibility === 'friends') return viewer.role !== 'guest' && owner.friends.includes(viewer.id);
  return false;
}

export function canEditActivity(viewer: User | null, a: Activity): boolean {
  if (!viewer) return false;
  if (a.userId === viewer.id) return can(viewer, 'activity.write');
  return can(viewer, 'activity.moderate');
}

/** ¿Puede `viewer` consultar los datos agregados de `target`? */
export function canViewAthlete(viewer: User | null, target: User): boolean {
  if (!viewer) return false;
  if (viewer.id === target.id) return true;
  if (can(viewer, 'user.manage')) return true;
  return can(viewer, 'team.view') && target.coachId === viewer.id;
}
