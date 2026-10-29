# MVP — Especificación funcional (v1)

Sistema de gestión para un salón de compra-venta de autos usados: **contactos, stock, ventas, caja, patrimonio y reparto de ganancias**. Lo usan 3 personas con el mismo rol (más, a futuro, inversores con acceso de consulta). Es web, responsive (se usa también desde el celular) y está en la nube.

Mockup de referencia: [`docs/mockup/index.html`](mockup/index.html).

---

## 1. Reglas de negocio confirmadas

### 1.1 Vehículos
| ID | Regla |
|---|---|
| V1 | El auto se identifica por **patente (dominio)**. Si no tiene (0 km), por chasis. |
| V2 | **Tipos de ingreso:** `COMPRA` (el salón o un inversor pone la plata), `PERMUTA` (entra como parte de pago de una venta) y `CONSIGNACION` (un particular deja el auto para que el salón lo venda **sin comprarlo**; el salón le hace una diferencia). |
| V3 | Al ingresar queda **POR_INGRESAR**. Pasa a **DISPONIBLE** solo con los papeles obligatorios recibidos y el **peritaje APTO**. Si el peritaje es NO_APTO, queda **RECHAZADO**. |
| V4 | **Papeles obligatorios:** título, formulario 08 firmado, cédula, informe de dominio, VTV, verificación policial y libre deuda de patentes y multas. VTV y verificación policial tienen **vencimiento**. Cada papel registra quién lo recibió y cuándo, y puede llevar un **comprobante adjunto** (opcional). |
| V9 | **Auto prendado:** se marca como tal y se registra el detalle de la prenda. Suma un papel obligatorio, **cancelación de prenda**, que solo se le pide a los prendados. Sin ese papel no pasa a DISPONIBLE. |
| V5 | **Estados:** POR_INGRESAR → DISPONIBLE → RESERVADO → VENDIDO → ENTREGADO, más RECHAZADO y BAJA. La **ubicación** (salón, chapista, alistaje, mecánico, otro) va aparte del estado. |
| V6 | Cada auto tiene un **financista**: un inversor o el propio salón. También se registra **"lo ingresó"**, la persona o empresa que trajo el negocio. Es un dato informativo y no cobra comisión. |
| V7 | **Tipo de cambio:** se usa siempre el **dólar blue**, que **se fija al ingresar el auto**. Ese valor vale para toda la operación, incluidos los gastos. Al vender se registra el blue del día solo como referencia. El blue del día se trae solo de dolarapi.com y se puede cargar o corregir a mano; **un valor cargado a mano no se pisa**. |
| V8 | El precio de compra puede cargarse en **USD o en $**. El sistema guarda los dos valores con el TC fijado. |

### 1.2 Costo, precio y reparto
Sea **C** el costo total en $, **P** el precio de venta y **G = P − C** la ganancia.

| ID | Regla |
|---|---|
| R1 | **Costo** = valor de compra + Σ gastos del auto. En consignación, valor de compra = **monto pactado con el dueño**. El **costo del peritaje** entra como un gasto más del auto. Los gastos los pone **siempre el salón**, incluso en un auto de inversor (K9). |
| R2 | **Precio sugerido** = C × 1,15 + ajuste comercial (±). Se publica en $ y no se actualiza con el dólar. |
| R3 | **Financiado por un inversor:** si G ≥ 15 % de C, el inversor cobra **7,5 % de C** y el salón cobra el resto (su 7,5 % más el sobreprecio). Si G < 15 % de C, incluida una venta con pérdida, **mitad y mitad**. Esto reparte **solo la ganancia**: el capital que puso el inversor se le devuelve aparte (K10). |
| R4 | **Financiado por el salón** o **consignación:** el salón se queda con el **100 %** de G. |
| R5 | La comparación en dólares (C en USD al TC fijado contra P en USD al blue de la venta) es **solo informativa**. **Alerta** cuando el margen en USD de un auto en stock baja a ≤ 10 %. |
| R6 | Al cerrar la venta, la **liquidación se congela**. Los gastos que aparezcan después son **gastos extraordinarios del salón** y no la modifican. |
| R7 | **Gastos de venta** (transferencia, gestoría, sellado, flete…): se suman a **lo que paga el cliente**, no al costo del auto ni a la ganancia, así que **no entran en el reparto**. Al cerrar quedan como cuentas a pagar. |

