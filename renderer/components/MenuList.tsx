// renderer/components/MenuList.tsx
// Lista de menú agrupada con buscador (usa Tailwind y tu paleta JABEM)

import Link from "next/link";
import * as React from "react";
import type { GroupedMenu } from "../lib/menu";

export function MenuList({ groups }: { groups: GroupedMenu[] }) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (i) =>
            i.label.toLowerCase().includes(q) ||
            i.description?.toLowerCase().includes(q) ||
            i.href.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);

  return (
    <div className="w-full">
      {/* 🔍 Search */}
      <div className="mb-5">
        <label className="sr-only" htmlFor="menu-search">Buscar</label>
        <input
          id="menu-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar opción (ej. inventario, reporte)"
          className="w-full rounded-xl bg-[#091B26]/40 text-[#F2F0EB] placeholder:text-[#F2F0EB]/40 border border-[#038C65]/30 focus:border-[#038C65] focus:ring-4 focus:ring-[#038C65]/20 outline-none px-4 py-3"
        />
      </div>

      {filtered.map((group) => (
        <div key={group.group} className="mb-6">
          <h2 className="text-sm font-semibold tracking-wide text-white mb-2">
            {group.title}
          </h2>
          <ul className="divide-y divide-[#038C65]/15 rounded-2xl overflow-hidden border border-[#038C65]/20 bg-[#f5f5f5]/50">
            {group.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-start gap-3 p-4 hover:bg-[#091B26]/40 focus:bg-[#091B26]/40 focus:outline-none"
                >
                  <div className="text-xl leading-none select-none w-6 text-center">
                    {item.icon ?? "•"}
                  </div>
                  <div className="flex-1">
                    <div className="text-[#F2F0EB] font-medium">
                      {item.label}
                    </div>
                    {item.description && (
                      <div className="text-[#F2F0EB]/60 text-sm">
                        {item.description}
                      </div>
                    )}
                    <div className="mt-1 text-[#F2F0EB]/30 text-xs">
                      {item.href}
                    </div>
                  </div>
                  <div className="self-center text-xs text-[#F2F0EB]/40">↗</div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="text-center text-[#F2F0EB]/50 py-8 border border-dashed border-[#038C65]/30 rounded-xl">
          Sin resultados. Ajusta tu búsqueda.
        </div>
      )}
    </div>
  );
}
