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
| V4 | **Papeles obligatorios:** título, formulario 08 firmado, cédula, informe de dominio, VTV, verificación policial y libre deuda de patentes y multas. VTV y verificación policial tienen **vencimiento**. Cada papel registra quién lo recibió y cuándo. |
| V5 | **Estados:** POR_INGRESAR → DISPONIBLE → RESERVADO → VENDIDO → ENTREGADO, más RECHAZADO y BAJA. La **ubicación** (salón, chapista, alistaje, mecánico, otro) va aparte del estado. |
| V6 | Cada auto tiene un **financista**: un inversor o el propio salón. También se registra **"lo ingresó"**, la persona o empresa que trajo el negocio. Es un dato informativo y no cobra comisión. |
| V7 | **Tipo de cambio:** se usa siempre el **dólar blue**, que se carga a mano y **se fija al ingresar el auto**. Ese valor vale para toda la operación, incluidos los gastos. Al vender se registra el blue del día solo como referencia. |
| V8 | El precio de compra puede cargarse en **USD o en $**. El sistema guarda los dos valores con el TC fijado. |

### 1.2 Costo, precio y reparto
Sea **C** el costo total en $, **P** el precio de venta y **G = P − C** la ganancia.

| ID | Regla |
|---|---|
| R1 | **Costo** = valor de compra + Σ gastos del auto. En consignación, valor de compra = **monto pactado con el dueño**. |
| R2 | **Precio sugerido** = C × 1,15 + ajuste comercial (±). Se publica en $ y no se actualiza con el dólar. |
| R3 | **Financiado por un inversor:** si G ≥ 15 % de C, el inversor cobra **7,5 % de C** y el salón cobra el resto (su 7,5 % más el sobreprecio). Si G < 15 % de C, incluida una venta con pérdida, **mitad y mitad**. |
| R4 | **Financiado por el salón** o **consignación:** el salón se queda con el **100 %** de G. |
| R5 | La comparación en dólares (C en USD al TC fijado contra P en USD al blue de la venta) es **solo informativa**. **Alerta** cuando el margen en USD de un auto en stock baja a ≤ 10 %. |
| R6 | Al cerrar la venta, la **liquidación se congela**. Los gastos que aparezcan después son **gastos extraordinarios del salón** y no la modifican. |

### 1.3 Venta
| ID | Regla |
|---|---|
| S1 | **Embudo:** DATO → PREVENTA (tiene una operación abierta) → CLIENTE (compró). |
| S2 | La operación pasa por PREVENTA → SEÑADA → CERRADA → ENTREGADA, o CAÍDA. |
| S3 | **Seña:** pone el auto en RESERVADO. Si la operación se cae, la seña se **devuelve** (egreso de caja) o **queda para el salón** (ingreso del salón, no se reparte). |
| S4 | **Formas de pago combinables:** efectivo, transferencia, crédito bancario (queda a cobrar hasta que el banco liquida) y usado en permuta (crea un auto nuevo POR_INGRESAR y **no pasa por caja**). |
| S5 | La operación se **cierra** cuando Σ formas de pago = precio. Al cerrar se genera la liquidación y el reparto pendiente de pago. |
| S6 | La **fecha y hora de entrega** define desde cuándo multas y patentes son del comprador. |
| S7 | **Consignación vendida:** se genera una **cuenta a pagar al dueño** por el monto pactado. |

### 1.4 Caja y patrimonio
| ID | Regla |
|---|---|
| K1 | **Una sola caja, en pesos**, con dos medios: efectivo y banco. No hay caja en dólares. |
| K2 | En la caja solo entra **plata líquida**. |
| K3 | **Patrimonio** = caja + autos propios en stock al costo (los financiados por el salón y por inversores; **no** los consignados) + cuentas a cobrar − cuentas a pagar. |
| K4 | **Arranque:** se importa el stock (patrimonio inicial). La caja inicial se carga después como **ingreso extraordinario**. Las deudas y créditos con terceros se cargan más adelante como cuentas pendientes. |
| K5 | Los **retiros de ganancia** y los **pagos a inversores** se registran **por venta**. |
| K6 | La **subcaja del inversor** muestra por inversor su capital invertido en autos, las ganancias pendientes y las cobradas. |

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
- **HU-2.1** Cargar un dato en menos de 30 segundos: nombre, teléfono, origen, qué busca, usado a entregar, calificación crediticia (monto y banco), observaciones y próximo contacto.
- **HU-2.2** Ver el embudo (datos, preventa, clientes) y buscar por nombre o teléfono.
- **HU-2.3** Registrar actividades (llamada, WhatsApp, visita) y ver la **agenda del día**.
- **HU-2.4** Registrar **pedidos** (marca, modelo, rango de años, presupuesto) y ver **qué autos del stock coinciden**.
- **HU-2.5** Importar contactos desde Excel o CSV.

