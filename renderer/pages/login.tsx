import React from "react";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";

export default function HomePage() {
  const [showPassword, setShowPassword] = React.useState(false);
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [usuario, setUsuario] = React.useState("");
  const [password, setPassword] = React.useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error de autenticación");
      } else {
        setError(null);
        // Guardar usuario en localStorage
        window.localStorage.setItem("jabemUser", JSON.stringify(data));
        // Redirigir al menú principal
        router.push("/menuPrincipal");
      }
    } catch (err) {
      setError("Error de red o servidor");
    }
    setLoading(false);
  }

  return (
    <React.Fragment>
      <Head>
        <title>JABEM — Iniciar sesión</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* App background */}
      <div className="min-h-screen w-full bg-[#091B26] flex items-center justify-center p-4">
        {/* Card */}
        <div className="w-full max-w-md bg-white/85 rounded-2xl shadow-xl shadow-black/40 border border-[#038C65]/20">
          {/* Header / Branding */}
          <div className="px-8 pt-8 pb-4 text-center">
            <div className="mx-auto mb-3">
              <Image
                src="/images/icono.png"
                alt="JABEM logo"
                width={100}
                height={100}
                className="mx-auto rounded-lg"
                priority
              />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#000000]">
              Bienvenido
            </h1>
            <p className="mt-1 text-sm text-[#000000]/70">Inicia sesión para continuar</p>
          </div>

          {/* Form */}
          <form className="px-8 pb-8" onSubmit={handleLogin}>
            {/* User */}
            <label className="block text-sm font-medium text-[#000000]" htmlFor="usuario">
              Usuario
            </label>
            <input
              id="usuario"
              name="usuario"
              type="text"
              placeholder="Pecas"
              required
              value={usuario}
              onChange={e => setUsuario(e.target.value)}
              className="mt-1 w-full rounded-xl bg-[#091B26]/40 text-[#F2F0EB] placeholder:text-[#F2F0EB]/40 border border-[#038C65]/30 focus:border-[#038C65] focus:ring-4 focus:ring-[#038C65]/20 outline-none px-4 py-3"
            />

            {/* Password */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-[#000000]" htmlFor="password">
                Ingresa tu clave para continuar
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-xl bg-[#091B26]/40 text-[#000000] placeholder:text-[#F2F0EB]/40 border border-[#038C65]/30 focus:border-[#038C65] focus:ring-4 focus:ring-[#038C65]/20 outline-none px-4 py-3 pr-14"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-2 my-1 px-3 rounded-lg text-xs font-medium bg-[#091B26]/60 text-[#F2F0EB]/80 hover:text-[#F2F0EB] hover:bg-[#091B26]/80 border border-[#038C65]/30"
                >
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mt-4 text-center text-red-600 text-sm font-medium">{error}</div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#038C65] hover:bg-[#038C5A] text-[#F2F0EB] font-semibold px-4 py-3 shadow-lg shadow-black/30 focus:outline-none focus:ring-4 focus:ring-[#038C65]/30"
            >
              {loading ? "Ingresando..." : "Iniciar sesión"}
            </button>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#038C65]/20" />
              <span className="text-xs uppercase tracking-widest text-[#000000]/50">o</span>
              <div className="h-px flex-1 bg-[#038C65]/20" />
            </div>

            {/* Footer */}
            <p className="mt-6 text-xs text-center text-[#000000]/50">
              © {new Date().getFullYear()} JABEM. Todos los derechos reservados.
            </p>
          </form>
        </div>
      </div>
    </React.Fragment>
  );
}
