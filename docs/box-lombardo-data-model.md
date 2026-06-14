# Box Lombardo Toledano: modelo de datos

## Raiz del negocio

`businesses/box-lombardo-toledano`

Campos base:

```js
{
  id: "box-lombardo-toledano",
  name: "Box Lombardo Toledano",
  displayName: "BOX LOMBARDO TOLEDANO",
  type: "boxing_gym",
  status: "active",
  monthlyFee: 400,
  currency: "MXN",
  timezone: "America/Mazatlan",
  paymentMethodsEnabled: ["cash"],
  trialClassesAllowed: 1
}
```

## Subcolecciones

- `members`: alumnos. Incluye `businessId`, `folio`, datos personales, estado, grupo, mensualidad, descuentos, tutores, fechas y auditoria basica.
- `guardians`: tutores. Incluye telefonos, WhatsApp, consentimiento, alumnos asociados y usuario de registro.
- `prospects`: preinscripciones publicas con origen `public_form`, consentimiento y fecha de creacion.
- `groups`: grupos y horarios con entrenadores, dias, horario, capacidad y estado.
- `sessions`: sesiones de entrenamiento cerradas o corregidas.
- `attendance`: asistencia por alumno/sesion, estado, estado de pago al momento y usuario capturista.
- `billingPeriods`: periodos mensuales, por ejemplo `2026-06`.
- `charges`: cargos por alumno/periodo. El ID es idempotente: `{period}_{memberId}`.
- `payments`: pagos en efectivo creados por backend. No deben borrarse.
- `cashDeliveries`: entregas de efectivo preparadas y confirmadas por backend.
- `expenses`: gastos exclusivos del box.
- `cashClosings`: reservado para cortes cerrados.
- `physicalAudits`: conteos fisicos contra lista digital.
- `inconsistencies`: alertas revisables.
- `notifications`: comprobantes WhatsApp e intentos.
- `auditLogs`: auditoria reutilizable.
- `settings`: contadores, categorias, metodos habilitados y configuracion operativa.

## Funciones backend

- `boxSeedBusiness`: crea/actualiza configuracion inicial.
- `boxGenerateMonthlyCharges`: genera cargos mensuales sin duplicados.
- `boxCreatePayment`: registra pago en efectivo con folio, transaccion y saldo.
- `boxPrepareCashDelivery`: agrupa pagos pendientes para entrega.
- `boxConfirmCashDelivery`: confirma entrega, evita auto-confirmacion y registra diferencias.
- `boxSendPaymentReceipt`: envia o deja pendiente/fallido un comprobante por WhatsApp.

## Indices

`firestore.indexes.json` agrega indices para consultas por `businessId`, estado, periodo, fecha y entrega de efectivo en `members`, `charges`, `payments`, `attendance` y `expenses`.

## Seed seguro

El seed no se ejecuta automaticamente. Desde la UI del Box, un propietario puede usar `Inicializar`, o se puede llamar la callable `boxSeedBusiness` autenticado como propietario. No hace escrituras masivas ni borra datos.
