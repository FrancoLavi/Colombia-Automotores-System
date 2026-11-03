import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { FormFiltros } from "@/components/filtros";
import { agenda } from "@/server/contactos";
import { nombreContacto, fecha, hoyIso, hora } from "@/lib/formato";
import { ETIQUETA_ACTIVIDAD, type TipoActividad } from "@/domain/contactos";
import { Telefono } from "../chips";
import { EditarCita, FormCompletar } from "../formularios";

export const metadata = { title: "Agenda · Colombia Automotores" };

type Item = {
  clave: string;
  dia: string;
  hora: string | null;
  contacto: { id: number; nombre: string; apellido: string | null; telefono: string | null };
  tipo: TipoActividad | "RECONTACTO";
  detalle: string;
  actividadId: number | null;
  cita: React.ComponentProps<typeof EditarCita>["cita"];
};

type Busqueda = { q?: string; tipo?: string; desde?: string; hasta?: string };

/** "Volver a contactar" no es una actividad cargada: sale del "próximo contacto" del contacto. */
const ETIQUETA_TIPO: Record<Item["tipo"], string> = { ...ETIQUETA_ACTIVIDAD, RECONTACTO: "Volver a contactar" };

/** "lunes 03/11/2026": el día de la semana ayuda a ubicarse en una agenda larga. */
function diaConSemana(dia: string) {
  const semana = new Date(`${dia}T12:00:00Z`).toLocaleDateString("es-AR", { weekday: "long", timeZone: "UTC" });
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)} ${fecha(dia)}`;
}

/** Minúsculas y sin tildes, para que "gomez" encuentre a "Gómez". */
const normalizar = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function coincide(i: Item, sp: Busqueda) {
  if (sp.tipo && i.tipo !== sp.tipo) return false;
  if (sp.desde && i.dia < sp.desde) return false;
  if (sp.hasta && i.dia > sp.hasta) return false;
  const q = sp.q?.trim();
  if (!q) return true;
  const texto = normalizar(`${nombreContacto(i.contacto)} ${i.contacto.telefono ?? ""} ${i.detalle}`);
  const digitos = q.replace(/\D/g, "");
  // Un teléfono se busca por sus números, se haya escrito con espacios o guiones o sin ellos.
  if (digitos.length >= 3 && (i.contacto.telefono ?? "").replace(/\D/g, "").includes(digitos)) return true;
  return normalizar(q)
    .split(/\s+/)
    .every((palabra) => texto.includes(palabra));
}

export default async function AgendaPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  await requerirUsuario();
  const sp = await searchParams;
  const hoy = hoyIso();
  const manana = hoyIso(new Date(Date.now() + 86_400_000));
  const { actividades, proximos } = await agenda();

  const todos: Item[] = [
    ...actividades.map(({ a, contacto }) => ({
      clave: `a${a.id}`,
      dia: hoyIso(a.fechaProgramada),
      hora: hora(a.fechaProgramada),
      contacto,
      tipo: a.tipo,
      detalle: `${ETIQUETA_ACTIVIDAD[a.tipo]}${a.nota ? ` · ${a.nota}` : ""}`,
      actividadId: a.id,
      cita: { clase: "actividad" as const, id: a.id, tipo: a.tipo, fechaProgramada: a.fechaProgramada, nota: a.nota },
    })),
    ...proximos.map((c) => ({
      clave: `c${c.id}`,
      dia: c.proximoContacto!,
      hora: null,
      contacto: c,
      tipo: "RECONTACTO" as const,
      detalle: `Volver a contactar${c.productoInteres ? ` · busca ${c.productoInteres}` : ""}`,
      actividadId: null,
      cita: { clase: "proximo" as const, dia: c.proximoContacto! },
    })),
  ].sort((x, y) => (x.dia + (x.hora ?? "99")).localeCompare(y.dia + (y.hora ?? "99")));
  const items = todos.filter((i) => coincide(i, sp));
  const filtrando = Boolean(sp.q || sp.tipo || sp.desde || sp.hasta);

  const grupos = [
    { titulo: "Atrasados", items: items.filter((i) => i.dia < hoy), clase: "text-aviso-texto" },
    { titulo: `Hoy · ${fecha(hoy)}`, items: items.filter((i) => i.dia === hoy), clase: "" },
    { titulo: `Mañana · ${fecha(manana)}`, items: items.filter((i) => i.dia === manana), clase: "" },
    // Del pasado mañana en adelante, un grupo por día.
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
      <div>
        <h1 className="text-3xl font-bold">Agenda</h1>
        <p className="mt-1 text-suave">
          {filtrando ? `${items.length} de ${todos.length} pendientes` : `Todo lo pendiente · ${todos.length}`}
        </p>
      </div>

      <FormFiltros plegable className="tarjeta grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="campo lg:col-span-2">
          Buscar
          <input type="search" name="q" defaultValue={sp.q} placeholder="Nombre, teléfono o nota" />
        </label>
        <label className="campo">
          Tipo
          <select name="tipo" defaultValue={sp.tipo ?? ""}>
            <option value="">Todos</option>
            {(Object.keys(ETIQUETA_TIPO) as Item["tipo"][]).map((t) => (
              <option key={t} value={t}>
                {ETIQUETA_TIPO[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          Desde
          <input type="date" name="desde" defaultValue={sp.desde} />
        </label>
        <label className="campo">
          Hasta
          <input type="date" name="hasta" defaultValue={sp.hasta} />
        </label>
        <div className="flex items-end gap-2 lg:col-span-5">
          <button className="btn-secundario">Filtrar</button>
          {filtrando && (
            <Link href="/contactos/agenda" className="btn text-sm text-acento">
              Limpiar
            </Link>
          )}
        </div>
      </FormFiltros>

      {items.length === 0 && (
        <p className="tarjeta text-suave">{filtrando ? "No hay citas con estos filtros." : "No hay nada agendado."}</p>
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
                <EditarCita contactoId={i.contacto.id} cita={i.cita} />
              </article>
            ))}
          </section>
        ))}
    </div>
  );
}
