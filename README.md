# Colombia Automotores — Sistema de gestión

Sistema web para la gestión de un salón de compra-venta de autos: contactos y agenda, stock, operaciones de venta, caja, patrimonio y reparto de ganancias.

## Estado
MVP completo en desarrollo local, listo para publicar (falta conectar Supabase y Vercel).

| Módulo | Qué hace |
|---|---|
| Inicio | Objetivos del mes, ganancia, caja, patrimonio, alertas, agenda, ventas de 12 meses y rotación por modelo |
| Contactos | Embudo dato → preventa → cliente, agenda, pedidos cruzados con el stock, importación |
| Stock | Ingreso (compra, permuta, consignación), papeles, peritaje con fotos, gastos, precio sugerido, alertas, importación |
| Ventas | Preventa, seña, formas de pago, permuta, cierre con liquidación y reparto, entrega, operación caída |
| Caja | Movimientos, patrimonio, ganancias por pagar, cuentas pendientes, subcaja por inversor |
| Configuración | Objetivos, margen y umbrales, inversores, usuarios, papeles y categorías |
| Historial | Quién cambió qué y cuándo, en todo el sistema |

**Roles:** administrador (acceso total) e inversor (solo consulta de sus autos y ganancias, en `/mi-inversion`).

## Mockup
Pantallas estáticas en HTML, sin dependencias. Los datos que muestran son de ejemplo.

| Pantalla | Archivo |
|---|---|
| Cómo funciona (recorrido completo) | [docs/mockup/index.html](docs/mockup/index.html) |
| Inicio / dashboard | [docs/mockup/dashboard.html](docs/mockup/dashboard.html) |
| Contactos y agenda | [docs/mockup/contactos.html](docs/mockup/contactos.html) |
| Stock | [docs/mockup/stock.html](docs/mockup/stock.html) |
| Ficha del auto | [docs/mockup/ficha.html](docs/mockup/ficha.html) |
| Operación de venta | [docs/mockup/venta.html](docs/mockup/venta.html) |
| Caja y patrimonio | [docs/mockup/caja.html](docs/mockup/caja.html) |

Para verlo, descargá el repositorio y abrí `docs/mockup/index.html` en el navegador. Las pantallas están enlazadas por el menú lateral.

## Especificación
- [docs/MVP.md](docs/MVP.md): reglas de negocio, módulos e historias de usuario del MVP.

## Stack
Next.js 15 (App Router) · TypeScript · Tailwind 4 · Drizzle ORM · PostgreSQL. En desarrollo se usa PGlite (Postgres embebido, sin instalar nada); en producción, Supabase y Vercel.

## Desarrollo local
```bash
npm install
cp .env.example .env.local   # completar SESSION_SECRET, SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD
npm run db:migrate           # crea la base local en ./.data/pglite
npm run db:seed              # datos base + usuario inicial
npm run dev                  # http://localhost:3000
```

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Tests de las reglas de negocio (`src/domain`) |
| `npm run db:generate` | Genera una migración a partir de `src/db/schema.ts` |
| `npm run db:migrate` | Aplica las migraciones (PGlite local o `DATABASE_URL`) |
| `npm run db:seed` | Carga datos base y el usuario inicial |

## Estructura
```
src/
  app/            pantallas (App Router); (app)/ = rutas con sesión
  db/             esquema y conexión
  domain/         reglas de negocio puras + tests
  lib/            sesión, auditoría, formatos
scripts/          migrate y seed
drizzle/          migraciones SQL
docs/             especificación y mockup
```
