"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { BotonConfirmar } from "@/components/dialogo";
import { InputMoneda } from "@/components/input-moneda";
import { INICIAL, type Resultado } from "@/lib/form";
import { BotonEnviar, Mensaje } from "@/components/ui";
import { ETIQUETA_ESTADO, ETIQUETA_UBICACION, type EstadoVehiculo, type Ubicacion } from "@/domain/stock";
import { hoyIso } from "@/lib/formato";
import * as a from "../actions";

export function FormUbicacion({ id, actual }: { id: number; actual: Ubicacion }) {
  const [r, enviar, pendiente] = useActionState(a.ubicacionAccion.bind(null, id), INICIAL);
  const form = useRef<HTMLFormElement>(null);
  return (
    <form action={enviar} ref={form} className="flex flex-col gap-1">
      <label className="campo">
        Ubicación
        <select name="ubicacion" defaultValue={actual} disabled={pendiente} onChange={() => form.current?.requestSubmit()}>
          {(Object.keys(ETIQUETA_UBICACION) as Ubicacion[]).map((u) => (
            <option key={u} value={u}>
              {ETIQUETA_UBICACION[u]}
            </option>
          ))}
        </select>
      </label>
      {r.error && <span className="text-sm text-aviso-texto">{r.error}</span>}
    </form>
  );
}

export function AccionesEstado({ id, transiciones }: { id: number; transiciones: EstadoVehiculo[] }) {
  const [r, enviar] = useActionState(a.estadoAccion.bind(null, id), INICIAL);
  if (!transiciones.length) return null;
  return (
    <form action={enviar} className="flex flex-wrap items-end gap-2">
      <label className="campo">
        Motivo (opcional)
        <input name="motivo" />
      </label>
      {transiciones.map((t) => {
        const texto = t === "POR_INGRESAR" ? "Volver a por ingresar" : t === "BAJA" ? "Dar de baja" : `Marcar ${ETIQUETA_ESTADO[t].toLowerCase()}`;
        return (
          <BotonConfirmar
            key={t}
            name="estado"
            value={t}
            peligro={t !== "POR_INGRESAR"}
            className="btn border border-aviso-texto text-aviso-texto hover:bg-aviso-fondo"
            titulo={`¿${texto}?`}
            detalle={`El auto pasa a ${ETIQUETA_ESTADO[t].toLowerCase()}. Queda en el historial con el motivo que escribiste.`}
          >
            {texto}
          </BotonConfirmar>
        );
      })}
      <Mensaje r={r} />
    </form>
  );
}

