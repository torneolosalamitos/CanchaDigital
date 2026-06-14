# Box Lombardo Toledano: pruebas

## Comandos ejecutables

Desde la raiz:

```bash
node --check js/business-context.js
node --check js/box/box-module.js
node --check functions/index.js
node -e "JSON.parse(require('fs').readFileSync('firebase.json','utf8')); JSON.parse(require('fs').readFileSync('firestore.indexes.json','utf8'))"
```

Para Firebase CLI en Windows PowerShell, usar `firebase.cmd` si `firebase.ps1` esta bloqueado por ExecutionPolicy:

```powershell
& "$env:APPDATA\npm\firebase.cmd" --version
```

## Pruebas manuales MVP

1. Abrir `index.html` o el hosting local.
2. Confirmar que aparecen:
   - Torneo Lombardo Toledano.
   - Torneo Nuevos Valores.
   - Box Lombardo Toledano.
3. Entrar a cada torneo y verificar tabla, partidos, equipos, inscripciones, resumen y navegacion legacy.
4. Entrar al Box sin sesion y confirmar que solo se ve la informacion publica y el formulario de preinscripcion.
5. Enviar una preinscripcion con consentimiento y verificar `businesses/box-lombardo-toledano/prospects`.
6. Iniciar sesion como propietario.
7. Entrar al Box y ejecutar `Inicializar`.
8. Crear un grupo.
9. Crear alumno con tutor.
10. Pasar asistencia desde viewport movil.
11. Registrar clase de prueba y repetirla para comprobar alerta de limite.
12. Generar cargos del periodo actual.
13. Registrar pago en efectivo desde un cargo con saldo.
14. Verificar que el cargo reduce saldo y el pago queda `pending_delivery`.
15. Preparar entrega con pagos pendientes.
16. Intentar confirmar entrega con el mismo usuario y confirmar que backend lo rechaza.
17. Confirmar entrega con otro usuario `owner` o `box_admin`.
18. Confirmar una entrega con diferencia y revisar `inconsistencies`.
19. Registrar gasto.
20. Revisar dashboard, reportes, comprobantes y auditoria.
21. Intentar leer/escribir Box con usuario sin `businessRoles` usando emulador de reglas.
22. Probar `boxSendPaymentReceipt` sin variables WhatsApp y confirmar que el pago permanece guardado.

## Pendientes de automatizacion

No existe infraestructura de tests en `package.json`. Se recomienda agregar pruebas de reglas con Firebase Emulator y pruebas unitarias ligeras para helpers de funciones en una siguiente iteracion.
