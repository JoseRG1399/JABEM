import React, { useEffect, useMemo, useState } from "react";
import { apiCall } from "../lib/api";

// Tipos (ajusta si tu API devuelve otros campos)
interface Usuario {
    id: number;
    nombre: string;
    usuario: string;
    rol: "admin" | "vendedor" | string;
    activo?: boolean;
}

export default function UsuariosPage() {
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        nombre: "",
        usuario: "",
        password: "",
        rol: "vendedor",
    });
    const [formError, setFormError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    // UI local
    const [search, setSearch] = useState("");
    const [filterRol, setFilterRol] = useState<string>("todos");
    const [page, setPage] = useState(1);
    const pageSize = 8;
    useEffect(() => {
        cargarUsuarios();
    }, []);

    async function cargarUsuarios() {
        try {
            setLoading(true);
            setError(null);
            const data = await apiCall<Usuario[]>("/api/usuarios/listar", { method: "GET" });
            setUsuarios(data || []);
        } catch (e) {
            setError("Error al cargar usuarios");
        } finally {
            setLoading(false);
        }
    }

    function handleInput(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setFormError(null);
        setCreating(true);
        try {
            await apiCall("/api/usuarios/crear", { method: "POST", body: form });

            setForm({ nombre: "", usuario: "", password: "", rol: "vendedor" });
            await cargarUsuarios();
        } catch (err: any) {
            setFormError(err.message || "Error al crear usuario");
        } finally {
            setCreating(false);
        }
    }

    async function handleDelete(id: number) {
        const u = usuarios.find((x) => x.id === id);
        if (!u) return;

        const confirmar = window.confirm(`¿Eliminar a "${u.nombre}"? Esta acción no se puede deshacer.`);
        if (!confirmar) return;

        // Optimista
        const backup = [...usuarios];
        setUsuarios((prev) => prev.filter((x) => x.id !== id));

        try {
            await apiCall("/api/usuarios/eliminar", { method: "DELETE", body: { id } });
        } catch (e) {
            // revertir si falla
            setUsuarios(backup);
            alert("Error al eliminar usuario");
        }
    }

    // Derivados (búsqueda + filtro + paginación)
    const filtrados = useMemo(() => {
        const q = search.trim().toLowerCase();
        const base = usuarios.filter((u) => {
            const matchQuery = q
                ? `${u.nombre} ${u.usuario} ${u.rol}`.toLowerCase().includes(q)
                : true;
            const matchRol = filterRol === "todos" ? true : u.rol === filterRol;
            return matchQuery && matchRol;
        });

        // Ordenar por nombre asc
        base.sort((a, b) => a.nombre.localeCompare(b.nombre));
        return base;
    }, [usuarios, search, filterRol]);

    const totalPages = Math.max(1, Math.ceil(filtrados.length / pageSize));
    const pageSafe = Math.min(page, totalPages);
    const pageData = useMemo(
        () => filtrados.slice((pageSafe - 1) * pageSize, pageSafe * pageSize),
        [filtrados, pageSafe]
    );

    // Resetear página al cambiar filtros
    useEffect(() => {
        setPage(1);
    }, [search, filterRol]);

    return (
        <div className="min-h-screen bg-[#091B26] p-6 sm:p-8 text-neutral-900">
            <div className="mx-auto max-w-6xl space-y-6">
                <button
                    onClick={() => window.location.href = "/menuPrincipal"}
                    className="mb-4 px-4 py-2 rounded-xl bg-[#038C65] text-white font-semibold shadow hover:bg-[#027857]"
                >
                    ← Volver al menú principal
                </button>
                <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-[#038C65] tracking-tight">Gestión de usuarios</h1>
                        <p className="text-sm !text-white">
                            Administra el acceso al sistema. Crea, busca y elimina usuarios.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <div className="rounded-xl border bg-white px-4 py-2 text-center shadow-sm">
                            <div className="!text-sm !text-neutral-900">Total</div>
                            <div className="!text-lg !font-semibold !text-neutral-900">{usuarios.length}</div>
                        </div>
                        <div className="rounded-xl border bg-white px-4 py-2 text-center shadow-sm">
                            <div className="!text-sm text-neutral-900">Mostrando</div>
                            <div className="!text-lg font-semibold !text-neutral-900">{filtrados.length}</div>
                        </div>
                    </div>
                </header>

                {/* Panel de acciones y formulario */}
                <section className="grid gap-6 lg:grid-cols-3">
                    {/* Crear usuario */}
                    <div className="lg:col-span-1 rounded-2xl border bg-white p-5 shadow-sm">
                        <h2 className="mb-4 text-base font-semibold text-neutral-800">Crear usuario</h2>
                        <form className="grid grid-cols-1 gap-3" onSubmit={handleCreate}>
                            <input
                                name="nombre"
                                value={form.nombre}
                                onChange={handleInput}
                                placeholder="Nombre"
                                required
                                className="rounded-xl border px-3 py-2 outline-none ring-0 focus:border-[#038C65]/50 focus:ring-2 focus:ring-[#038C65]/20 text-black bg-white"
                            />
                            <input
                                name="usuario"
                                value={form.usuario}
                                onChange={handleInput}
                                placeholder="Usuario"
                                required
                                className="rounded-xl border px-3 py-2 outline-none ring-0 focus:border-[#038C65]/50 focus:ring-2 focus:ring-[#038C65]/20 text-black bg-white"
                            />
                            <input
                                name="password"
                                value={form.password}
                                onChange={handleInput}
                                placeholder="Contraseña"
                                type="password"
                                required
                                className="rounded-xl border px-3 py-2 outline-none ring-0 focus:border-[#038C65]/50 focus:ring-2 focus:ring-[#038C65]/20 text-black bg-white"
                            />
                            <select
                                name="rol"
                                value={form.rol}
                                onChange={handleInput}
                                className="rounded-xl border px-3 py-2 outline-none ring-0 focus:border-[#038C65]/50 focus:ring-2 focus:ring-[#038C65]/20 text-black bg-white"
                            >
                                <option value="admin">Admin</option>
                                <option value="vendedor">Vendedor</option>
                            </select>
                            <button
                                type="submit"
                                disabled={creating}
                                className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#038C65] px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-[#027857] disabled:opacity-60"
                            >
                                {/* Icono plus */}
                                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1z" /></svg>
                                {creating ? "Creando..." : "Crear usuario"}
                            </button>
                            {formError && <div className="text-sm text-red-600">{formError}</div>}
                        </form>
                    </div>

                    {/* Filtros y tabla */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="rounded-2xl border bg-white p-4 shadow-sm">
                            <div className="grid gap-3 sm:grid-cols-3">
                                <div className="sm:col-span-2">
                                    <div className="relative">
                                        <input
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Buscar por nombre, usuario o rol..."
                                            className="w-full rounded-xl border px-3 py-2 pl-9 outline-none ring-0 focus:border-[#038C65]/50 focus:ring-2 focus:ring-[#038C65]/20 text-black bg-white"
                                        />
                                        {/* ícono lupa */}
                                        <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-2.5 top-2.5 h-5 w-5 text-neutral-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                    </div>
                                </div>
                                <div>
                                    <select
                                        value={filterRol}
                                        onChange={(e) => setFilterRol(e.target.value)}
                                        className="w-full rounded-xl border px-3 py-2 outline-none ring-0 focus:border-[#038C65]/50 focus:ring-2 focus:ring-[#038C65]/20 text-black bg-white"
                                    >
                                        <option value="todos">Todos los roles</option>
                                        <option value="admin">Admin</option>
                                        <option value="vendedor">Vendedor</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                            {/* Tabla */}
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-left text-sm text-black">
                                    <thead>
                                        <tr className="bg-[#038C65]/10 text-[#045b45]">
                                            <th className="px-4 py-3 font-semibold">#</th>
                                            <th className="px-4 py-3 font-semibold">Nombre</th>
                                            <th className="px-4 py-3 font-semibold">Usuario</th>
                                            <th className="px-4 py-3 font-semibold">Rol</th>
                                            <th className="px-4 py-3 font-semibold">Activo</th>
                                            <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {loading && (
                                            [...Array(6)].map((_, i) => (
                                                <tr key={`skeleton-${i}`} className="animate-pulse">
                                                    <td className="px-4 py-3"><div className="h-4 w-6 rounded bg-neutral-200" /></td>
                                                    <td className="px-4 py-3"><div className="h-4 w-40 rounded bg-neutral-200" /></td>
                                                    <td className="px-4 py-3"><div className="h-4 w-32 rounded bg-neutral-200" /></td>
                                                    <td className="px-4 py-3"><div className="h-6 w-20 rounded-full bg-neutral-200" /></td>
                                                    <td className="px-4 py-3"><div className="h-6 w-12 rounded-full bg-neutral-200" /></td>
                                                    <td className="px-4 py-3 text-right"><div className="ml-auto h-8 w-24 rounded bg-neutral-200" /></td>
                                                </tr>
                                            ))
                                        )}

                                        {!loading && pageData.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-10 text-center text-neutral-500">
                                                    No se encontraron usuarios con los filtros aplicados.
                                                </td>
                                            </tr>
                                        )}

                                        {!loading && pageData.map((u) => (
                                            <tr key={u.id} className="hover:bg-neutral-50">
                                                <td className="px-4 py-3 text-neutral-500">{u.id}</td>
                                                <td className="px-4 py-3 font-medium text-neutral-800">{u.nombre}</td>
                                                <td className="px-4 py-3 text-neutral-700">{u.usuario}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${u.rol === "admin"
                                                        ? "bg-emerald-100 text-emerald-700"
                                                        : "bg-sky-100 text-sky-700"
                                                        }`}>
                                                        {/* punto */}
                                                        <span className="h-2 w-2 rounded-full bg-current"></span>
                                                        {u.rol}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${u.activo === false
                                                        ? "bg-neutral-200 text-neutral-600"
                                                        : "bg-green-100 text-green-700"
                                                        }`}>
                                                        <span className={`h-1.5 w-1.5 rounded-full ${u.activo === false ? "bg-neutral-500" : "bg-green-600"}`}></span>
                                                        {u.activo === false ? "No" : "Sí"}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => handleDelete(u.id)}
                                                            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                                                            title="Eliminar"
                                                        >
                                                            {/* ícono papelera */}
                                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
                                                            <span className="hidden sm:inline">Eliminar</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Paginación */}
                            {!loading && filtrados.length > pageSize && (
                                <div className="flex items-center justify-between border-t px-4 py-3">
                                    <div className="text-sm text-neutral-600">
                                        Página <span className="font-semibold">{pageSafe}</span> de {totalPages}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                                            disabled={pageSafe === 1}
                                            className="rounded-lg border px-3 py-1.5 text-sm font-medium text-neutral-700 disabled:opacity-50"
                                        >
                                            Anterior
                                        </button>
                                        <button
                                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                            disabled={pageSafe === totalPages}
                                            className="rounded-lg border px-3 py-1.5 text-sm font-medium text-neutral-700 disabled:opacity-50"
                                        >
                                            Siguiente
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Mensajes de error */}
                        {error && (
                            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                                {error}
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
