"use client";

// Alertas con SweetAlert2, con los colores y botones del sistema (acompañan el tema claro y oscuro).
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";

/** Base de todas las alertas: superficie y tinta del tema, botones como los del resto del sistema. */
/** Clases de cada parte de la alerta. Al cambiar una, hay que pasarlas todas (Swal no las mezcla). */
export const CLASES_ALERTA = {
  popup: "rounded-xl border border-borde",
  title: "text-lg font-semibold",
  htmlContainer: "text-sm",
  actions: "flex flex-wrap gap-2",
  confirmButton: "btn-primario",
  cancelButton: "btn-secundario",
};

export const alerta = withReactContent(
  Swal.mixin({
    background: "var(--color-superficie)",
    color: "var(--color-tinta)",
    buttonsStyling: false,
    customClass: CLASES_ALERTA,
  }),
);

/** Avisito arriba a la derecha que se va solo: para confirmar que algo se guardó. */
export const aviso = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 3500,
  timerProgressBar: true,
  background: "var(--color-superficie)",
  color: "var(--color-tinta)",
});

/** Un error que el usuario tiene que leer (por ejemplo, que no alcanza la plata). */
export function alertaError(texto: string, titulo = "No se pudo hacer") {
  return alerta.fire({ icon: "error", title: titulo, text: texto, confirmButtonText: "Entendido" });
}

/**
 * Después de un cobro o un pago: avisa que quedó registrado y ofrece el comprobante en PDF
 * (HU-5.10). Se llama desde la acción del formulario, así funciona aunque la fila desaparezca.
 */
export function ofrecerComprobante(movimientoId: number, titulo: string) {
  return alerta
    .fire({
      icon: "success",
      title: titulo,
      text: "¿Querés el comprobante para dárselo o guardarlo?",
      showCancelButton: true,
      confirmButtonText: "Ver comprobante PDF",
      cancelButtonText: "Cerrar",
      reverseButtons: true,
    })
    .then((r) => {
      if (r.isConfirmed) window.open(`/caja/movimiento/${movimientoId}/comprobante`, "_blank", "noopener");
    });
}
