# Box Lombardo Toledano: permisos

## Ubicacion

Los permisos por negocio viven en:

```text
usuarios/{uid}.businessRoles.box-lombardo-toledano.role
```

Roles soportados:

- `superadmin`: se deriva por correo propietario en backend/reglas.
- `owner`: acceso completo al negocio.
- `box_admin`: operacion completa del box, excepto privilegios globales.
- `trainer`: alumnos asignados, asistencia, clases de prueba, pagos recibidos y entregas propias.
- `auditor`: lectura/reportes/auditoria sin escritura operativa.

Los permisos legacy `role` y `adminScope` siguen funcionando para torneos y categorias.

## UI

`js/business-context.js` expone:

- `getBusinessRole`
- `canAccessBusinessAdmin`
- `canWriteBusinessOperations`
- `canManageBusinessMoney`
- `canAccessBusinessPage`

`js/navigation.js` delega paginas `box-*` a esos helpers.

## Backend

`functions/index.js` valida cada callable con `assertBoxPermission`.

Reglas principales:

- `boxGenerateMonthlyCharges`, `boxCreatePayment`, `boxPrepareCashDelivery`, `boxConfirmCashDelivery` y `boxSendPaymentReceipt` validan autenticacion y rol.
- Un entrenador no puede confirmar su propia entrega.
- Los montos de entrega se recalculan en servidor.
- Los saldos de cargo se actualizan por transaccion.
- WhatsApp puede fallar sin revertir el pago.

## Firestore Rules

`firestore.rules` y `tools/firestore-rules-production.rules` bloquean escritura directa en:

- `charges`
- `payments`
- `cashDeliveries`
- `cashClosings`
- `notifications`
- `settings`

Esas colecciones se modifican por backend con Admin SDK.

El cliente puede crear/actualizar datos operativos no financieros criticos segun rol:

- `members`
- `guardians`
- `groups`
- `sessions`
- `attendance`
- `expenses`
- `physicalAudits`
- `inconsistencies`
- `auditLogs` solo como create, sin update/delete.

No hay deletes definitivos para pagos, asistencias, gastos, entregas ni auditoria.

## Asignacion de roles

El modulo `Personal y permisos` permite que un propietario asigne roles Box a usuarios existentes. La asignacion se audita en `auditLogs`.
