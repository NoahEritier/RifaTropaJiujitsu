# Auditoría e implementación · 1 de octubre de 2026

Se revisaron el código propio de la rifa, rutas públicas/privadas, esquema y migraciones, configuración de ejecución, scripts, Git y dependencias. Se comprobaron tipos, lint, compilación, restricciones de SQLite/D1, flujo HTTP y navegador real. Esto no equivale a una auditoría externa de la plataforma de hosting.

## Resultado de los 15 puntos

| Punto | Resultado local y verificación |
| --- | --- |
| 1. Auditoría | Corregidos los riesgos de concurrencia de numeración, reenvíos sin identidad, autenticación, vencimiento y cargas limitadas por el framework. Dependencias con avisos actualizadas. Pendientes de producción al final de este informe. |
| 2. GitHub | Remoto existente verificado. README, .gitignore, .gitattributes y GitHub Actions preparados. Escaneo de archivos publicables e historial sin claves detectadas. No se realizó commit, push ni modificación de la audiencia pública. |
| 3. Entorno local | Dependencias instaladas; D1 y R2 emulados inicializados y persistentes en .wrangler/state. ADMIN_KEY aleatoria en .dev.vars. Página ejecutándose en 127.0.0.1:5173. |
| 4. Datos del sorteo | Alias, titular, WhatsApp, fecha, mecanismo, condiciones del premio opcional y participación configurables. La apertura exige completarlos. Datos reales todavía pendientes. |
| 5. Numeración | 00–99 o 1–100 antes de recibir solicitudes. Bloqueo en panel, API y triggers de base, incluso si las solicitudes luego vencen o se rechazan. Probados ambos rangos y el bloqueo. |
| 6. Selección | Estados con colores, marcas y etiquetas accesibles. Selección, datos y comprobante conservados ante errores. Ocupaciones nuevas se marcan y pueden retirarse explícitamente. Botones de al menos 44 px de alto y cinco columnas en teléfonos pequeños. |
| 7. Precios | $12.000 por uno y $20.000 por dos; calculados en servidor y comprobados por la base. Probado enviar total=1 desde el cliente: el servidor registra el importe correcto. |
| 8. Duplicados | Solicitud y números se insertan en una transacción, con unicidad por número. Dos conexiones y dos envíos HTTP simultáneos dejan una sola reserva completa. Reenvíos idénticos devuelven la misma solicitud; código diferente o datos alterados no la reutilizan. |
| 9. Comprobantes | JPG/PNG/PDF, límite de 5.000.000 bytes, firma y MIME, límite de cuerpo leído. Vista previa y progreso XHR, mensajes de red/tamaño/formato. Probadas carga válida de exactamente 5 MB y rechazo de archivos mayores/falsificados. |
| 10. Seguridad | Sesión de cuatro horas, cookies HttpOnly/SameSite=Strict y Secure en HTTPS, cierre que revoca la sesión. Cinco intentos por IP cada 15 minutos, estado persistido en D1. Origen validado en escrituras; datos/comprobantes/CSV privados. Cabeceras contra incrustación y detección de MIME. |
| 11. Administración | Búsqueda por nombre, teléfono y número; filtros; paginación de 50 registros; importes y conteos sobre toda la base. Se conserva el historial de números liberados. Probado resumen tras aprobar/rechazar/vencer. |
| 12. Vencimiento | Plazo de 1–720 horas, por defecto 48. Vencimiento fijado por solicitud; cambios sólo para nuevas. Pendientes vencidos liberados antes de las operaciones, sin liberar aprobados. Probado impedir aprobar después de vencer. |
| 13. Consulta privada | Código de 256 bits generado con Web Crypto; sólo se guarda su SHA-256. Consulta por POST, sin códigos en URL ni nombres/teléfonos/comprobantes en la respuesta. Probados pendiente, aprobada, vencida y código desconocido. Espera a que la interfaz esté lista antes de permitir enviar. |
| 14. CSV y respaldo | CSV completos de participantes, números y pagos, con protección contra fórmulas. Respaldo local conjunto D1/R2 con hashes, comprobación de versión y conservación del estado anterior al recuperar. Creación, recuperación y rechazo de un manifiesto alterado comprobados. |
| 15. Apertura pública | Navegador real en escritorio de 1365 px y móviles de 360/390 px. Flujo de reserva, comprobante, error/reintento, aprobación, consulta, exportación y salida probado. Build del Worker generado y flujo HTTP probado en él. Publicación remota pendiente de datos, recursos/secretos y decisión de apertura. |

## Hallazgos corregidos

