# Adaptación a Next.js y Vercel

## Cambio realizado

El servidor usa Next.js 16, Node.js 24 y la configuración estándar de Vercel. dev/build/start ya no ejecutan Vinext ni generan un Worker de Cloudflare. La compilación produce .next/routes-manifest.json. Se retiraron diez dependencias de ejecución/herramientas de Cloudflare y sus plugins; los archivos históricos quedan fuera del typecheck y del despliegue.

La interfaz, precios y reglas de negocio se conservan. La base usa SQLite local en .data/state o Turso mediante el SDK libSQL en producción. Los batches son transacciones atómicas y la aprobación comprueba la cantidad de filas modificadas. Las reglas de la base, incluidos triggers, mantienen bloqueada la numeración y evitan reservas parciales.

Los comprobantes locales son privados y no se sirven desde public/. En producción se usa Vercel Blob privado con carga directa, permisos limitados a un pathname por diez minutos, límite de 5 MB y sin sobrescritura. El servidor verifica pertenencia, formato, firma y tamaño antes de registrar la solicitud. Un conflicto conserva el Blob para permitir cambiar los números y reintentar sin volver a subirlo. Los objetos abandonados requieren reconciliación.

La dirección del participante se toma del encabezado que Vercel reemplaza en su borde; en local los encabezados de IP del cliente no se confían. Las cookies y la verificación de origen contemplan HTTPS de Vercel y los nombres de host del entorno local.

## Verificación realizada

- TypeScript pasó.
- Lint pasó sin errores, con dos advertencias de optimización de imágenes.
- 17 pruebas pasaron: reglas originales y pruebas adicionales del adaptador, rollback, filas modificadas y rechazo de almacenamiento efímero en Vercel.
- Flujo HTTP completo pasó en desarrollo y en next start compilado, incluyendo tamaño de 5 MB, concurrencia, reintentos, vencimientos, búsqueda, CSV, consulta privada, aprobación y cierre de sesión.
- Navegador Edge: celular de 360/390 px y escritorio, vista previa, datos conservados tras un error, reserva, aprobación, consulta, exportación y salida; sin errores JavaScript ni desbordes.
- next build pasó y produjo el manifiesto requerido por Vercel.
- Auditoría de dependencias: sin vulnerabilidades conocidas.
- Detector de secretos: sin patrones detectados en archivos publicables ni historial.
- Respaldo y recuperación de la base y comprobantes locales nuevos: pasaron. El estado anterior se conserva.

## Qué falta para abrir en producción

Crear y conectar Turso y Blob privado, configurar secretos propios de producción, aplicar las migraciones y verificar el flujo remoto completo. La carga directa a Blob y las transacciones remotas todavía requieren esa verificación real; las pruebas locales no acreditan que existan o estén configurados esos servicios. La aplicación rechaza operar en Vercel sin una base persistente, en vez de guardar datos en un disco efímero.

No se borraron datos de .wrangler ni respaldos anteriores. La base local de Next.js es nueva. Si hay participantes en la implementación anterior, migrarlos con comprobantes y verificar consistencia antes de abrir. Las instrucciones actuales están en README.md y PUBLICACION.md; AUDITORIA.md conserva el informe histórico.