### 1.3 Venta
| ID | Regla |
|---|---|
| S1 | **Embudo:** DATO → PREVENTA (tiene una operación abierta) → CLIENTE (compró). |
| S2 | La operación pasa por PREVENTA → SEÑADA → CERRADA → ENTREGADA, o CAÍDA. |
| S3 | **Seña:** pone el auto en RESERVADO. Si la operación se cae, la seña se **devuelve** (egreso de caja) o **queda para el salón** (ingreso del salón, no se reparte). |
| S4 | **Formas de pago combinables:** efectivo, transferencia, crédito bancario (queda a cobrar hasta que el banco liquida) y usado en permuta (crea un auto nuevo POR_INGRESAR y **no pasa por caja**). |
| S5 | La operación se **cierra** cuando Σ formas de pago = **total de la operación** (precio del auto + gastos de venta, R7). Al cerrar se genera la liquidación y el reparto pendiente de pago. |
| S6 | La **fecha y hora de entrega** define desde cuándo multas y patentes son del comprador. |
| S7 | **Consignación vendida:** se genera una **cuenta a pagar al dueño** por el monto pactado. |
| S8 | **Entrega programada:** se puede comprometer fecha, hora y lugar de entrega. Salta una alerta **3 días antes** con lo que falte terminar (venta sin cerrar, saldo sin cubrir, plata a cobrar, papeles faltantes o auto sin ingresar). Mientras la operación esté abierta se puede **quitar una forma de pago** ya cargada; una vez cerrada no, por R6. |

### 1.4 Caja y patrimonio
| ID | Regla |
|---|---|
| K1 | **Una sola caja, en pesos**, con dos medios: efectivo y banco. No hay caja en dólares. **Caja y Patrimonio son pantallas separadas:** Caja muestra solo la plata líquida; Patrimonio, lo invertido en autos, las cuentas y los inversores. La caja puede tener plata que no es del salón (K11). |
| K2 | En la caja solo entra **plata líquida**. |
| K3 | **Patrimonio total** = caja + autos propios en stock al costo (los financiados por el salón y por inversores; **no** los consignados) + cuentas a cobrar − cuentas a pagar. Es todo lo que hay, sea del salón o de los inversores, y se muestra **abierto por dueño** (K11). |
| K4 | **Arranque:** se importa el stock (patrimonio inicial). La caja inicial se carga después como **ingreso extraordinario**. Las deudas y créditos con terceros se cargan más adelante como cuentas pendientes. |
| K5 | Los **retiros de ganancia** y los **pagos a inversores** se registran **por venta**. |
| K6 | La **subcaja del inversor** muestra, por inversor: lo que puso en los autos que tiene en stock (al **valor de compra**, sin los gastos, que son del salón), el **capital por cobrar** de autos ya vendidos, y las ganancias pendientes y cobradas. El inversor ve solo lo suyo (T2). |
| K7 | **Personas (socios y empleados):** los **sueldos** y los **retiros** se atribuyen a una persona. El sueldo la exige; los retiros y aportes la admiten. No necesitan usuario en el sistema. |
| K8 | **Vista en dólares:** un botón convierte todos los importes de pantalla al blue del día. Es **solo presentación**: los datos siguen guardados en pesos, los formularios se cargan en pesos y el dólar fijado en cada compra (V7) no cambia. |
| K9 | **La compra del auto de un inversor no pasa por la caja del salón.** La paga el inversor directo al vendedor, así que no genera egreso ni cuenta a pagar: es plata suya, no un gasto del salón. Los **gastos** del auto (chapa, alistaje, gestoría) sí los pone el salón y los recupera al vender, porque el capital que se le devuelve al inversor es solo el **valor de compra** (K10). |
| K10 | **El capital del inversor en un auto suyo es el valor de compra**, sin los gastos. Cuenta igual si el auto entró **por permuta**: el usado que se toma en parte de pago de un auto del inversor se le acredita a él al valor de toma, porque es plata suya que volvía de esa venta y quedó puesta en otro auto. Si el usado es del salón, al cargarlo se le pone el salón como financista. La **consignación** nunca cuenta: ese auto no es de nadie del salón (K3). **Al cerrar la venta se le devuelve ese capital**, además de su parte de la ganancia (R3). Son dos cosas separadas: una **devolución de capital** y un **pago de ganancia**, cada una con su movimiento de caja. Si la venta dio pérdida, su parte es negativa y la reintegra: cobra el capital menos su mitad de la pérdida (R3). La devolución de capital **no es ganancia de nadie** y no aparece en el reporte de ganancias pagadas. |
| K11 | **Hay que distinguir lo que hay de lo que es del salón**, en Caja y en Patrimonio. **Caja del salón** = caja − lo que se les debe a los inversores por autos **ya vendidos** (capital + ganancia). Mientras el auto sigue en stock su capital **no** se descuenta de la caja, porque no está en la caja: está en el auto. **Patrimonio del salón** = patrimonio total − el capital de los inversores en stock − lo que se les debe. Lo que queda en la caja del salón es el profit de los dueños. |

