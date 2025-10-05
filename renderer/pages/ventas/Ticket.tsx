import { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";

interface TicketProps {
  sale: any;
  onClose: () => void;
  empresa?: {
    nombre_empresa: string;
    direccion: string;
    telefono: string;
    rfc?: string;
  };
}

export default function Ticket({ sale, onClose, empresa }: TicketProps) {
  const ticketRef = useRef<HTMLDivElement>(null);
  const [hasAutoPrinted, setHasAutoPrinted] = useState(false);

  // Imprimir automáticamente al abrir el ticket
  useEffect(() => {
    if (!hasAutoPrinted) {
      const timer = setTimeout(() => {
        handlePrint();
        setHasAutoPrinted(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hasAutoPrinted]);

  const handlePrint = () => {
    if (ticketRef.current) {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Ticket de Venta #${sale.id}</title>
              <style>
                body {
                  font-family: 'Courier New', monospace;
                  font-size: 12px;
                  margin: 0;
                  padding: 20px;
                  width: 80mm;
                }
                .ticket-header {
                  text-align: center;
                  border-bottom: 2px dashed #000;
                  padding-bottom: 10px;
                  margin-bottom: 10px;
                }
                .ticket-header h2 {
                  margin: 5px 0;
                  font-size: 16px;
                }
                .ticket-info {
                  margin: 10px 0;
                  font-size: 11px;
                }
                .ticket-items {
                  border-top: 1px dashed #000;
                  border-bottom: 1px dashed #000;
                  padding: 10px 0;
                  margin: 10px 0;
                }
                .item {
                  margin: 5px 0;
                }
                .item-name {
                  font-weight: bold;
                }
                .item-details {
                  display: flex;
                  justify-content: space-between;
                  margin-top: 2px;
                }
                .ticket-total {
                  margin-top: 10px;
                  padding-top: 10px;
                  border-top: 2px dashed #000;
                }
                .total-row {
                  display: flex;
                  justify-content: space-between;
                  font-size: 14px;
                  font-weight: bold;
                  margin: 5px 0;
                }
                .ticket-footer {
                  text-align: center;
                  margin-top: 15px;
                  padding-top: 10px;
                  border-top: 1px dashed #000;
                  font-size: 11px;
                }
                @media print {
                  body { padding: 0; }
                }
              </style>
            </head>
            <body>
              ${ticketRef.current.innerHTML}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      }
    }
  };

  const handlePrintCopy = async () => {
    const result = await Swal.fire({
      title: "Imprimir Copia",
      text: "¿Deseas imprimir una copia del ticket?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, imprimir",
      cancelButtonText: "No",
      confirmButtonColor: "#038C65",
    });

    if (result.isConfirmed) {
      handlePrint();
    }
  };

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleString("es-MX", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  const metodoPagoLabel = {
    efectivo: "Efectivo",
    tarjeta: "Tarjeta",
    transferencia: "Transferencia",
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-[#091B26]">
              Ticket de Venta
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Contenido del ticket para imprimir */}
          <div ref={ticketRef} className="ticket-content">
            <div className="ticket-header">
              <h2>{empresa?.nombre_empresa || "La Forrajera Feliz"}</h2>
              <p>{empresa?.direccion || "Toluca, MX"}</p>
              <p>Tel: {empresa?.telefono || "722-123-4567"}</p>
              {empresa?.rfc && <p>RFC: {empresa.rfc}</p>}
            </div>

            <div className="ticket-info">
              <p>
                <strong>Folio:</strong> #{sale.id}
              </p>
              <p>
                <strong>Fecha:</strong> {formatDate(sale.fecha)}
              </p>
              <p>
                <strong>Vendedor:</strong> {sale.usuario?.nombre || "N/A"}
              </p>
              <p>
                <strong>Método de Pago:</strong>{" "}
                {metodoPagoLabel[sale.metodo_pago] || sale.metodo_pago}
              </p>
            </div>

            <div className="ticket-items">
              <h3 className="font-bold mb-2">Productos:</h3>
              {sale.detalle?.map((item: any, index: number) => (
                <div key={index} className="item">
                  <div className="item-name">{item.producto?.nombre}</div>
                  <div className="item-details">
                    <span>
                      {Number(item.cantidad_presentacion).toFixed(2)} x{" "}
                      {item.presentacion?.nombre || "unidad"}
                    </span>
                    <span>{formatCurrency(Number(item.precio_unitario))}</span>
                  </div>
                  <div className="item-details">
                    <span>Subtotal:</span>
                    <span className="font-bold">
                      {formatCurrency(Number(item.subtotal))}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="ticket-total">
              {sale.descuento_porcentaje && sale.descuento_porcentaje > 0 && (
                <>
                  <div className="total-row" style={{ fontSize: '12px', fontWeight: 'normal' }}>
                    <span>Subtotal:</span>
                    <span>{formatCurrency(Number(sale.subtotal || sale.total))}</span>
                  </div>
                  <div className="total-row" style={{ fontSize: '12px', fontWeight: 'normal', color: '#d97706' }}>
                    <span>Descuento ({sale.descuento_porcentaje}%):</span>
                    <span>-{formatCurrency(Number(sale.descuento_monto || 0))}</span>
                  </div>
                </>
              )}
              <div className="total-row">
                <span>TOTAL:</span>
                <span>{formatCurrency(Number(sale.total))}</span>
              </div>
            </div>

            <div className="ticket-footer">
              <p>¡Gracias por su compra!</p>
              <p>Vuelva pronto</p>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={handlePrintCopy}
              className="flex-1 px-4 py-2 bg-[#038C65] text-white rounded-lg hover:brightness-110 transition-all"
            >
              Imprimir Copia
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-all"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
