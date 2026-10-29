# Instrucciones para asistentes de IA

Este archivo lo leen Claude Code (vía `CLAUDE.md`), Codex/ChatGPT y cualquier otro asistente. Es la referencia común del equipo: si algo cambia en cómo trabajamos, se actualiza acá en el mismo PR.

## Proyecto
Sistema de gestión interno para el salón de autos usados Colombia Automotores: contactos, stock, ventas, caja, patrimonio y reparto con inversores.

- **Reglas de negocio:** [`docs/MVP.md`](docs/MVP.md) es la única fuente de verdad. Cada regla tiene un ID (V1, R3, S4, K3, T1…); citalo en comentarios y tests. Si una tarea contradice el MVP o necesita una regla nueva, frená y preguntá. Si se confirma un cambio, actualizá `docs/MVP.md` en el mismo PR.
- **Mockup:** `docs/mockup/*.html` (estático, referencia visual).

## Comandos
```bash
npm run dev           # http://localhost:3000
npm test              # vitest: tests de dominio e integración (PGlite en memoria)
npm run lint
npm run typecheck   # tsc: el build de Next no mira los tests ni los scripts
npm run build
npm run db:generate   # nueva migración a partir de src/db/schema.ts
npm run db:migrate    # aplica migraciones (PGlite local en ./.data/pglite o DATABASE_URL)
npm run db:seed       # datos base + usuario inicial desde .env.local
```
Antes de dar una tarea por terminada: `npm test`, `npm run lint`, `npm run typecheck` y `npm run build` tienen que pasar. Lo mismo corre en CI en cada PR.

## Arquitectura (capas)
| Capa | Carpeta | Qué va |
|---|---|---|
| Dominio | `src/domain/` | Reglas de negocio **puras**: sin base, sin Next. Cada archivo tiene su `*.test.ts`. Ej.: `negocio.ts` (costo, precio sugerido, reparto). |
| Servicios | `src/server/` | Casos de uso con base de datos (Drizzle). Usan el dominio, abren transacciones, auditan y lanzan `ErrorNegocio` para errores que ve el usuario. Tests `*.integration.test.ts`. |
| Acciones | `src/app/(app)/<modulo>/actions.ts` | Server actions: `requerirUsuario()`, parsean el `FormData` con los helpers de `src/lib/form.ts`, llaman al servicio dentro de `ejecutar()` y hacen `revalidatePath`. Sin lógica de negocio. |
| Pantallas | `src/app/(app)/<modulo>/` | Páginas y formularios. Componentes comunes en `src/components/ui.tsx`. |
| Base | `src/db/schema.ts` | Esquema único de Drizzle. |

Una regla de negocio nueva va primero en `src/domain` con su test, después se usa desde `src/server`.

## Convenciones
- **Idioma:** código, nombres, comentarios, commits y UI en español (es-AR). Formato `$ 1.234.567` y fechas `dd/mm/aaaa` con los helpers de `src/lib/formato.ts`.
- **Importes:** `numeric(14,2)` en la base; nunca `float`. Redondear con `r2()` de `src/domain/negocio.ts`.
- **Auditoría (T1):** toda alta, modificación, baja o cambio de estado llama a `auditar()` (`src/lib/auditoria.ts`) **dentro de la misma transacción** que el cambio.
- **Roles (T2):** ADMIN ve todo; INVERSOR solo lectura de sus autos y su subcaja (`/mi-inversion`). Toda acción nueva valida la sesión.
- **Errores:** `ErrorNegocio` para lo que el usuario tiene que leer; el resto se loguea y se muestra un mensaje genérico.
- Seguí el estilo del código existente del módulo antes de inventar uno nuevo.

## Base de datos y migraciones (cuidado)
- Nunca editar una migración ya mergeada en `main`. Siempre `npm run db:generate` sobre `src/db/schema.ts`.
- **Una migración por vez en el equipo.** Antes de generar, traer `main` actualizado. Si dos ramas generan migraciones en paralelo chocan `drizzle/meta/_journal.json` y los snapshots: en ese caso, descartar la propia, rebasear sobre `main` y regenerar.
- Nunca apuntar `DATABASE_URL` a la base de producción para desarrollar ni para correr tests.

## Producción (Vercel + Supabase)
- **La base se conecta por el "Session pooler" de Supabase, puerto 5432.** No usar el "Transaction pooler" (6543) aunque la documentación de Supabase lo recomiende para serverless: esta app manda varias consultas encadenadas por la misma conexión y ese pooler las parte, así que el servidor queda esperando un cierre que nunca llega. **No da error: se cuelga.** El síntoma son pantallas que cargan para siempre, `Vercel Runtime Timeout Error` a los 300 s y, en `pg_stat_activity`, consultas triviales en estado `active` / `ClientRead` durante minutos.
- Por eso `src/db/index.ts` abre **una sola conexión por instancia** (`max: 1`). Sin ese límite, cada instancia de Vercel pide hasta diez y se agotan las del pooler: con el session pooler eso da `EMAXCONNSESSION`. Las dos cosas van juntas; cambiar una sola rompe.
- Las migraciones contra producción se corren a mano y también por el 5432 (`scripts/migrate.ts`). **Nunca** apuntar `DATABASE_URL` a producción para desarrollar ni para tests.
- **El esquema `public` está cerrado a la API REST de Supabase**: RLS activado en todas las tablas, sin políticas, y sin permisos para `anon` ni `authenticated`. La app no usa esa API —entra directo a Postgres como `postgres`, que es dueño de las tablas y no queda afectado por RLS—, así que no hay que crear políticas. Si se agrega una tabla nueva, **dejarla cerrada igual**.
- Los deploys salen solos al mergear a `main`. En el plan Hobby de Vercel, los deploys cuyo autor de commit no sea el dueño de la cuenta quedan bloqueados.

## Git y equipo
- Somos 3 (Juani, Lavi, Mati), cada uno con su asistente. Nada directo a `main`: una rama por tarea (`stock/filtros-precio`, `fix/reparto-perdida`, `chore/...`) y PR revisado por otra persona.
- Preferí tareas dentro de un solo módulo (`stock`, `ventas`, `caja`, `contactos`, `configuracion`) para no pisarse. Si hay que tocar `schema.ts`, `src/lib/` o `src/components/ui.tsx`, avisalo en el PR.
- Commits chicos, en español, en imperativo y describiendo el qué (ej.: "Agregar filtro por precio en stock").
- No commitear `.env*` (salvo `.env.example`), `.data/` ni datos reales de clientes.