### M3 · Stock
- **HU-3.1** Ingresar un auto: patente, marca, modelo, versión, año, km, color, tipo de ingreso, financista, "lo ingresó", contacto de origen, valor de compra (USD o $), TC blue fijado y fecha.
- **HU-3.2** Checklist de papeles con quién y cuándo, y vencimientos.
- **HU-3.3** Peritaje: resultado, observaciones y 5 a 6 fotos comprimidas.
- **HU-3.4** Cargar gastos por categoría (chapa y pintura, alistaje, mecánica, gestoría, patente, multa, VTV, verificación, otros), pagados (salen de caja) o pendientes (cuenta a pagar).
- **HU-3.5** Ver el costo total, el precio sugerido, el ajuste, el precio publicado y el margen en USD.
- **HU-3.6** Listado con filtros (texto, marca, estado, ubicación, precio, días) y contadores por estado.
- **HU-3.7** Cambiar la ubicación y el estado, con historial.
- **HU-3.8** Importar el stock inicial desde el Excel "GENERAL".

### M4 · Ventas
- **HU-4.1** Crear una preventa desde un contacto y un auto DISPONIBLE.
- **HU-4.2** Registrar, devolver o retener una seña.
- **HU-4.3** Agregar formas de pago y ver la cobertura en tiempo real.
- **HU-4.4** Tomar un usado en permuta desde la operación (crea el auto POR_INGRESAR).
- **HU-4.5** Cerrar la venta y ver la liquidación (ganancia, base 15 %, sobreprecio, reparto y resultado en USD).
- **HU-4.6** Registrar la entrega con fecha y hora.
- **HU-4.7** Marcar la operación como caída, con motivo.

### M5 · Caja, patrimonio e inversores
- **HU-5.1** Registrar ingresos y egresos (gasto del salón, retiro de socio, pago a inversor, ingreso extraordinario, ajuste) por medio (efectivo o banco).
- **HU-5.2** Ver el saldo por medio y la planilla de movimientos con filtros.
- **HU-5.3** Ver el patrimonio desglosado.
- **HU-5.4** Ver y pagar las **ganancias pendientes** por venta y por beneficiario.
- **HU-5.5** Registrar el cobro de un crédito bancario (cancela la cuenta a cobrar e ingresa a caja).
- **HU-5.6** Cuentas pendientes: alta manual (deudas y créditos con terceros), pagos parciales y saldo.
- **HU-5.7** Subcaja por inversor.

### M6 · Alertas y dashboard
- **HU-6.1** Alertas: días en stock (30 y 60), papeles faltantes, vencimientos (15 días antes), margen USD ≤ 10 %, seña por vencer y agenda.
- **HU-6.2** Dashboard: avance de objetivos (unidades y ganancia), caja, patrimonio, alertas, agenda de hoy, ventas de los últimos 12 meses y rotación por modelo.
- **HU-6.3** Configurar objetivos por mes (unidades y ganancia) y parámetros (margen 15 %, umbrales).
- **HU-6.4** Cargar el dólar blue del día (para las alertas y la referencia).

### M7 · Auditoría
- **HU-7.1** Ver el historial por registro (en la ficha) y global, con filtros por usuario, fecha y entidad.

---

## 3. Fuera del MVP
Facturación electrónica (AFIP) · publicación en portales y redes · sucursales · comisiones de vendedores · financiación propia · integración automática del dólar · conciliación bancaria.

## 4. Requisitos no funcionales
- Next.js (App Router) + TypeScript + PostgreSQL (Drizzle ORM). En desarrollo, PGlite; en producción, Supabase y Vercel.
- Fotos comprimidas en el cliente (máximo unos 300 KB cada una) en almacenamiento de objetos.
- Importes en `numeric(14,2)`; nunca en float.
- Backups diarios (Supabase).
- Interfaz en español (es-AR), formato `$ 1.234.567` y fechas `dd/mm/aaaa`.

## 5. Criterio de "listo" del MVP
Un usuario puede, desde el celular o la PC: cargar un contacto, ingresar un auto con papeles y peritaje, cargarle gastos, venderlo con seña, permuta y crédito, entregarlo, ver la liquidación y el reparto, pagar al inversor y ver la caja y el patrimonio actualizados, con todo registrado en la auditoría.
