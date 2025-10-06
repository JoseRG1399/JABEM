import { useState, useEffect, useRef } from "react";
import apiFetch from "../../lib/api";
import Ticket from "../../components/Ticket";
import Swal from "sweetalert2";
import { ShoppingCart, Trash2, Plus, Minus, DollarSign, Percent, Weight, Package, Search } from "lucide-react";

interface Producto {
  id: number;
  nombre: string;
  descripcion: string;
  categoria: any;
  presentaciones: Presentacion[];
  unidad_base: string;
  stock_actual: number;
}

interface Presentacion {
  id: number;
  nombre: string;
  precio_unitario: number;
  unidad: string;
  factor_a_base: number;
  es_default?: boolean;
}

interface CartItem {
  producto: Producto;
  presentacion: Presentacion;
  cantidad: number;
  subtotal: number;
  precioBase?: number; // Para ventas por peso
  esVentaPorPeso?: boolean;
}

export default function Ventas() {
  // Estados para el formulario
  const [selectedProduct, setSelectedProduct] = useState<number | "">("");
  const [selectedPresentation, setSelectedPresentation] = useState<number | "">("");
  const [quantity, setQuantity] = useState(1);
  const [ventaPorPeso, setVentaPorPeso] = useState(false);
  const [pesoKg, setPesoKg] = useState(0);
  const [modoPorDinero, setModoPorDinero] = useState(false); // true = por dinero, false = por peso
  const [cantidadDinero, setCantidadDinero] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);

  // Estados principales
  const [productsList, setProductsList] = useState<Producto[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [descuentoPorcentaje, setDescuentoPorcentaje] = useState(0);
  const [lastSale, setLastSale] = useState<any>(null);
  const [isTicketOpen, setIsTicketOpen] = useState(false);
  const [empresa, setEmpresa] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Obtener usuario del localStorage
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("jabemUser");
    if (stored) {
      setUser(JSON.parse(stored));
    }
    loadProducts();
    loadEmpresa();
  }, []);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const loadProducts = async () => {
    try {
      const resp = await apiFetch<Producto[]>("/api/sales/productos");
      if (resp.ok) {
        setProductsList(resp.data || []);
      } else {
        throw new Error(resp.error || "Error cargando productos");
      }
    } catch (error) {
      console.error("Error loading products:", error);
      Swal.fire("Error", "No se pudieron cargar los productos", "error");
    }
  };

  const loadEmpresa = async () => {
    try {
      const resp = await apiFetch<any>("/api/config/configuracion");
      if (resp.ok) {
        setEmpresa(resp.data);
      } else {
        console.warn("No se pudo cargar la configuración de la empresa:", resp.error);
      }
    } catch (error) {
      console.error("Error loading empresa:", error);
    }
  };

  const selectedProductData = productsList.find((p) => p.id === selectedProduct);
  // Filtrar presentaciones para excluir "Kg suelto" solo si el producto tiene venta por peso disponible
  const availablePresentations = selectedProductData?.presentaciones.filter((p) => {
    // Para productos que NO son de unidad base "kg", mantener todas las presentaciones
    if (selectedProductData.unidad_base !== "kg") {
      return true;
    }
    // Para productos de unidad base "kg", excluir "kg suelto" solo si hay venta por peso
    return p.nombre.toLowerCase() !== "kg suelto";
  }) || [];

  // Filtrar productos según el término de búsqueda
  const filteredProducts = productsList.filter((producto) => {
    const searchLower = searchTerm.toLowerCase();
    const nombreMatch = producto.nombre.toLowerCase().includes(searchLower);
    const categoriaMatch = producto.categoria?.nombre?.toLowerCase().includes(searchLower) || false;
    return nombreMatch || categoriaMatch;
  });

  // Función para seleccionar un producto
  const selectProduct = (producto: Producto) => {
    setSelectedProduct(producto.id);
    setSearchTerm(`${producto.nombre} - ${producto.categoria?.nombre || ''}`);
    setShowDropdown(false);
    setSelectedIndex(-1);

    // Si el producto NO es por kg y tiene una presentación llamada "pieza" (o similar), autoseleccionarla
    try {
      if (producto.unidad_base !== 'kg' && Array.isArray(producto.presentaciones)) {
        const pieza = producto.presentaciones.find(p => p.nombre.toLowerCase() === 'pieza' || p.nombre.toLowerCase() === 'pza' || p.nombre.toLowerCase() === 'unidad');
        if (pieza) {
          setSelectedPresentation(pieza.id);
          // Enfocar input de cantidad si existe
          try { quantityInputRef?.current?.focus(); } catch (e) {}
          return;
        }
      }
      // Si no hay 'pieza', limpiar la presentación para que el usuario la elija
      setSelectedPresentation("");
    } catch (err) {
      setSelectedPresentation("");
    }
  };

  // Ref para enfocar el input de cantidad
  const quantityInputRef = useRef<HTMLInputElement | null>(null);

  // Manejar navegación con teclado
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || filteredProducts.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredProducts.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < filteredProducts.length) {
          selectProduct(filteredProducts[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Obtener precio base por kg del producto (busca "Kg suelto" o presentación base en kg)
  const getPrecioBaseKg = (producto: Producto) => {
    // Primero buscar presentación base en kg (factor 1:1)
    let presentacionBase = producto.presentaciones.find(
      (p) => p.unidad === "kg" && Number(p.factor_a_base) === 1
    );

    // Si no existe, buscar cualquier presentación en kg marcada como default
    if (!presentacionBase) {
      presentacionBase = producto.presentaciones.find(
        (p) => p.unidad === "kg" && p.es_default
      );
    }

    // Si aún no existe, buscar la primera presentación en kg
    if (!presentacionBase) {
      presentacionBase = producto.presentaciones.find((p) => p.unidad === "kg");
    }

    return presentacionBase ? Number(presentacionBase.precio_unitario) : 0;
  };

  // Obtener la presentación base en kg para usar en ventas por peso
  const getPresentacionBaseKg = (producto: Producto) => {
    let presentacionBase = producto.presentaciones.find(
      (p) => p.unidad === "kg" && Number(p.factor_a_base) === 1
    );

    if (!presentacionBase) {
      presentacionBase = producto.presentaciones.find(
        (p) => p.unidad === "kg" && p.es_default
      );
    }

    if (!presentacionBase) {
      presentacionBase = producto.presentaciones.find((p) => p.unidad === "kg");
    }

    return presentacionBase;
  };

  const addToCart = () => {
    if (!selectedProduct) {
      Swal.fire("Atención", "Selecciona un producto", "warning");
      return;
    }

    const producto = productsList.find((p) => p.id === selectedProduct);
    if (!producto) return;

    // Venta por peso (kg)
    if (ventaPorPeso) {
      if (pesoKg <= 0) {
        Swal.fire("Atención", "Ingresa un peso válido en kilogramos", "warning");
        return;
      }

      const precioBaseKg = getPrecioBaseKg(producto);
      if (precioBaseKg === 0) {
        Swal.fire({
          icon: "error",
          title: "Producto sin precio por kg",
          html: `
            <p>Este producto no tiene una presentación en kilogramos.</p>
            <p class="text-sm text-gray-600 mt-2">Asegúrate de que el producto tenga una presentación "Kg suelto" con precio definido.</p>
          `,
        });
        return;
      }

      // Obtener presentación base en kg
      const presentacionKg = getPresentacionBaseKg(producto);

      if (!presentacionKg) {
        Swal.fire("Error", "No se encontró presentación en kg para este producto", "error");
        return;
      }

      const subtotal = precioBaseKg * pesoKg;

      setCart([
        ...cart,
        {
          producto,
          presentacion: presentacionKg,
          cantidad: pesoKg,
          subtotal,
          precioBase: precioBaseKg,
          esVentaPorPeso: true,
        },
      ]);

      // Reset inputs so user can search another product immediately
      setPesoKg(0);
      setCantidadDinero(0);
      setSelectedProduct("");
      setSearchTerm("");
      setSelectedPresentation("");
      setShowDropdown(false);
      setSelectedIndex(-1);
      // Desactivar venta por peso para la siguiente operación
      setVentaPorPeso(false);
      return;
    }

    // Venta por presentación normal
    if (!selectedPresentation || quantity <= 0) {
      Swal.fire("Atención", "Selecciona una presentación y cantidad válida", "warning");
      return;
    }

    const presentacion = producto?.presentaciones.find((pr) => pr.id === selectedPresentation);
    if (!presentacion) {
      Swal.fire("Error", "No se encontró la presentación seleccionada", "error");
      return;
    }

    try {
      // Debug: Verificar valores antes del cálculo
      console.log("🔍 Datos de presentación:", {
        producto: producto.nombre,
        presentacion: presentacion.nombre,
        precio_unitario: presentacion.precio_unitario,
        tipo_precio: typeof presentacion.precio_unitario,
        cantidad: quantity,
        unidad: presentacion.unidad
      });

      const precioNumerico = validatePrice(presentacion.precio_unitario, `presentación ${presentacion.nombre}`);
      const cantidadNumerica = Number(quantity);

      if (isNaN(cantidadNumerica) || cantidadNumerica <= 0) {
        Swal.fire("Error", "La cantidad no es válida", "error");
        return;
      }

      const subtotal = precioNumerico * cantidadNumerica;

      // Debug: Verificar cálculo
      console.log("🧮 Cálculo exitoso:", {
        precio: precioNumerico,
        cantidad: cantidadNumerica,
        subtotal: subtotal,
        subtotal_formateado: formatCurrency(subtotal)
      });
      
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error en el precio",
        html: `
          <p>El precio de la presentación "${presentacion.nombre}" no es válido.</p>
          <p class="text-sm text-gray-600 mt-2">Valor recibido: ${presentacion.precio_unitario}</p>
          <p class="text-sm text-gray-600">Error: ${error.message}</p>
        `,
      });
      return;
    }

    const subtotal = validatePrice(presentacion.precio_unitario, `presentación ${presentacion.nombre}`) * quantity;

    const existingIndex = cart.findIndex(
      (item) => item.presentacion.id === selectedPresentation && !item.esVentaPorPeso
    );

    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].cantidad += quantity;
      newCart[existingIndex].subtotal += subtotal;
      setCart(newCart);
    } else {
      setCart([
        ...cart,
        {
          producto,
          presentacion,
          cantidad: quantity,
          subtotal,
          esVentaPorPeso: false,
        },
      ]);
    }

    // Reset form
    // Reset inputs so user can search another product immediately
    setSelectedProduct("");
    setSearchTerm("");
    setSelectedPresentation("");
    setQuantity(1);
    setCantidadDinero(0);
    setShowDropdown(false);
    setSelectedIndex(-1);
    // Desactivar venta por peso para la siguiente operación
    setVentaPorPeso(false);
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const updateQuantity = (index: number, delta: number) => {
    const newCart = [...cart];
    const item = newCart[index];
    const newQuantity = item.cantidad + delta;

    if (newQuantity <= 0) {
      removeFromCart(index);
      return;
    }

    const precioUnitario = Number(item.presentacion.precio_unitario);
    
    // Validación de seguridad
    if (isNaN(precioUnitario)) {
      console.error("❌ Precio unitario inválido al actualizar cantidad:", item.presentacion.precio_unitario);
      Swal.fire("Error", "Error al actualizar la cantidad. Precio inválido.", "error");
      return;
    }

    newCart[index].cantidad = newQuantity;
    newCart[index].subtotal = newQuantity * precioUnitario;
    
    // Debug
    console.log("🔄 Cantidad actualizada:", {
      producto: item.producto.nombre,
      presentacion: item.presentacion.nombre,
      cantidad_anterior: item.cantidad,
      cantidad_nueva: newQuantity,
      precio_unitario: precioUnitario,
      subtotal_nuevo: newCart[index].subtotal
    });
    
    setCart(newCart);
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + item.subtotal, 0);
  };

  const calculateDescuento = () => {
    return (calculateSubtotal() * descuentoPorcentaje) / 100;
  };

  const calculateTotal = () => {
    return calculateSubtotal() - calculateDescuento();
  };

  const handleFinalizeSale = async () => {
    if (cart.length === 0) {
      Swal.fire("Atención", "El carrito está vacío", "warning");
      return;
    }

    if (!user) {
      Swal.fire("Error", "No hay usuario autenticado", "error");
      return;
    }

    const result = await Swal.fire({
      title: "Confirmar Venta",
      html: `
        <div class="text-left">
          ${descuentoPorcentaje > 0 ? `<p class="mb-2 text-center"><strong>Subtotal:</strong> ${formatCurrency(calculateSubtotal())}</p>` : ''}
          ${descuentoPorcentaje > 0 ? `<p class="mb-2 text-center"><strong>Descuento (${descuentoPorcentaje}%):</strong> -${formatCurrency(calculateDescuento())}</p>` : ''}
          <p class="mb-2 text-lg text-center"><strong>Total:</strong> ${formatCurrency(calculateTotal())}</p>
          <p class="mb-2 text-center"><strong>Método de Pago:</strong> Efectivo</p>
          <p class="text-normal text-gray-600 text-center">¿Deseas procesar esta venta?</p>
        </div>
      `,
      icon: "question",
      iconColor: "#038C65",
      showCancelButton: true,
      theme: "borderless",
      confirmButtonText: "Sí, procesar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#038C65",
    });

    if (!result.isConfirmed) return;

    setLoading(true);

    try {
      const saleData = {
        usuario_id: user.id,
        metodo_pago: "efectivo",
        descuento_porcentaje: descuentoPorcentaje,
        items: cart.map((item) => ({
          presentacion_id: item.presentacion.id,
          cantidad: item.cantidad,
        })),
      };

      const resp = await apiFetch<any>("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saleData),
      });

      if (!resp.ok) {
        throw new Error(resp.error || "Error al procesar la venta");
      }

      const sale = resp.data;
      setLastSale(sale);
      setCart([]);
      setDescuentoPorcentaje(0);
      setIsTicketOpen(true);

      // Mostrar mensaje de éxito y luego imprimir automáticamente
      await Swal.fire({
        title: "¡Venta Exitosa!",
        text: `Venta #${sale.id} procesada correctamente`,
        icon: "success",
        confirmButtonColor: "#038C65",
        timer: 1500,
        showConfirmButton: false,
      });

      // Recargar productos para actualizar stock
      loadProducts();
    } catch (error: any) {
      console.error("Error processing sale:", error);
      Swal.fire("Error", error.message || "No se pudo procesar la venta", "error");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  // Función auxiliar para validar y convertir precios
  const validatePrice = (price: any, context: string): number => {
    const numericPrice = Number(price);
    
    if (isNaN(numericPrice)) {
      console.error(`❌ Precio inválido en ${context}:`, price);
      throw new Error(`Precio inválido: ${price}`);
    }
    
    if (numericPrice < 0) {
      console.error(`❌ Precio negativo en ${context}:`, price);
      throw new Error(`El precio no puede ser negativo: ${price}`);
    }
    
    return numericPrice;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Panel de selección de productos */}
      <div className="lg:col-span-2 space-y-6">
        {/* Card principal de productos */}
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-xl p-6 border border-gray-200">
          <h2 className="text-2xl font-bold text-[#091B26] mb-6 flex items-center gap-3">
            <div className="p-2 bg-[#038C65] rounded-lg">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
            Agregar Productos
          </h2>

          <div className="space-y-5">
            {/* Buscador de producto */}
            <div className="relative" ref={searchRef}>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Buscar Producto
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowDropdown(true);
                    setSelectedIndex(-1);
                    if (!e.target.value) {
                      setSelectedProduct("");
                      setSelectedPresentation("");
                    }
                  }}
                  onFocus={() => setShowDropdown(true)}
                  onKeyDown={handleKeyDown}
                  placeholder="Busca por nombre o categoría..."
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#038C65] focus:border-[#038C65] transition-all bg-white"
                  autoComplete="off"
                />
                {selectedProduct && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProduct("");
                      setSearchTerm("");
                      setSelectedPresentation("");
                      setShowDropdown(false);
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Dropdown de resultados */}
              {showDropdown && searchTerm && filteredProducts.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                  {filteredProducts.map((producto, index) => (
                    <button
                      key={producto.id}
                      type="button"
                      onClick={() => selectProduct(producto)}
                      className={`w-full text-left px-4 py-3 transition-colors border-b border-gray-200 last:border-b-0 ${index === selectedIndex
                          ? "bg-[#038C65] text-white"
                          : "hover:bg-[#038C65] hover:text-white"
                        }`}
                    >
                      <div className="font-semibold">{producto.nombre}</div>
                      <div className={`text-xs ${index === selectedIndex ? "text-white" : "text-gray-500"
                        }`}>
                        {producto.categoria?.nombre || 'Sin categoría'}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {showDropdown && searchTerm && filteredProducts.length === 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-300 rounded-xl shadow-lg p-4 text-center text-gray-500">
                  No se encontraron productos
                </div>
              )}
            </div>

            {/* Toggle: Venta por peso o presentación */}
            {selectedProduct && selectedProductData?.unidad_base === "kg" && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <Weight className="w-5 h-5 text-blue-600" />
                    Vender por peso (tanto)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setVentaPorPeso(!ventaPorPeso);
                      setSelectedPresentation("");
                      setPesoKg(0);
                      setCantidadDinero(0);
                      setModoPorDinero(false);
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${ventaPorPeso ? "bg-[#038C65]" : "bg-gray-300"
                      }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${ventaPorPeso ? "translate-x-6" : "translate-x-1"
                        }`}
                    />
                  </button>
                </div>

                {/* Mostrar toggle de Peso/Dinero cuando está activo */}
                {ventaPorPeso && (
                  <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-3 mb-3">
                    <div className="flex items-center justify-center gap-3">
                      <div className={`flex items-center gap-2 transition-all ${!modoPorDinero ? "text-[#038C65] font-bold" : "text-gray-500"
                        }`}>
                        <Weight className="w-4 h-4" />
                        <span className="text-xs font-semibold">Peso</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setModoPorDinero(!modoPorDinero);
                          setPesoKg(0);
                          setCantidadDinero(0);
                        }}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${modoPorDinero ? "bg-gray-300" : "bg-[#038C65]"
                          }`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${modoPorDinero ? "translate-x-5" : "translate-x-1"
                            }`}
                        />
                      </button>
                      <div className={`flex items-center gap-2 transition-all ${modoPorDinero ? "text-purple-600 font-bold" : "text-gray-500"
                        }`}>
                        <DollarSign className="w-4 h-4" />
                        <span className="text-xs font-semibold">Dinero</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mt-2 text-center">
                      {modoPorDinero
                        ? "Ingresa el dinero y se calculará el peso automáticamente"
                        : "Ingresa el peso en kilogramos"}
                    </p>
                  </div>
                )}

                {getPrecioBaseKg(selectedProductData) > 0 ? (
                  <div className="bg-white rounded-lg p-2">
                    <p className="text-xs text-gray-600">
                      Precio base (Kg suelto):
                    </p>
                    <p className="text-lg font-bold text-[#038C65]">
                      {formatCurrency(getPrecioBaseKg(selectedProductData))} / kg
                    </p>
                    {ventaPorPeso && (
                      <p className="text-xs text-blue-600 mt-1">
                        ✓ Se cobrará sobre este precio
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-red-50 rounded-lg p-2">
                    <p className="text-xs text-red-600">
                      ⚠️ Este producto no tiene precio por kg definido
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Venta por peso */}
            {ventaPorPeso && selectedProduct ? (
              <div className="space-y-4">

                {/* Input según el modo seleccionado */}
                {modoPorDinero ? (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Cantidad de Dinero
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={cantidadDinero || ""}
                      onChange={(e) => {
                        const dinero = parseFloat(e.target.value) || 0;
                        setCantidadDinero(dinero);
                        const precioBase = getPrecioBaseKg(selectedProductData);
                        if (precioBase > 0) {
                          setPesoKg(dinero / precioBase);
                        }
                      }}
                      placeholder="Ej: 100"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                    />
                    {cantidadDinero > 0 && (
                      <div className="mt-2 bg-white rounded-lg p-3 border border-purple-200">
                        <p className="text-sm text-gray-600">
                          Peso calculado: <span className="font-bold text-purple-600">
                            {pesoKg.toFixed(2)} kg
                          </span>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Precio base: {formatCurrency(getPrecioBaseKg(selectedProductData))} / kg
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <Weight className="w-4 h-4" />
                      Peso en Kilogramos
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={pesoKg || ""}
                      onChange={(e) => setPesoKg(parseFloat(e.target.value) || 0)}
                      placeholder="Ej: 2.5"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#038C65] focus:border-[#038C65] transition-all"
                    />
                    {pesoKg > 0 && (
                      <p className="mt-2 text-sm text-gray-600">
                        Subtotal: <span className="font-bold text-[#038C65]">
                          {formatCurrency(getPrecioBaseKg(selectedProductData) * pesoKg)}
                        </span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Selector de presentación */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Presentación
                  </label>
                  <select
                    value={selectedPresentation}
                    onChange={(e) => setSelectedPresentation(Number(e.target.value) || "")}
                    disabled={!selectedProduct}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#038C65] focus:border-[#038C65] transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Selecciona una presentación</option>
                    {availablePresentations.map((presentacion) => {
                      const precio = Number(presentacion.precio_unitario);
                      const precioValido = !isNaN(precio) && precio >= 0;
                      
                      return (
                        <option key={presentacion.id} value={presentacion.id}>
                          {presentacion.nombre} - {
                            precioValido 
                              ? formatCurrency(precio) 
                              : `⚠️ Precio inválido (${presentacion.precio_unitario})`
                          }
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Cantidad */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Cantidad
                  </label>
                  <input
                    ref={quantityInputRef}
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#038C65] focus:border-[#038C65] transition-all"
                  />
                </div>
              </>
            )}

            {/* Botón agregar */}
            <button
              onClick={addToCart}
              className="w-full px-6 py-4 bg-gradient-to-r from-[#038C65] to-[#026B4E] text-white rounded-xl hover:shadow-lg hover:scale-[1.02] transition-all font-bold text-lg flex items-center justify-center gap-2"
            >
              <Plus className="w-6 h-6" />
              Agregar al Carrito
            </button>
          </div>
        </div>
      </div>

      {/* Panel del carrito */}
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-xl p-6 border border-gray-200 sticky top-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[#091B26] flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-[#038C65]" />
            Carrito
          </h2>
          {cart.length > 0 && (
            <span className="px-3 py-1 bg-[#038C65] text-white rounded-full text-sm font-bold">
              {cart.length}
            </span>
          )}
        </div>

        {/* Items del carrito */}
        <div className="space-y-3 mb-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">Carrito vacío</p>
            </div>
          ) : (
            cart.map((item, index) => (
              <div
                key={index}
                className="border-2 border-gray-200 rounded-xl p-4 space-y-3 bg-white hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-bold text-sm text-[#091B26]">{item.producto.nombre}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                      {item.esVentaPorPeso ? (
                        <>
                          <Weight className="w-3 h-3" />
                          Por peso
                        </>
                      ) : (
                        <>
                          <Package className="w-3 h-3" />
                          {item.presentacion.nombre}
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => removeFromCart(index)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  {!item.esVentaPorPeso ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(index, -1)}
                        className="p-1.5 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-bold w-10 text-center bg-gray-100 py-1 rounded">
                        {item.cantidad}
                      </span>
                      <button
                        onClick={() => updateQuantity(index, 1)}
                        className="p-1.5 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm font-medium text-gray-600">
                      {item.cantidad.toFixed(2)} kg
                    </span>
                  )}
                  <span className="text-sm font-bold text-[#038C65]">
                    {formatCurrency(item.subtotal)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Descuento */}
        {cart.length > 0 && (
          <div className="mb-4 bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Percent className="w-4 h-4 text-yellow-600" />
              Descuento (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={descuentoPorcentaje || ""}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                setDescuentoPorcentaje(Math.min(100, Math.max(0, val)));
              }}
              placeholder="0"
              className="w-full px-4 py-2 border-2 border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition-all"
            />
            {descuentoPorcentaje > 0 && (
              <p className="mt-2 text-xs text-yellow-700 font-medium">
                Ahorro: {formatCurrency(calculateDescuento())}
              </p>
            )}
          </div>
        )}

        {/* Resumen de totales */}
        {cart.length > 0 && (
          <div className="border-t-2 border-gray-300 pt-4 mb-4 space-y-2">
            <div className="flex justify-between items-center text-sm text-gray-600">
              <span>Subtotal:</span>
              <span className="font-semibold">{formatCurrency(calculateSubtotal())}</span>
            </div>
            {descuentoPorcentaje > 0 && (
              <div className="flex justify-between items-center text-sm text-yellow-600">
                <span>Descuento ({descuentoPorcentaje}%):</span>
                <span className="font-semibold">-{formatCurrency(calculateDescuento())}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-2xl font-bold pt-2 border-t border-gray-200">
              <span className="text-[#091B26]">Total:</span>
              <span className="text-[#038C65]">{formatCurrency(calculateTotal())}</span>
            </div>
          </div>
        )}

        {/* Método de pago fijo */}
        {cart.length > 0 && (
          <div className="mb-4 bg-green-50 border-2 border-green-200 rounded-xl p-3">
            <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              Método de Pago: <span className="text-green-700">Efectivo</span>
            </p>
          </div>
        )}

        {/* Botón finalizar venta */}
        <button
          onClick={handleFinalizeSale}
          disabled={cart.length === 0 || loading}
          className="w-full px-6 py-4 bg-gradient-to-r from-[#038C65] to-[#026B4E] text-white rounded-xl hover:shadow-xl hover:scale-[1.02] transition-all font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
        >
          <DollarSign className="w-6 h-6" />
          {loading ? "Procesando..." : "Finalizar Venta"}
        </button>
      </div>

      {/* Modal del ticket */}
      {isTicketOpen && lastSale && (
        <Ticket
          sale={lastSale}
          onClose={() => setIsTicketOpen(false)}
          empresa={empresa}
        />
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #038C65;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #026B4E;
        }
      `}</style>
    </div>
  );
}
