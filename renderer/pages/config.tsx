import React, { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { useRouter } from "next/router";

export default function ConfiguracionPage() {
		const router = useRouter();
		const [form, setForm] = useState({
		nombre_empresa: "",
		logo: "",
		direccion: "",
		telefono: "",
		rfc: "",
		moneda: "MXN",
	});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	useEffect(() => {
		fetch("/api/config/configuracion")
			.then(res => res.json())
			.then(data => {
				if (data && !data.error) setForm(data);
				setLoading(false);
			})
			.catch(() => {
				setError("Error al cargar configuración");
				setLoading(false);
			});
	}, []);

	function handleInput(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
		setForm({ ...form, [e.target.name]: e.target.value });
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setSuccess(null);
		const res = await fetch("/api/config/configuracion", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(form),
		});
		const data = await res.json();
			if (!res.ok) {
				setError(data.error || "Error al actualizar");
			} else {
				Swal.fire({
					title: "¡Guardado!",
					text: "La configuración ha sido actualizada.",
					icon: "success",
					confirmButtonText: "OK",
				}).then(() => {
					router.push("/menuPrincipal");
				});
			}
	}

		return (
			<div className="min-h-screen bg-[#091B26] flex flex-col p-6">
				<div className="mb-4">
					<button
						onClick={() => window.location.href = "/menuPrincipal"}
						className="px-4 py-2 rounded-xl bg-[#038C65] text-white font-semibold shadow hover:bg-[#027857]"
					>
						← Volver al menú principal
					</button>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<div className="max-w-xl w-full bg-white rounded-xl shadow p-8">
						<h1 className="text-2xl font-bold text-[#038C65] mb-6">Configuración de la tienda</h1>
						{loading ? (
							<p>Cargando...</p>
						) : (
							<form className="space-y-4" onSubmit={handleSubmit}>
												<label className="block text-sm font-medium text-[#038C65] mb-1" htmlFor="nombre_empresa">Nombre de la tienda</label>
												<input
													id="nombre_empresa"
													name="nombre_empresa"
													value={form.nombre_empresa}
													onChange={handleInput}
													placeholder="Nombre de la tienda"
													required
													className="w-full rounded-xl border px-3 py-2 text-black bg-white mb-2"
												/>
												<label className="block text-sm font-medium text-[#038C65] mb-1" htmlFor="direccion">Dirección</label>
												<textarea
													id="direccion"
													name="direccion"
													value={form.direccion}
													onChange={handleInput}
													placeholder="Dirección"
													required
													className="w-full rounded-xl border px-3 py-2 text-black bg-white mb-2"
												/>
												<label className="block text-sm font-medium text-[#038C65] mb-1" htmlFor="telefono">Teléfono</label>
												<input
													id="telefono"
													name="telefono"
													value={form.telefono}
													onChange={handleInput}
													placeholder="Teléfono"
													required
													className="w-full rounded-xl border px-3 py-2 text-black bg-white mb-2"
												/>
												<label className="block text-sm font-medium text-[#038C65] mb-1" htmlFor="rfc">RFC</label>
												<input
													id="rfc"
													name="rfc"
													value={form.rfc}
													onChange={handleInput}
													placeholder="RFC"
													className="w-full rounded-xl border px-3 py-2 text-black bg-white mb-2"
												/>
												<label className="block text-sm font-medium text-[#038C65] mb-1" htmlFor="moneda">Moneda</label>
												<input
													id="moneda"
													name="moneda"
													value={form.moneda}
													onChange={handleInput}
													placeholder="Moneda"
													required
													className="w-full rounded-xl border px-3 py-2 text-black bg-white mb-2"
												/>
								<button
									type="submit"
									className="w-full rounded-xl bg-[#038C65] text-white font-semibold px-4 py-2 mt-2 shadow hover:bg-[#027857]"
								>
									Guardar cambios
								</button>
								{error && <div className="text-red-600 mt-2">{error}</div>}
								{success && <div className="text-green-600 mt-2">{success}</div>}
							</form>
						)}
					</div>
				</div>
			</div>
		);
}