export function BotonHabilitar({ id, faltantes }: { id: number; faltantes: string[] }) {
  const [r, enviar] = useActionState(a.habilitarAccion.bind(null, id), INICIAL);
  return (
    <form action={enviar} className="flex flex-col gap-2">
      <BotonEnviar pendiente="Habilitando…">Habilitar para la venta</BotonEnviar>
      {faltantes.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-aviso-texto">
          {faltantes.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
      <Mensaje r={r} />
    </form>
  );
}

export function FormPrecio({ id, ajuste, publicado, sugerido }: { id: number; ajuste: number; publicado: number | null; sugerido: number }) {
  const [r, enviar] = useActionState(a.precioAccion.bind(null, id), INICIAL);
  return (
    <form action={enviar} className="flex flex-col gap-3 border-t border-linea pt-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="campo">
          Ajuste comercial ($)
          <InputMoneda name="ajustePrecio" negativo defaultValue={ajuste || ""} placeholder="Ej: 250.000 o -500.000" />
        </label>
        <label className="campo">
          Precio publicado ($)
          <InputMoneda name="precioPublicado" defaultValue={publicado} placeholder={`Vacío = sugerido (${sugerido.toLocaleString("es-AR")})`} />
        </label>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Mensaje r={r} />
        <BotonEnviar className="btn-secundario ml-auto">Guardar precio</BotonEnviar>
      </div>
    </form>
  );
}

type Documento = {
  id: number;
  nombre: string;
  obligatorio: boolean;
  tieneVencimiento: boolean;
  soloPrendados: boolean;
  estado: "PENDIENTE" | "RECIBIDO" | "NO_APLICA";
  fechaRecepcion: string | null;
  fechaVencimiento: string | null;
  recibidoPor: string | null;
  archivoUrl: string | null;
};

const ETIQUETA_DOC = { PENDIENTE: "Pendiente", RECIBIDO: "En condiciones ✓", NO_APLICA: "No aplica" } as const;

/** Un papel del auto. Montarlo con key que incluya el estado: React 19 resetea el form después de la acción. */
export function FilaDocumento({ vehiculoId, doc }: { vehiculoId: number; doc: Documento }) {
  const [r, enviar, pendiente] = useActionState(a.documentoAccion.bind(null, vehiculoId, doc.id), INICIAL);
  const form = useRef<HTMLFormElement>(null);
  const enviarYa = () => form.current?.requestSubmit();
  const recibido = doc.estado === "RECIBIDO";
  return (
    <div className="flex flex-col gap-1.5 border-t border-linea py-2.5 text-sm">
      <form action={enviar} ref={form} className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="min-w-40 flex-1">
          {recibido && <span className="mr-1.5 font-bold text-ok-texto" aria-hidden>✓</span>}
          {doc.nombre}
          {!doc.obligatorio && <span className="text-apagado"> · opcional</span>}
          {doc.soloPrendados && <span className="text-apagado"> · por la prenda</span>}
        </span>
        {doc.tieneVencimiento && (
          <label className="flex items-center gap-1.5 text-apagado">
            Vence
            <input
              type="date"
              name="fechaVencimiento"
              defaultValue={doc.fechaVencimiento ?? ""}
              onBlur={(e) => e.target.value !== (doc.fechaVencimiento ?? "") && enviarYa()}
              className="min-h-11 rounded-lg border border-campo-borde px-2"
            />
          </label>
        )}
        <select
          name="estado"
          defaultValue={doc.estado}
          onChange={enviarYa}
          disabled={pendiente}
          aria-label={`Estado de ${doc.nombre}`}
          className={`min-h-11 rounded-lg border px-2 font-semibold ${recibido ? "border-ok bg-ok-fondo text-ok-texto" : doc.estado === "PENDIENTE" && doc.obligatorio ? "border-aviso-texto bg-aviso-fondo text-aviso-texto" : "border-campo-borde bg-superficie"}`}
        >
          {(Object.keys(ETIQUETA_DOC) as (keyof typeof ETIQUETA_DOC)[]).map((e) => (
            <option key={e} value={e}>
              {ETIQUETA_DOC[e]}
            </option>
          ))}
        </select>
      </form>
      {recibido && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-apagado">
          {doc.recibidoPor && (
            <span>
              Recibido por {doc.recibidoPor} · {doc.fechaRecepcion?.split("-").reverse().join("/")}
            </span>
          )}
          <Comprobante vehiculoId={vehiculoId} documentoId={doc.id} url={doc.archivoUrl} nombre={doc.nombre} />
        </div>
      )}
      {r.error && <span className="text-aviso-texto">{r.error}</span>}
    </div>
  );
}

/** Foto o PDF que certifica el papel. Es opcional. */
function Comprobante({ vehiculoId, documentoId, url, nombre }: { vehiculoId: number; documentoId: number; url: string | null; nombre: string }) {
  const [r, setR] = useState<Resultado>(INICIAL);
  const [pendiente, iniciar] = useTransition();
  if (url) {
    return (
      <span className="flex items-center gap-2">
        <a href={url} target="_blank" rel="noreferrer" className="font-semibold">
          Ver comprobante
        </a>
        <button
          type="button"
          disabled={pendiente}
          onClick={() => iniciar(async () => setR(await a.quitarComprobanteAccion(vehiculoId, documentoId)))}
          className="min-h-11 px-1 text-apagado underline hover:text-aviso-texto"
        >
          {pendiente ? "Quitando…" : "Quitar"}
        </button>
        {r.error && <span className="text-aviso-texto">{r.error}</span>}
      </span>
    );
  }
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-1.5 font-semibold text-acento">
      {pendiente ? "Subiendo…" : "+ Adjuntar comprobante (opcional)"}
      <input
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        aria-label={`Comprobante de ${nombre}`}
        disabled={pendiente}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          iniciar(async () => {
            const fd = new FormData();
            fd.set("archivo", await comprimir(f));
            setR(await a.comprobanteAccion(vehiculoId, documentoId, fd));
          });
        }}
      />
      {r.error && <span className="font-normal text-aviso-texto">{r.error}</span>}
    </label>
  );
}

