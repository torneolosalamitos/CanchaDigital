# Plan tecnico: Box Lombardo Toledano

## Diagnostico de la arquitectura actual

CanchaDigital es una aplicacion web HTML/CSS/JavaScript sin framework. El estado global vive en `js/app-state.js` y usa `currentTorneo`, `currentCat` y el objeto `C` como cache de datos. La navegacion esta en `js/navigation.js`; Firebase se inicializa en `js/firebase-boot.js`; los listeners de Firestore/Realtime Database estan en `js/firebase-sync.js`; autenticacion y permisos legacy se aplican en `js/app-bootstrap.js`.

El modelo actual esta orientado a torneos y categorias. Los torneos conocidos son `lombardo_toledano` y `nuevos_valores`; la equivalencia con Firestore se maneja con `APP_TORNEO_TO_FIRESTORE` y `FIRESTORE_TORNEO_TO_APP`. Los datos deportivos existentes usan colecciones planas como `equipos`, `partidos`, `inscripciones`, `pagos`, `ventas`, `gastosTienda`, `trabajadores`, `gastosTrab`, `temporadas` y `mercadotecnia`, cada documento con campos de alcance `torneo`, `cat`, `torneoId` y `categoriaId`.

Los permisos actuales viven en `usuarios/{uid}` con `role` (`admin`, `captain`, `viewer`) y `adminScope` por torneo/categoria. Los propietarios se identifican por correo en `OWNER_EMAILS`. La UI oculta secciones con `admin-only`, pero las reglas en `tools/firestore-rules-production.rules` tambien validan escrituras por `adminScope`. Las reglas actuales permiten lectura global amplia, por lo que el modulo Box debe agregar un bloque mas estricto bajo `businesses/{businessId}`.

WhatsApp esta implementado en `functions/index.js` con `sendWhatsAppText`, webhook y flujos de pagos de inscripcion/arbitraje. La funcion ya usa variables de entorno y no expone credenciales al navegador. Los folios existentes se generan con IDs basados en tiempo en varios puntos; no hay servicio generico de folios para negocios.

## Archivos relevantes

- `index.html`: entrada, scripts, splash, header, nav, paginas legacy y modales.
- `css/styles.css`: sistema visual, botones, cards, tablas, formularios, responsive.
- `js/tournament-config.js`: catalogo actual de torneos.
- `js/app-state.js`: estado global, seleccion de torneo, permisos legacy y helpers Firestore.
- `js/navigation.js`: control de paginas.
- `js/firebase-sync.js`: listeners de colecciones planas.
- `js/app-bootstrap.js`: auth, roles, panel de usuarios.
- `functions/index.js`: backend WhatsApp y pagos por bot.
- `tools/firestore-rules-production.rules`: reglas Firestore preparadas para produccion.
- `firebase.json`: solo configura funciones actualmente.

## Problemas detectados

- El concepto de cliente/negocio no existe como entidad generica; todo gira alrededor de torneos.
- El selector inicial dice "torneo" y solo renderiza dos opciones.
- Los permisos son por torneo/categoria, no por negocio.
- Las finanzas legacy usan colecciones planas y algunos flujos permiten operaciones directas desde el cliente.
- Las reglas actuales permiten lectura general y no contemplan subcolecciones por negocio.
- `index.html` y algunos JS ya concentran muchas responsabilidades.
- No hay infraestructura de pruebas automatizadas declarada en `package.json`.

## Estrategia elegida

Se implementa una capa incremental de negocios sin migrar los torneos:

1. Agregar un catalogo `businesses` en frontend con los dos torneos como `type: "tournament"` y `box-lombardo-toledano` como `type: "boxing_gym"`.
2. Mantener `currentTorneo` y las colecciones planas para futbol.
3. Crear un contexto de negocio activo solo para el nuevo box.
4. Renderizar navegacion y paginas Box dinamicamente desde un modulo nuevo para no agrandar mas `index.html`.
5. Guardar datos del box bajo `businesses/{businessId}/{subcollection}`.
6. Crear funciones backend para operaciones financieras criticas: seed, cargos mensuales, pagos, entregas y comprobantes.
7. Preparar reglas Firestore por membresia/rol en negocio.
8. Mantener la vista publica del box sin datos privados.

## Modelo de datos

Raiz:

```text
businesses/{businessId}
businesses/{businessId}/members/{memberId}
businesses/{businessId}/guardians/{guardianId}
businesses/{businessId}/prospects/{prospectId}
businesses/{businessId}/groups/{groupId}
businesses/{businessId}/sessions/{sessionId}
businesses/{businessId}/attendance/{attendanceId}
businesses/{businessId}/billingPeriods/{periodId}
businesses/{businessId}/charges/{chargeId}
businesses/{businessId}/payments/{paymentId}
businesses/{businessId}/cashDeliveries/{deliveryId}
businesses/{businessId}/expenses/{expenseId}
businesses/{businessId}/cashClosings/{closingId}
businesses/{businessId}/physicalAudits/{auditId}
businesses/{businessId}/inconsistencies/{inconsistencyId}
businesses/{businessId}/notifications/{notificationId}
businesses/{businessId}/auditLogs/{auditLogId}
businesses/{businessId}/settings/{settingId}
```

El documento `businesses/box-lombardo-toledano` contiene configuracion base: mensualidad 400 MXN, zona horaria `America/Mazatlan`, metodo habilitado `cash`, limite de una clase de prueba, textos publicos, estados y categorias de gasto.

Los permisos se leen desde `usuarios/{uid}.businessRoles.{businessId}` o desde propietario global. Roles previstos: `owner`, `box_admin`, `trainer`, `auditor`.

## Fases de implementacion

- Fase 0: auditoria tecnica y plan.
- Fase 1: catalogo de negocios, selector, contexto Box, vista publica, permisos UI.
- Fase 2: alumnos, tutores, prospectos, grupos y expediente basico.
- Fase 3: asistencia movil, clase de prueba, cierre de sesion y auditoria fisica basica.
- Fase 4: periodos, cargos, pagos en efectivo, folios y comprobantes.
- Fase 5: entregas de efectivo, diferencias y gastos.
- Fase 6: dashboard, cortes, reportes, inconsistencias y auditoria.

## Riesgos

- Las reglas actuales de lectura publica pueden exponer mas de lo deseable si no se despliega la nueva version de reglas.
- La UI legacy depende de variables globales; por eso el Box debe aislarse en paginas y listeners propios.
- Sin emuladores configurados localmente, las reglas y funciones solo pueden validarse por sintaxis en esta sesion.
- Si `firebase.functions()` no esta disponible en hosting, el modulo debe mostrar error claro y no registrar pagos criticos desde cliente.

## Criterios de aceptacion del MVP

- Box Lombardo Toledano aparece en el selector inicial.
- Los torneos existentes siguen usando su flujo actual.
- El panel Box valida permiso por negocio antes de mostrar datos privados.
- Se pueden registrar prospectos, alumnos, tutores, grupos y asistencia.
- Se pueden generar cargos mensuales y registrar pagos en efectivo mediante backend.
- Los pagos quedan pendientes de entrega y pueden agruparse en entregas.
- Otro usuario autorizado puede confirmar entregas y registrar diferencias.
- Se pueden registrar gastos sin borrado definitivo.
- El dashboard muestra indicadores calculados desde datos reales cargados.
- Las acciones criticas generan auditoria.
- Quedan reglas, indices, seed y pruebas manuales documentadas.
