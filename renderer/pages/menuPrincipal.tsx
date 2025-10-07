import React, { useEffect, useState } from "react";
import apiFetch from "../lib/api";
import { useRouter } from "next/router";
import Image from "next/image";
import Swal from 'sweetalert2';
import { ShoppingCart, Box, Users, BarChart, BookOpenCheck, CopyPlus, PackageOpen, Bolt } from "lucide-react";

// Paleta
const GREEN = "#038C65";
const DARK = "#091B26";

// Opciones (6 como en la imagen)
const opciones = [
    { key: "ventas", label: "Ventas", icon: ShoppingCart, path: "/ventas", roles: ["admin", "vendedor"], highlight: true },
    { key: "gestor-productos", label: "Gestor de productos", icon: CopyPlus, path: "/gestor-productos-menu", roles: ["admin"] },
    { key: "inventario", label: "Inventario", icon: Box, path: "/inventario", roles: ["admin"] },
    //{ key: "recepcion", label: "Recepción", icon: PackageOpen, path: "/recepcion", roles: ["admin"] },
    { key: "reportes", label: "Reportes", icon: BarChart, path: "/reportes", roles: ["admin"] },
    { key: "usuarios", label: "Usuarios", icon: Users, path: "/usuarios", roles: ["admin"] },
   // { key: "cortes", label: "Cortes", icon: BookOpenCheck, path: "/cortes", roles: ["admin", "vendedor"] },
     { key: "configuracion", label: "Configuración", icon: Bolt, path: "/config", roles: ["admin"] },
];



type Usuario = { nombre: string; rol: "admin" | "vendedor" };

export default function MenuPrincipal() {
    const router = useRouter();
    const [user, setUser] = useState<Usuario | null>(null);
    const [store, setStore] = useState<{ nombre_empresa: string; direccion?: string; telefono?: string; } | null>(null);

    useEffect(() => {
        const stored = window.localStorage.getItem("jabemUser");
        if (stored) setUser(JSON.parse(stored));
        else router.push("/login");
        // Obtener datos de la tienda
        (async () => {
            try {
                const resp = await apiFetch('/api/auth/store');
                if (resp.ok) setStore(resp.data);
                else setStore(null);
            } catch (e) {
                setStore(null);
            }
        })();
    }, [router]);

    function handleLogout() {
        window.localStorage.removeItem("jabemUser");
        router.push("/login");
    }

    if (!user) return null;
    // Si no hay datos de la tienda, muestra solo "Menú Principal"

    const visibles = opciones.filter((o) => o.roles.includes(user.rol));

    return (
        <div className="min-h-screen" style={{ backgroundColor: DARK }}>
            {/* Titulo de el menu principal */}
            <div className="flex flex-row items-center justify-between">

                <Image
                    src="/images/logo.png"
                    alt="JABEM logo"
                    width={200}
                    height={100}
                    className="mx-auto rounded-lg"
                    priority
                    onDoubleClick={() => {
                        Swal.fire({
                            title: 'Créditos',
                            html: '<strong>José Ríos</strong> y <strong>Andrés Díaz</strong><br/>Equipo de desarrollo de Jabem software',
                            icon: 'info',
                            confirmButtonText: 'OK'
                        });
                    }}
                />
                <div className="flex flex-row w-3/4 mr-10 bg-white rounded-full border items-center justify-center">
                    <div className="flex-grow">
                        <h1 className="text-2xl font-bold text-[#038C65] mb-2 mt-2 text-center">
                            {store?.nombre_empresa ? store.nombre_empresa : "Menú Principal"}
                        </h1>

                        <p className="mb-2 text-center text-[#091B26]/70">Direccion: {store?.direccion} Teléfono: {store?.telefono} </p>
                        <p className="mb-6 text-center text-[#091B26]/70"> Usuario: <span className="font-semibold">{user.nombre}</span> ({user.rol}) </p>
                    </div>

                </div>
            </div>
            <div className="mx-auto max-w-6xl px-6 py-10">
                {/* Grid 3x2 como en la referencia */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {visibles.map((opt) => {
                        const isHighlight = Boolean(opt.highlight); // Ventas destacado
                        const base =
                            "aspect-square rounded-xl border shadow-md transition-all select-none flex items-center justify-center";
                        const normal =
                            "bg-white text-[#0b3a32] border-white/20 hover:-translate-y-0.5 hover:shadow-lg";
                        const active =
                            "bg-[var(--tile-green)] text-white border-[var(--tile-green)] hover:brightness-105";
                        return (
                            <button
                                key={opt.key}
                                onClick={() => router.push(opt.path)}
                                className={`${base} ${isHighlight ? active : normal} focus:outline-none focus:ring-4 focus:ring-white/10`}
                                style={{ ["--tile-green" as any]: GREEN }}
                            >
                                <div className="flex flex-col items-center gap-3">
                                    {opt.icon && <opt.icon className="h-6 w-6" />}
                                    {/* Label */}
                                    <span className="text-lg font-semibold tracking-tight">
                                        {opt.label}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Cerrar sesión (abajo) */}
                <div className="mt-8 flex justify-end">
                    <button
                        onClick={handleLogout}
                        className="px-4 py-2 rounded-lg bg-white/5 text-white/90 hover:bg-white/10 border border-white/10"
                    >
                        Cerrar sesión
                    </button>
                </div>
            </div>
        </div>
    );
}
