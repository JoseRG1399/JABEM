// renderer/pages/dashboard.tsx
// Vista del menú principal post-login (filtra por permisos y usa tu paleta JABEM)

import * as React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { buildMenuForUser } from "../lib/menu";
import type { UserLike } from "../lib/rbac";
import { MenuList } from "../components/MenuList";

function getStoredUser(): UserLike | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("jabem:user");
    if (!raw) return null;
    return JSON.parse(raw) as UserLike;
  } catch {
    return null;
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = React.useState<UserLike | null>(null);

  React.useEffect(() => {
    const u = getStoredUser();
    if (!u) {
      router.replace("/"); // si no hay sesión, regresa al login
      return;
    }
    setUser(u);
  }, [router]);

  if (!user) {
    // Loader sutil mientras resolvemos sesión/redirección
    return (
      <div className="min-h-screen w-full bg-[#091B26] grid place-items-center">
        <div className="text-[#F2F0EB]/70">Cargando…</div>
      </div>
    );
  }

  const groups = buildMenuForUser(user);

  return (
    <>
      <Head>
        <title>JABEM — Menú principal</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen w-full bg-[#091B26] text-[#F2F0EB]">
        {/* Topbar */}
        <header className="sticky top-0 z-10 bg-[#01261C]/90 backdrop-blur border-b border-[#038C65]/20">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="font-semibold tracking-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#038C65] to-[#038C5A]">
                JABEM
              </span>
            </div>
            <div className="text-sm text-[#F2F0EB]/80">
              {user.nombre ?? user.usuario ?? "Usuario"} ·{" "}
              <span className="uppercase">{user.rol}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-5xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-semibold mb-1">Menú principal</h1>
          <p className="text-[#F2F0EB]/70 mb-6">
            Selecciona una opción para continuar.
          </p>

          <MenuList groups={groups} />
        </main>
      </div>
    </>
  );
}
