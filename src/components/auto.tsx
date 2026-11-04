// Un auto se muestra siempre desglosado: marca, modelo y patente, cada uno en su lugar
// (ej.: Ford · Ranger · AC456EF). Y donde hay una lista de autos, se filtra por cada uno.
import Link from "next/link";
import type { DatosAuto, FiltroAuto } from "@/domain/autos";

/** La patente dibujada como una chapa (franja azul arriba, como las del Mercosur), para reconocerla de un vistazo. */
export function Patente({ dominio }: { dominio: string | null | undefined }) {
  if (!dominio) return <span className="text-sm text-apagado">Sin patente</span>;
  return (
    <span
      className="num inline-flex flex-col overflow-hidden rounded-[5px] border-[1.5px] border-[#1b1f24] bg-white text-center align-middle leading-none text-[#1b1f24] shadow-[0_1px_0_rgba(0,0,0,.15)]"
      title={`Patente ${dominio}`}
    >
      <span aria-hidden="true" className="block h-[5px] bg-[#1f4fd1]" />
      <span className="px-1.5 pb-[3px] pt-[2px] text-[13px] font-bold tracking-[0.08em]">{dominio}</span>
    </span>
  );
}

/** Encabezados de las tres columnas del auto. */
export function ThAuto() {
  return (
    <>
      <th>Marca</th>
      <th>Modelo</th>
      <th>Patente</th>
    </>
  );
}

/** Las tres celdas del auto. Con `href`, la marca y el modelo llevan a la ficha. */
export function TdAuto({ auto, href, anio }: { auto: (DatosAuto & { anio?: number | null }) | null | undefined; href?: string; anio?: boolean }) {
  if (!auto) {
    return (
      <>
        <td className="text-apagado">—</td>
        <td />
        <td />
      </>
    );
  }
  const texto = (s: string) => (href ? <Link href={href} className="text-tinta">{s}</Link> : s);
  return (
    <>
      <td className="font-semibold">{texto(auto.marca)}</td>
      <td>
        {texto(auto.modelo)}
        {anio && auto.anio ? <span className="num text-apagado"> {auto.anio}</span> : null}
      </td>
      <td>
        <Patente dominio={auto.dominio} />
      </td>
    </>
  );
}

/** Para textos corridos: "Ford Ranger" + la chapa. */
export function AutoEnLinea({ auto, anio }: { auto: DatosAuto & { anio?: number | null }; anio?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
      <span>
        <b>{auto.marca}</b> {auto.modelo}
        {anio && auto.anio ? <span className="num text-apagado"> {auto.anio}</span> : null}
      </span>
      <Patente dominio={auto.dominio} />
    </span>
  );
}

/**
 * Los tres campos de filtro (marca, modelo, patente). Va adentro de un `FormFiltros`, que los
 * aplica solos al escribir. Marca y modelo sugieren los que hay cargados.
 */
export function CamposFiltroAuto({ valores, marcas, modelos, id = "auto" }: { valores: FiltroAuto; marcas: string[]; modelos: string[]; id?: string }) {
  return (
    <>
      <label className="campo">
        Marca
        <input type="search" name="marca" defaultValue={valores.marca} list={`${id}-marcas`} placeholder="Ej.: Ford" autoComplete="off" />
        <datalist id={`${id}-marcas`}>
          {marcas.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </label>
      <label className="campo">
        Modelo
        <input type="search" name="modelo" defaultValue={valores.modelo} list={`${id}-modelos`} placeholder="Ej.: Ranger" autoComplete="off" />
        <datalist id={`${id}-modelos`}>
          {modelos.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </label>
      <label className="campo">
        Patente
        <input type="search" name="patente" defaultValue={valores.patente} placeholder="Ej.: AC456EF" autoComplete="off" className="uppercase placeholder:normal-case" />
      </label>
    </>
  );
}