- El chequeo de numeración en la API podía competir con una reserva iniciada al mismo tiempo. Triggers de SQLite ahora impiden guardar una nueva numeración tras la primera solicitud e impiden insertar tickets fuera del rango confirmado.
- El reintento original sólo comparaba el UUID. Ahora exige el código privado y una huella de nombre, teléfono, números y contenido del archivo; no devuelve una solicitud a quien conoce únicamente su ID.
- El panel enviaba la clave larga en cada request y no limitaba intentos. Ahora intercambia la clave por una cookie de sesión, borra la clave del estado del formulario y limita intentos mediante actualizaciones atómicas en D1.
- Antes no existían vencimiento, consulta privada ni exportación. Se agregaron con protección de acceso e historial.
- Actualizar la grilla borraba números elegidos y podía esconder el error del formulario. La selección permanece y el conflicto se muestra explícitamente.
- La primera prueba con archivos grandes detectó que Vinext inspecciona multipart antes del handler y aplicaba un tope de 1 MB. Se configuró el tope del framework por encima de 5 MB, manteniendo el límite estricto de la aplicación. Se probó el límite real, no sólo la validación del input.
- La prueba del navegador detectó que el formulario de consulta podía enviarse antes de terminar la inicialización del cliente. Ahora el campo y el botón esperan la disponibilidad de la interfaz.
- En Windows, la vista previa compilada requería un import con URL file: y la ruta absoluta del archivo de secretos. scripts/start-local.mjs lo resuelve sin copiar claves a dist ni pasarlas como valores de argumentos.
- Había avisos en Next.js y dependencias transitivas, y también en herramientas de desarrollo. Se fijaron parches compatibles en package.json, pnpm-workspace.yaml y pnpm-lock.yaml. La auditoría final completa reportó **0 info, 0 bajas, 0 moderadas, 0 altas y 0 críticas**. Es el estado consultado durante esta revisión, no una garantía permanente.

El aviso crítico original de Next.js correspondía a generación de imágenes con next/og; la aplicación no usa esa funcionalidad con datos de participantes, pero se actualizó de todas formas. Referencia: [GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j).

## Evidencia

- npm run typecheck: pasó.
- npm run lint: pasó sin errores; quedan dos advertencias de optimización de img, usadas para el afiche y la vista previa privada del comprobante.
- npm test: 13 pruebas pasaron, incluyendo una carrera real entre conexiones SQLite.
- node tests/api-smoke.mjs: pasó contra el servidor de desarrollo y el Worker compilado, con participantes ficticios eliminados al finalizar.
- node tests/browser-smoke.mjs: pasó en Edge headless; sin errores JavaScript y sin desborde horizontal en los tamaños probados.
- drizzle-kit generate: no hay cambios de esquema pendientes; las migraciones existentes corresponden al esquema actual.
- npm run build: pasó, artefacto en dist/.
- npm run secrets:check: sin patrones de claves detectados en archivos publicables ni historial. El archivo de compilación tsconfig.tsbuildinfo dejó de estar rastreado.
- Respaldo completo: creado y recuperado; el estado anterior se conserva. La restauración de un manifiesto deliberadamente alterado se rechazó sin reemplazar los datos.

Las pruebas de flujo usan una base local vacía, no acreditaciones reales. El código de los participantes de prueba y sus comprobantes no quedan en Git. Las capturas están en .sites-runtime/qa/, también ignorado.

## Límites y pendientes concretos

1. Completar los datos reales del sorteo y confirmar numeración/plazo desde Administración. La configuración inicial queda en 1–100, 48 horas y reservas cerradas.
2. Subir los cambios revisados a GitHub y verificar su CI en el remoto. Este trabajo prepara los archivos y sus comprobaciones locales; no realiza un push automáticamente.
3. Configurar una ADMIN_KEY independiente en producción, desplegar mediante Sites, aplicar migraciones sobre los recursos reales y comprobar el acceso público/privado allí. No se cambió la audiencia de ningún sitio ni se habilitaron reservas.
4. Antes de abrir, tener un respaldo de producción que incluya D1 y R2 y comprobar su recuperación en un entorno aislado. El script incluido respalda el emulador local con las mismas versiones; no administra la cuenta del hosting.
5. La transferencia sucede fuera de la aplicación. Dos personas pueden transferir mientras observan el mismo número: la reserva en la base sólo se concede a una. Los avisos explican que elegir no bloquea. La organización debe resolver transferencias de solicitudes rechazadas, vencidas o que perdieron una carrera; no hay reintegros bancarios automáticos.
6. D1 y R2 no tienen una transacción común. Ante un resultado incierto de escritura, se conserva el comprobante para evitar perder uno asociado a una solicitud confirmada. Reconciliar objetos sin referencia siguiendo docs/PUBLICACION.md antes de borrarlos.
7. Vinext sigue siendo beta. Mantener las versiones fijadas y repetir el flujo multipart, sesiones y consultas tras cualquier actualización.
8. Si se migra una base antigua, las pendientes existentes reciben 48 horas desde su creación. Las solicitudes previas no tenían código privado: su UUID anterior no habilita la nueva consulta. Tampoco se pueden reconstruir números de solicitudes antiguas ya rechazadas si sus tickets fueron borrados antes de esta migración. Los registros nuevos sí conservan los números originales.
9. La validación de comprobantes verifica firmas, MIME y límites, y su entrega es privada como descarga. No confirma la acreditación ni analiza el archivo con un antivirus. La aprobación continúa a cargo de la organización.

No se enviaron mensajes a participantes ni se efectuaron pagos, publicaciones o cambios de audiencia.