export function FormPeritaje({
  id,
  actual,
}: {
  id: number;
  actual: { fecha: string; perito: string | null; resultado: string; reparacionEstimada: number | null; costo: number | null; observaciones: string | null } | null;
}) {
  const [r, enviar] = useActionState(a.peritajeAccion.bind(null, id), INICIAL);
  return (
    <form action={enviar} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="campo">
          Resultado
          <select name="resultado" defaultValue={actual?.resultado ?? "APTO"}>
            <option value="APTO">Apto</option>
            <option value="APTO_CON_OBS">Apto con observaciones</option>
            <option value="NO_APTO">No apto</option>
          </select>
        </label>
        <label className="campo">
          Fecha
          <input type="date" name="fecha" defaultValue={actual?.fecha ?? hoyIso()} />
        </label>
        <label className="campo">
          Perito / mecánico
          <input name="perito" defaultValue={actual?.perito ?? ""} />
        </label>
      </div>
      <label className="campo">
        Observaciones
        <textarea name="observaciones" rows={2} defaultValue={actual?.observaciones ?? ""} />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="campo">
          Reparación estimada ($)
          <InputMoneda name="reparacionEstimada" defaultValue={actual?.reparacionEstimada} />
        </label>
        <label className="campo">
          Costo del peritaje ($)
          <InputMoneda name="costo" defaultValue={actual?.costo} placeholder="Sin costo" />
        </label>
        <label className="campo">
          Pago del peritaje
          <select name="pagoCosto" defaultValue="EFECTIVO">
            <option value="EFECTIVO">Pagado en efectivo</option>
            <option value="BANCO">Pagado por banco</option>
            <option value="PENDIENTE">Queda a pagar</option>
          </select>
        </label>
      </div>
      <p className="-mt-1 text-xs text-apagado">El costo del peritaje se suma al costo real del auto (y al precio sugerido) como gasto &quot;Peritaje&quot;.</p>
      <div className="flex items-center justify-between gap-3">
        <Mensaje r={r} />
        <BotonEnviar className="btn-secundario ml-auto">{actual ? "Actualizar peritaje" : "Guardar peritaje"}</BotonEnviar>
      </div>
    </form>
  );
}

export function FormGasto({ id, categorias, vendido }: { id: number; categorias: { id: number; nombre: string }[]; vendido: boolean }) {
  const [r, enviar] = useActionState(async (prev: Resultado, fd: FormData) => {
    const res = await a.gastoAccion(id, prev, fd);
    if (res.ok) formRef.current?.reset();
    return res;
  }, INICIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, setEstado] = useState("PAGADO");
  return (
    <form action={enviar} ref={formRef} className="flex flex-col gap-3 rounded-lg bg-fondo p-3">
      {vendido && (
        <p className="text-sm text-aviso-texto">El auto ya está vendido: el gasto se registra como extraordinario del salón y no cambia la venta.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="campo">
          Categoría
          <select name="categoriaId" required>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          Importe ($)
          <InputMoneda name="importe" required />
        </label>
        <label className="campo">
          Fecha
          <input type="date" name="fecha" defaultValue={hoyIso()} />
        </label>
        <label className="campo lg:col-span-1">
          Detalle
          <input name="descripcion" placeholder="Ej: paragolpe trasero" />
        </label>
        <label className="campo">
          Estado
          <select name="estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="PAGADO">Pagado (sale de caja)</option>
            <option value="PENDIENTE">Queda a pagar</option>
          </select>
        </label>
        {estado === "PAGADO" && (
          <label className="campo">
            Medio
            <select name="medio" defaultValue="EFECTIVO">
              <option value="EFECTIVO">Efectivo</option>
              <option value="BANCO">Banco</option>
            </select>
          </label>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <Mensaje r={r} />
        <BotonEnviar className="btn-primario ml-auto">Cargar gasto</BotonEnviar>
      </div>
    </form>
  );
}

/** Reduce la foto en el navegador (lado mayor 1600 px, JPEG 0,8) antes de subirla. */
async function comprimir(f: File): Promise<File> {
  if (!f.type.startsWith("image/")) return f;
  const bmp = await createImageBitmap(f);
  const escala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * escala);
  canvas.height = Math.round(bmp.height * escala);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.8));
  return blob ? new File([blob], f.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : f;
}

export function SubirFotos({ id }: { id: number }) {
  const [r, setR] = useState<Resultado>(INICIAL);
  const [pendiente, iniciar] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const archivos = Array.from(input.current?.files ?? []);
        iniciar(async () => {
          const fd = new FormData();
          fd.set("tipo", "FOTO_PERITAJE");
          for (const f of archivos) fd.append("archivos", await comprimir(f));
          const res = await a.subirFotosAccion(id, INICIAL, fd);
          setR(res);
          if (res.ok && input.current) input.current.value = "";
        });
      }}
    >
      <label className="campo">
        Agregar fotos
        <input ref={input} type="file" accept="image/*" multiple className="py-2" />
      </label>
      <div className="flex items-center justify-between gap-3">
        <Mensaje r={r} />
        <button className="btn-secundario ml-auto" disabled={pendiente}>
          {pendiente ? "Subiendo…" : "Subir"}
        </button>
      </div>
    </form>
  );
}
