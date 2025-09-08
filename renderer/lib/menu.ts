// renderer/lib/menu.ts
// Configuración del menú JABEM (personalizable) + helpers por rol/permisos

import type { Permission, Role, UserLike } from "./rbac";
import { rolePermissions, can, effectivePermissions } from "./rbac";

/** Claves de grupo para organizar visualmente el menú */
export type MenuGroupKey = "quick" | "ventas" | "inventario" | "reportes" | "admin";

/** Estructura de un ítem de menú */
export interface MenuItem {
  /** ID único y estable (úsalo para telemetry, tests, favoritos, etc.) */
  id: string;
  /** Texto principal que se muestra */
  label: string;
  /** Texto secundario opcional */
  description?: string;
  /** Ruta Next.js a navegar (o esquema interno) */
  href: string;
  /** Permisos requeridos para mostrar el ítem */
  required?: Permission | Permission[];
  /** Grupo visual donde se renderiza */
  group: MenuGroupKey;
  /** Icono opcional (emoji o nombre de ícono) */
  icon?: string;
  /** Marca de “acción rápida” (para priorizar en layouts táctiles) */
  quick?: boolean;
}

/** Estructura agrupada que suele consumir la vista */
export interface GroupedMenu {
  group: MenuGroupKey;
  title: string;
  items: MenuItem[];
}

/** Títulos visibles por grupo (edítalos si renombras secciones) */
export const GROUP_TITLES: Record<MenuGroupKey, string> = {
  quick: "Acciones rápidas",
  ventas: "Ventas",
  inventario: "Inventario",
  reportes: "Reportes",
  admin: "Administración",
};

/** Orden de render de los grupos */
export const GROUP_ORDER: MenuGroupKey[] = ["quick", "ventas", "inventario", "reportes", "admin"];

/**
 * Menú maestro (única fuente de verdad).
 * Para añadir nuevas opciones, agrega aquí un nuevo objeto.
 */
export const MENU: MenuItem[] = [
  // ===== Acciones rápidas (touch-friendly) =====
  {
    id: "quick-new-sale",
    label: "Nueva venta",
    description: "Abrir ticket y agregar productos",
    href: "/ventas/nueva",
    required: "sales.create",
    group: "quick",
    icon: "🧾",
    quick: true,
  },
  {
    id: "quick-pending",
    label: "Cobros pendientes",
    description: "Revisar y cobrar adeudos",
    href: "/cobros",
    required: "sales.view",
    group: "quick",
    icon: "💳",
    quick: true,
  },
  {
    id: "quick-close-cash",
    label: "Cierre de caja",
    description: "Corte y arqueo del día",
    href: "/caja/cierre",
    required: "cash.close",
    group: "quick",
    icon: "🧮",
    quick: true,
  },

  // ===== Ventas =====
  {
    id: "ventas-list",
    label: "Historial de ventas",
    description: "Consulta ventas y devoluciones",
    href: "/ventas",
    required: "sales.view",
    group: "ventas",
    icon: "📚",
  },

  // ===== Inventario =====
  {
    id: "inventory",
    label: "Inventario",
    description: "Catálogo, existencias y precios",
    href: "/inventario",
    required: "inventory.view",
    group: "inventario",
    icon: "📦",
  },
  {
    id: "inventory-adjust",
    label: "Ajustes de inventario",
    description: "Entradas, salidas y correcciones",
    href: "/inventario/ajustes",
    required: "inventory.edit",
    group: "inventario",
    icon: "🧰",
  },

  // ===== Reportes =====
  {
    id: "reports",
    label: "Reportes",
    description: "Ventas por período, margen, top productos",
    href: "/reportes",
    required: "reports.view",
    group: "reportes",
    icon: "📈",
  },

  // ===== Admin =====
  {
    id: "users",
    label: "Usuarios",
    description: "Altas, permisos y roles",
    href: "/admin/usuarios",
    required: "users.manage",
    group: "admin",
    icon: "👤",
  },
  {
    id: "settings",
    label: "Configuración",
    description: "Impuestos, ticket, impresora, respaldos",
    href: "/admin/config",
    required: "settings.manage",
    group: "admin",
    icon: "⚙️",
  },
];

/** Construye el menú visible para un rol concreto */
export function buildMenuForRole(role: Role): GroupedMenu[] {
  const perms = rolePermissions[role] ?? [];
  return groupItems(filterByPermissions(MENU, perms));
}

/** Construye el menú visible a partir de un usuario (usa permisos efectivos) */
export function buildMenuForUser(user: UserLike): GroupedMenu[] {
  const perms = effectivePermissions(user);
  return groupItems(filterByPermissions(MENU, perms));
}

/** ===== Helpers internos ===== */

/** Filtra ítems por permisos */
function filterByPermissions(items: MenuItem[], perms: readonly Permission[]): MenuItem[] {
  return items.filter((m) => can(perms, m.required));
}

/** Agrupa y ordena según GROUP_ORDER */
function groupItems(items: MenuItem[]): GroupedMenu[] {
  const byGroup = new Map<MenuGroupKey, MenuItem[]>();
  for (const item of items) {
    if (!byGroup.has(item.group)) byGroup.set(item.group, []);
    byGroup.get(item.group)!.push(item);
  }
  return GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => ({
    group: g,
    title: GROUP_TITLES[g],
    items: byGroup.get(g)!,
  }));
}

/** ===== Tips para extender =====
 * 1) Agrega nuevos permisos en `rbac.ts` y asígnalos a los roles.
 * 2) Crea un nuevo item en `MENU` con `id`, `label`, `href`, `required` y `group`.
 * 3) Si necesitas una nueva sección, añade su clave a `MenuGroupKey`,
 *    su label a `GROUP_TITLES` y su posición en `GROUP_ORDER`.
 * 4) Si tu backend envía permisos efectivos por usuario,
 *    usa `buildMenuForUser(user)` para máximo control.
 */
