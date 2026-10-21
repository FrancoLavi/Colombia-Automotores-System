"use client";

import { useLayoutEffect, useRef, useState, type InputHTMLAttributes } from "react";

/** Pone los puntos de miles mientras se escribe: "1500000" → "1.500.000"; la coma queda para los decimales. */
export function conMiles(v: string, negativo = false): string {
  const signo = negativo && v.trim().startsWith("-") ? "-" : "";
  const [entero, ...resto] = v.replace(/[^\d,]/g, "").split(",");
  const digitos = entero.replace(/^0+(?=\d)/, "");
  const miles = digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return signo + miles + (resto.length ? "," + resto.join("").slice(0, 2) : "");
}

/** Texto inicial para un importe: 1460.5 → "1.460,5". */
export function textoMoneda(v: number | string | null | undefined, negativo = true): string {
  if (v == null || v === "") return "";
  return typeof v === "number" ? conMiles(String(v).replace(".", ","), negativo) : conMiles(v, negativo);
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "type"> & {
  defaultValue?: number | string | null;
  /** Controlado: el texto con puntos (inicializarlo con textoMoneda). */
  value?: string;
  onChange?: (texto: string) => void;
  /** Permite importes negativos (ej. un ajuste de precio a la baja). */
  negativo?: boolean;
};

/** Campo de importe con puntos de miles. Lo que se envía es el texto ("1.500.000"); el servidor lo interpreta. */
export function InputMoneda({ defaultValue, value, onChange, negativo = false, ...props }: Props) {
  const [propio, setPropio] = useState(() => textoMoneda(defaultValue, negativo));
  const texto = value !== undefined ? value : propio;
  const ref = useRef<HTMLInputElement>(null);
  const cursor = useRef<number | null>(null);

  // Después de reformatear, deja el cursor después del mismo dígito que estaba.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || cursor.current == null || document.activeElement !== el) return;
    let vistos = 0;
    let pos = 0;
    while (pos < texto.length && vistos < cursor.current) {
      if (/[\d,-]/.test(texto[pos])) vistos++;
      pos++;
    }
    el.setSelectionRange(pos, pos);
    cursor.current = null;
  }, [texto]);

  return (
    <input
      {...props}
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={texto}
      onChange={(e) => {
        let crudo = e.target.value;
        // Un punto tipeado al final sin coma previa se toma como coma decimal (teclado numérico).
        if (crudo.endsWith(".") && !crudo.includes(",") && crudo.length === texto.length + 1 && crudo.startsWith(texto)) {
          crudo = crudo.slice(0, -1) + ",";
        }
        const antes = crudo.slice(0, e.target.selectionStart ?? crudo.length);
        cursor.current = antes.replace(/[^\d,-]/g, "").length;
        const nuevo = conMiles(crudo, negativo);
        if (value === undefined) setPropio(nuevo);
        onChange?.(nuevo);
      }}
    />
  );
}
