import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { agenda } from "@/server/contactos";
import { nombreContacto, fecha, hoyIso, hora } from "@/lib/formato";
import { ETIQUETA_ACTIVIDAD } from "@/domain/contactos";
import { Telefono } from "../chips";
import { FormCompletar } from "../formularios";

export const metadata = { title: "Agenda · Colombia Automotores" };

type Item = {
  clave: string;
  dia: string;
  hora: string | null;
  contacto: { id: number; nombre: string; apellido: string | null; telefono: string | null };
  detalle: string;
  actividadId: number | null;
};

/** Suma meses a un día "AAAA-MM-DD" (31/01 + 1 mes = 28/02 o 29/02, no 03/03). */
function sumarMeses(dia: string, meses: number) {
  const [a, m, d] = dia.split("-").map(Number);
  const ultimoDelMes = new Date(Date.UTC(a, m - 1 + meses + 1, 0)).getUTCDate();
  return new Date(Date.UTC(a, m - 1 + meses, Math.min(d, ultimoDelMes))).toISOString().slice(0, 10);
}

/** "lunes 03/11/2026": el día de la semana ayuda a ubicarse en una agenda de un mes. */
function diaConSemana(dia: string) {
  const semana = new Date(`${dia}T12:00:00Z`).toLocaleDateString("es-AR", { weekday: "long", timeZone: "UTC" });
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)} ${fecha(dia)}`;
}

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ rango?: string }> }) {
  await requerirUsuario();
  const mes = (await searchParams).rango === "mes";
  const hoy = hoyIso();
  const manana = hoyIso(new Date(Date.now() + 86_400_000));
  const hasta = mes ? sumarMeses(hoy, 1) : manana;
  const { actividades, proximos } = await agenda(hasta);

  const items: Item[] = [
    ...actividades.map(({ a, contacto }) => ({
      clave: `a${a.id}`,
      dia: hoyIso(a.fechaProgramada),
      hora: hora(a.fechaProgramada),
      contacto,
      detalle: `${ETIQUETA_ACTIVIDAD[a.tipo]}${a.nota ? ` · ${a.nota}` : ""}`,
      actividadId: a.id,
    })),
    ...proximos.map((c) => ({
      clave: `c${c.id}`,
      dia: c.proximoContacto!,
      hora: null,
      contacto: c,
      detalle: `Volver a contactar${c.productoInteres ? ` · busca ${c.productoInteres}` : ""}`,
      actividadId: null,
    })),
  ].sort((x, y) => (x.dia + (x.hora ?? "99")).localeCompare(y.dia + (y.hora ?? "99")));

  const grupos = [
    { titulo: "Atrasados", items: items.filter((i) => i.dia < hoy), clase: "text-aviso-texto" },
    { titulo: `Hoy · ${fecha(hoy)}`, items: items.filter((i) => i.dia === hoy), clase: "" },
    { titulo: `Mañana · ${fecha(manana)}`, items: items.filter((i) => i.dia === manana), clase: "" },
    // Con el rango de un mes, del pasado mañana en adelante va un grupo por día.
    ...[...new Set(items.filter((i) => i.dia > manana).map((i) => i.dia))].map((dia) => ({
      titulo: diaConSemana(dia),
      items: items.filter((i) => i.dia === dia),
      clase: "",
    })),
  ];

  return (
    <div className="flex flex-col gap-5">
      <Link href="/contactos" className="text-sm font-semibold">
        ← Volver a contactos
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Agenda</h1>
          <p className="mt-1 text-suave">{mes ? `De hoy al ${fecha(hasta)}` : "Hoy y mañana"}</p>
        </div>
        <Link href={mes ? "/contactos/agenda" : "/contactos/agenda?rango=mes"} className="btn-secundario">
          {mes ? "Ver solo hoy y mañana" : "Ver el próximo mes"}
        </Link>
      </div>
      {items.length === 0 && (
        <p className="tarjeta text-suave">{mes ? "No hay nada agendado de acá a un mes." : "No hay nada agendado para hoy ni mañana."}</p>
      )}
      {grupos
        .filter((g) => g.items.length)
        .map((g) => (
          <section key={g.titulo} className="flex flex-col gap-2.5">
            <h2 className={`text-lg font-semibold ${g.clase}`}>
              {g.titulo} · {g.items.length}
            </h2>
            {g.items.map((i) => (
              <article key={i.clave} className="tarjeta flex flex-col gap-3 px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                  {i.hora && <span className="num text-apagado">{i.hora}</span>}
                  {g.titulo === "Atrasados" && <span className="num text-aviso-texto">{fecha(i.dia)}</span>}
                  <Link href={`/contactos/${i.contacto.id}`} className="font-semibold text-tinta">
                    {nombreContacto(i.contacto)}
                  </Link>
                  <Telefono telefono={i.contacto.telefono} />
                  <span className="text-sm text-suave">{i.detalle}</span>
                </div>
                <FormCompletar actividadId={i.actividadId} contactoId={i.contacto.id} />
              </article>
            ))}
          </section>
        ))}
    </div>
  );
}
