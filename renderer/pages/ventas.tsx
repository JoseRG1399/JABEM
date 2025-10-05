import { useEffect } from "react";
import { useRouter } from "next/router";
import Ventas from "./ventas/Ventas";

export default function VentasPage() {
  const router = useRouter();

  useEffect(() => {
    const stored = window.localStorage.getItem("jabemUser");
    if (!stored) {
      router.push("/login");
      return;
    }

    const user = JSON.parse(stored);
    if (!["admin", "vendedor"].includes(user.rol)) {
      router.push("/menuPrincipal");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#091B26]">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">Punto de Venta</h1>
          <button
        onClick={() => (window.location.href = "/menuPrincipal")}
        className="mb-4 px-4 py-2 rounded-xl bg-[#038C65] text-white font-semibold shadow hover:bg-[#027857]"
      >
        ← Volver al menú principal
      </button>
        </div>
        <Ventas />
      </div>
    </div>
  );
}
