// renderer/lib/rbac.ts
// RBAC minimal y extensible para JABEM (frontend)

// 👑 Define los permisos de la app (añade/edita según tus módulos)
export type Permission =
  | "sales.create"
  | "sales.view"
  | "cash.close"
  | "inventory.view"
  | "inventory.edit"
  | "reports.view"
  | "users.manage"
  | "settings.manage";

// 👤 Roles disponibles (debe coincidir con lo que devuelve el backend)
export type Role = "vendedor" | "admin";

// 🎛️ Mapa de permisos por rol (inmutable)
export const rolePermissions: Readonly<Record<Role, ReadonlyArray<Permission>>> = Object.freeze({
  vendedor: Object.freeze([
    "sales.create",
    "sales.view",
    "cash.close",
    "inventory.view",
  ] as const),
  admin: Object.freeze([
    "sales.create",
    "sales.view",
    "cash.close",
    "inventory.view",
    "inventory.edit",
    "reports.view",
    "users.manage",
    "settings.manage",
  ] as const),
});

// 🧮 Utilidad: obtiene los permisos base de un rol
export const permissionsForRole = (role: Role): ReadonlyArray<Permission> =>
  rolePermissions[role] ?? [];

// ✅ Verifica que el conjunto `perms` satisface TODOS los requeridos
export function can(
  perms: Iterable<Permission>,
  required?: Permission | Permission[]
): boolean {
  if (!required) return true; // si no se requieren permisos, permitir
  const have = new Set(perms);
  const needs = Array.isArray(required) ? required : [required];
  return needs.every((p) => have.has(p));
}

// ✅ Verifica que el conjunto `perms` satisface AL MENOS UNO de los requeridos
export function canAny(
  perms: Iterable<Permission>,
  required: Permission | Permission[]
): boolean {
  const have = new Set(perms);
  const needs = Array.isArray(required) ? required : [required];
  return needs.some((p) => have.has(p));
}

// 🧑‍💻 Estructura mínima esperada del usuario en el frontend
export type UserLike = {
  id: number | string;
  nombre?: string;
  usuario?: string;
  rol: Role;
  // Opcionalmente, el backend podría enviar permisos efectivos:
  permissions?: Permission[];
};

// 🔀 Obtiene los permisos efectivos del usuario: usa `permissions` si viene del backend,
// de lo contrario deriva por rol.
export function effectivePermissions(user: UserLike): ReadonlyArray<Permission> {
  return user.permissions && user.permissions.length > 0
    ? user.permissions
    : permissionsForRole(user.rol);
}

// Atajos convenientes a partir del usuario
export const userCan = (user: UserLike, required?: Permission | Permission[]) =>
  can(effectivePermissions(user), required);

export const userCanAny = (user: UserLike, required: Permission | Permission[]) =>
  canAny(effectivePermissions(user), required);