### 1.5 Transversales
| ID | Regla |
|---|---|
| T1 | **Auditoría:** toda alta, modificación, baja y cambio de estado guarda usuario, fecha y hora, y valor anterior y nuevo. Se puede consultar por fecha, usuario o registro. |
| T2 | Todos los usuarios tienen el mismo rol (ADMIN). Rol **INVERSOR** de solo lectura: ve únicamente sus autos y su subcaja. |
| T3 | Se puede usar desde el celular. |

---

## 2. Módulos e historias de usuario

### M1 · Acceso y usuarios
- **HU-1.1** Como usuario quiero ingresar con mail y contraseña. *Criterio:* una sesión inválida redirige al login; la contraseña se guarda con hash.
- **HU-1.2** Como admin quiero crear usuarios (admin o inversor) y desactivarlos.

### M2 · Contactos y agenda
- **HU-2.1** Cargar un dato en menos de 30 segundos: nombre, teléfono, origen, **qué busca** (marca, modelo, años y presupuesto: se guarda como pedido, HU-2.4), **usado a entregar** (marca, modelo y año, más un detalle libre), calificación crediticia (monto y **banco elegido de una lista configurable**, con opción "Otro"), observaciones y próximo contacto. El próximo contacto **no es obligatorio**.
- **HU-2.2** Ver el embudo (datos, preventa, clientes) y filtrar por texto, origen, **marca y modelo** (lo que busca o lo que entrega), **banco que lo califica** y **monto que califica desde**.
- **HU-2.3** Registrar actividades (llamada, WhatsApp, visita) y ver la **agenda del día**.
- **HU-2.4** Registrar **pedidos** (marca, modelo, rango de años, presupuesto) y ver **qué autos del stock coinciden**.
- **HU-2.5** Importar contactos desde Excel o CSV.
- **HU-2.6** No se puede guardar un **seguimiento sin nota** ni un **pedido en blanco**: un pedido necesita al menos marca, modelo, año o presupuesto.

### M3 · Stock
- **HU-3.1** Ingresar un auto: patente, marca, modelo, versión, año, km, color, tipo de ingreso, financista, "lo ingresó", contacto de origen, valor de compra (USD o $), TC blue fijado y fecha.
- **HU-3.2** Checklist de papeles con quién y cuándo, y vencimientos.
- **HU-3.3** Peritaje: resultado, observaciones, 5 a 6 fotos comprimidas y **costo** (entra como gasto del auto, R1).
- **HU-3.4** Cargar gastos por categoría (chapa y pintura, alistaje, mecánica, gestoría, patente, multa, VTV, verificación, otros), pagados (salen de caja) o pendientes (cuenta a pagar).
- **HU-3.5** Ver el costo total, el precio sugerido, el ajuste, el precio publicado y el margen en USD.
- **HU-3.6** Listado con filtros (texto, marca, estado, ubicación, precio, días) y contadores por estado.
- **HU-3.7** Cambiar la ubicación y el estado, con historial.
- **HU-3.8** Importar el stock inicial desde el Excel "GENERAL".
- **HU-3.9** Marcar un auto como **prendado**, con su detalle, y exigirle la cancelación de prenda (V9).

### M4 · Ventas
- **HU-4.1** Crear una preventa desde un contacto y un auto DISPONIBLE.
- **HU-4.2** Registrar, devolver o retener una seña.
- **HU-4.3** Agregar formas de pago y ver la cobertura en tiempo real.
- **HU-4.4** Tomar un usado en permuta desde la operación (crea el auto POR_INGRESAR).
- **HU-4.5** Cerrar la venta y ver la liquidación (ganancia, base 15 %, sobreprecio, reparto y resultado en USD).
- **HU-4.6** Registrar la entrega con fecha y hora.
- **HU-4.7** Marcar la operación como caída, con motivo.
- **HU-4.8** Cargar **gastos de venta** que se suman a lo que paga el cliente (R7).
- **HU-4.9** Emitir la **preventa en PDF** para el cliente, con los datos del salón y la ficha de la unidad.
- **HU-4.10** Programar la entrega (fecha, hora y lugar) y ver el **calendario de entregas** (S8).

