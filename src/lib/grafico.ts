// Utilidades de gráficos que se usan desde el servidor (fuera del componente cliente).

/** Marcas "lindas" para el eje: 0 y 2 o 3 valores redondos hasta el máximo. */
export function marcasDelEje(max: number): number[] {
  if (!(max > 0)) return [0];
  const paso0 = max / 3;
  const pot = 10 ** Math.floor(Math.log10(paso0));
  const paso = [1, 2, 2.5, 5, 10].map((k) => k * pot).find((p) => p >= paso0) ?? 10 * pot;
  const out = [0];
  for (let v = paso; v < max + paso; v += paso) out.push(Math.round(v * 100) / 100);
  return out;
}
