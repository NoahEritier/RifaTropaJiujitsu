# Plan y resultados de pruebas del flujo
Fecha: 7 de octubre de 2026. Pruebas ejecutadas contra compilación de producción de Next.js, Edge y datos ficticios. No se abrieron reservas públicas ni se guardó un ganador real.

## Plan ejecutado
| Paso | Prueba | Resultado |
| --- | --- | --- |
| 1 | Reserva, precios calculados por servidor, comprobante, aprobación, rechazo y consulta privada | Aprobado: API local y navegador. Compra de 4 números, $40.000; límites 1–100 y promociones por pares. |
| 2 | Reservas simultáneas, reenvíos, privacidad y acceso | Aprobado: un único dueño por número; reenvío idempotente; conflicto revierte todos los números. Cookie segura, sesión revocada al salir, origen y límites de ingreso. |
| 3 | Sorteo definitivo, ensayos y persistencia | Aprobado: 99 aprobados no habilitan; 100 habilitan. Dos pedidos simultáneos devuelven un resultado, persiste al recargar, no permite repetir ni reabrir. Ensayos no escriben un ganador. |
| 4 | Escritorio y celular, exportación y respaldo | Aprobado en Edge 1365 px y celulares 360/390 px. CSV, conservación de selección/archivo ante 503, recuperación local con hashes, 100 participantes y ganador. |
| 5 | Servicios reales y publicación cerrada | Turso real: migraciones, reservas/aprobaciones y sorteo dentro de transacción revertida; producción queda sin pruebas. Blob privado real: carga directa de comprobante de 5 MB desde navegador, lectura autenticada y limpieza de archivo. Verificación del despliegue posterior registrada al finalizar. |

## Casos y evidencia
- 20 pruebas unitarias aprobadas; typecheck y build aprobados. Lint: cero errores y dos avisos existentes de imágenes.
- API: numeración 00–99 y 1–100; bloqueo tras primera solicitud; precios manipulados ignorados; rechazar/vencer libera pendientes y conserva aprobados; filtros, resúmenes y CSV; privacidad de códigos, datos y archivos.
- Browser: formato falso y tamaño excesivo rechazados, vista previa, formulario conservado ante error, carga, reserva, aprobación, consulta y salida; cero errores JavaScript observados.
- Compras múltiples: 3 = $32.000; 4 = $40.000; 99 = $992.000; 100 = $1.000.000. Selección de 100 números en celular de 360 px sin desborde. Cada par $20.000 y un suelto $12.000. Cálculo compartido por interfaz/servidor y comprobado por trigger SQL; reserva indivisible si cualquier número está ocupado.
- Respaldo local final: `backups/2026-10-07T13-48-18-459Z`, recuperado sobre estado QA aislado y comprobado. También se verificó un respaldo anterior con comprobante y todos sus hashes.
- Capturas locales ignoradas por Git: `.sites-runtime/qa/`. Bases aisladas: `.data/qa-final/state` y `.data/qa-blob/state`.
- Turso se probó primero con 100 solicitudes y luego con una solicitud de 100 números, aprobación, snapshot y prevención de segundo ganador; rollback completo en ambos casos.

## Fallos encontrados y corregidos
1. La rueda rotada generaba desborde horizontal en celular: contenedor limitado; nueva prueba aprobada.
2. La carga directa a Blob terminaba, pero fallaba la lectura posterior por selección automática de credenciales: lectura/borrado usan explícitamente la credencial privada configurada. Flujo real repetido y aprobado.
3. Actualizadas dependencias vulnerables `sharp` a 0.35.5 y `source-map-js` a 1.2.2. Excepciones de antigüedad limitadas a esas versiones de seguridad.

## Pendientes y límites
- Auditoría de producción (`pnpm audit --prod --audit-level=high`): sin vulnerabilidades conocidas. Auditoría completa: **una alerta alta pendiente** en `braces@3.0.3`, dependencia de herramientas ESLint. El registro aún no publica 3.0.4; [el aviso del proveedor indica que no hay versión corregida](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). No se ignoró el aviso; `security:audit` y la etapa correspondiente de CI seguirán fallando hasta corregirlo.
- Falta alias y titular reales para abrir. Las pruebas usan datos ficticios únicamente en bases aisladas o transacciones no confirmadas.
- El recorrido con Blob real utilizó servidor compilado local y base QA; no equivale a una compra pública completa con Vercel Functions y Turso juntos. Repetir un envío controlado en un entorno remoto aislado antes de habilitar participantes.
- Recuperación local verificada. Recuperación de un respaldo de producción en recursos remotos aislados pendiente; seguir `docs/PUBLICACION.md`. Un CSV no sustituye ese respaldo.
- Separar recursos de Preview de producción. No se crearon cuentas ni planes pagos durante estas pruebas.
- Transferencia bancaria y entrega del premio requieren revisión humana de Damian Zubiri.

## Repetir las pruebas
Crear una **base vacía y cerrada** bajo `.data/qa-*` con `LOCAL_DATA_DIR`, ejecutar `node scripts/local-setup.mjs` y arrancar `next start` con `ALLOW_LOCAL_DATA=1`, sin credenciales Turso/Blob para las pruebas locales. No usar datos de participantes.
1. `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run secrets:check`, `pnpm run build`.
2. `TEST_BASE_URL` y `LOCAL_DATA_DIR` deben apuntar al mismo servidor/base. Ejecutar `node tests/api-smoke.mjs`.
3. Ejecutar `node tests/browser-smoke.mjs` con Playwright y Edge/Chromium disponibles; acepta `PLAYWRIGHT_MODULE_PATH` y `BROWSER_EXECUTABLE`.
4. Ejecutar `node tests/draw-smoke.mjs` sobre QA vacía: deja una rifa ficticia terminada, cuyo ganador es inmutable. Para repetir, usar otra carpeta QA.
5. Para Blob real: conservar SQLite QA aislado, configurar credencial privada Blob en el servidor y proceso de test, y `QA_REMOTE_BLOB=1`. La prueba elimina su objeto al finalizar; comprobar limpieza si se interrumpe.
6. Detener el servidor antes de `scripts/local-backup.mjs create/restore`; configurar `LOCAL_PORT` al puerto de pruebas.