### M5 · Caja, patrimonio e inversores
- **HU-5.1** Registrar ingresos y egresos (gasto del salón, retiro de socio, pago a inversor, ingreso extraordinario, ajuste) por medio (efectivo o banco).
- **HU-5.2** Ver el saldo por medio, **cuánto de ese saldo es del salón** (K11) y la planilla de movimientos con filtros.
- **HU-5.3** Ver el patrimonio desglosado, en pantalla aparte de Caja (K1), con **el total y lo que es del salón** y abierto por dueño (K11).
- **HU-5.4** Ver y pagar lo **pendiente de cada venta cerrada** por beneficiario: la ganancia de cada uno y la devolución del capital al inversor (K10).
- **HU-5.5** Registrar el cobro de un crédito bancario (cancela la cuenta a cobrar e ingresa a caja).
- **HU-5.6** Cuentas pendientes: alta manual (deudas y créditos con terceros), pagos parciales y saldo.
- **HU-5.7** Subcaja por inversor: lo que puso en autos, el capital por cobrar y sus ganancias (K6).
- **HU-5.8** Administrar **personas** (socios y empleados) y registrar sueldos y retiros a nombre de cada una (K7).

### M6 · Alertas y dashboard
- **HU-6.1** Alertas: días en stock (30 y 60), papeles faltantes, vencimientos (15 días antes), margen USD ≤ 10 %, seña por vencer y agenda.
- **HU-6.2** Dashboard: avance de objetivos (unidades y ganancia), caja, patrimonio, alertas, agenda de hoy, ventas de los últimos 12 meses y rotación por modelo.
- **HU-6.3** Configurar objetivos por mes (unidades y ganancia) y parámetros (margen 15 %, umbrales).
- **HU-6.4** Cargar el dólar blue del día, a mano o trayéndolo de dolarapi.com (V7).
- **HU-6.5** Ver todos los importes **en dólares** con un botón, sin cambiar lo guardado (K8).

### M7 · Auditoría
- **HU-7.1** Ver el historial por registro (en la ficha) y global, con filtros por usuario, fecha y entidad.

### M8 · Reportes
- **HU-8.1** Por año: ganancias pagadas por mes (salón e inversores), sueldos y retiros por persona, e históricos de ventas, de movimiento de autos y de ingresos/egresos por tipo.

---

## 3. Fuera del MVP
Facturación electrónica (AFIP) · publicación en portales y redes · sucursales · comisiones de vendedores · financiación propia · conciliación bancaria.

*(La integración automática del dólar estaba acá y **se implementó** igual: hoy el blue se trae de dolarapi.com, ver V7 y HU-6.4.)*

## 4. Requisitos no funcionales
- Next.js (App Router) + TypeScript + PostgreSQL (Drizzle ORM). En desarrollo, PGlite; en producción, Supabase y Vercel.
- Fotos comprimidas en el cliente (máximo unos 300 KB cada una) en almacenamiento de objetos.
- Importes en `numeric(14,2)`; nunca en float.
- Backups diarios (Supabase).
- Interfaz en español (es-AR), formato `$ 1.234.567` y fechas `dd/mm/aaaa`. El nombre del contacto se **muestra** en mayúsculas; se guarda tal cual se escribió.
- **Usabilidad** (heurísticas de Nielsen):
  - Toda acción que **no se puede deshacer** (cerrar o dar de baja una venta, registrar la entrega, pagar o retirar una ganancia, dar de baja o rechazar un auto, quitar un pago o un gasto) pide **confirmación** en un diálogo que explica qué va a pasar. El foco arranca en "Cancelar".
  - **Búsqueda global** con Ctrl+K (o "/"): autos por patente, marca o modelo; contactos por nombre o teléfono; ventas por número, cliente o modelo. No distingue tildes ni mayúsculas. Incluye accesos rápidos a las tareas más comunes.
  - Los **filtros** de los listados se aplican solos al cambiarlos, y las filas de Stock y Ventas se abren con un clic en cualquier parte.
  - Al navegar se ve una barra de carga; si una pantalla falla o un registro no existe, se explica en criollo y se ofrece reintentar o volver.
  - Los términos del negocio que no son obvios (precio sugerido, margen en USD, ganancia base, sobreprecio) tienen una **ayuda** al lado.
- **Tema claro y oscuro**, a elección de cada usuario desde Configuración → Mi cuenta. Es preferencia personal: va en cookie, no en la base, y no se audita.
- El esquema de la base **no se expone** por la API REST de Supabase: RLS activado en todas las tablas y sin permisos para los roles públicos. La app entra directo a Postgres. Ver `AGENTS.md` → Producción.

## 5. Criterio de "listo" del MVP
Un usuario puede, desde el celular o la PC: cargar un contacto, ingresar un auto con papeles y peritaje, cargarle gastos, venderlo con seña, permuta y crédito, entregarlo, ver la liquidación y el reparto, pagar al inversor y ver la caja y el patrimonio actualizados, con todo registrado en la auditoría.
