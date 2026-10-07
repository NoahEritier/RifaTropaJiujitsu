# Rifa Tropa Jiu Jitsu

Aplicación Next.js para 100 números, selección de uno o dos, comprobantes privados y aprobación manual de pagos. Un número cuesta $12.000 y dos $20.000; el servidor calcula el importe y la base protege la numeración y las reservas simultáneas.

## Instalación local

Requisitos: Node.js 24 y pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm run local:setup
pnpm run dev
```

Abrir http://127.0.0.1:5173 y /admin. La clave está en `.env.local`, nunca en Git ni en el navegador del participante. El instalador reutiliza la clave anterior de `.dev.vars` si existe. La base SQLite y los comprobantes están en `.data/state/`, fuera de public/.

No hace falta Docker ni una cuenta externa para desarrollar. En local no configurar TURSO_DATABASE_URL ni BLOB_READ_WRITE_TOKEN: esas variables activan los servicios remotos. Las reservas empiezan cerradas. Completar alias, titular, WhatsApp con país, fecha, mecanismo, premio opcional, condiciones y plazo; confirmar 00–99 o 1–100 antes de abrir. La primera solicitud bloquea esa numeración permanentemente.

## Uso y seguridad

La elección visual no bloquea un número. La reserva completa se confirma mediante una transacción; si hay un conflicto no se guarda una reserva parcial. Un envío repetido usa el mismo identificador y código privado. Los pagos aprobados conservan sus números; los pendientes vencidos se liberan al consultar disponibilidad o gestionar solicitudes.

Los comprobantes JPG, PNG y PDF admiten hasta 5 MB. Se validan tamaño, MIME y firma del archivo en el servidor. En Vercel se cargan directamente a un Blob privado mediante un permiso limitado a un archivo y con vencimiento; la función recibe solamente datos pequeños, vuelve a verificar el archivo y registra la reserva. El código permite consultar el estado en /consulta sin revelar nombre ni teléfono.

Administración usa cookies HttpOnly/SameSite, sesiones de cuatro horas, protección de origen, límite persistente de intentos, búsqueda, filtros, aprobación/rechazo y CSV. Los comprobantes se descargan únicamente con sesión autorizada. Un comprobante no acredita por sí solo un pago: la organización verifica la transferencia.

## Verificación

```sh
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run security:audit
pnpm run secrets:check
pnpm run build
```

Con el servidor local iniciado y una base vacía/cerrada, `node tests/api-smoke.mjs` prueba el flujo HTTP y elimina sus datos ficticios. `node tests/browser-smoke.mjs` requiere Playwright y Chromium/Edge; admite PLAYWRIGHT_MODULE_PATH y BROWSER_EXECUTABLE. No ejecutar estos flujos contra una base real con participantes.

Para probar la compilación local: detener desarrollo, ejecutar `pnpm run build` y `pnpm start`. Definir ALLOW_LOCAL_DATA=1 sólo en esa terminal local. En Vercel siempre se exige base persistente; no existe fallback a archivos efímeros.

## Respaldo y recuperación local

Detener el servidor y ejecutar `pnpm run backup`. Se copia la base completa y los comprobantes, con un manifiesto de hashes y la versión del lockfile, a backups/. Recuperar con `pnpm run restore -- backups/NOMBRE`, usando las mismas dependencias. La herramienta verifica integridad y conserva el estado anterior en `.data/previous-*`.

Los respaldos antiguos de Cloudflare continúan preservados en backups/ y `.wrangler/`. No son intercambiables con el formato de datos de Next.js; no borrarlos ni restaurarlos sobre `.data/`. Esta adaptación crea una base local nueva y no mueve ni elimina datos anteriores. Si la base anterior contiene participantes, migrarlos y comprobar cada comprobante antes de abrir la nueva.

## GitHub y Vercel

Repositorio: https://github.com/NoahEritier/RifaTropaJiujitsu. Proyecto Vercel: noaheritiers-projects/rifa-tropa. La configuración vercel.json usa Next.js y `next build`; genera `.next/routes-manifest.json` que el despliegue anterior no producía.

Para producción hacen falta Turso (SQLite persistente), Vercel Blob **privado**, una ADMIN_KEY aleatoria propia de producción y las migraciones. Ver [docs/PUBLICACION.md](docs/PUBLICACION.md). No subir `.env*`, `.dev.vars`, `.data`, `.wrangler`, `.vercel`, respaldos ni CSV reales. `.env.example` es el único archivo de ejemplo publicable.

El código de Cloudflare/Sites que permanece en build/, scripts/ y vite.config.ts es histórico: no participa de dev/build/start y sus dependencias fueron retiradas. No ejecutar esos scripts. La configuración activa está en Next.js y los scripts de setup, migración y respaldo.
## Ruleta en Administración
La ruleta permite ensayar la animación sin guardar un ganador. El sorteo definitivo requiere 100 números con pago aprobado; el servidor elige con aleatoriedad criptográfica, guarda el ganador y la lista de números participantes en una transacción y cierra reservas. No puede repetirse ni borrarse desde la aplicación. El resultado se recupera al recargar y puede copiarse para WhatsApp. Aplicar las migraciones antes de desplegar esta versión.

Compras de 1 a 100 números: cada par cuesta $20.000 y cada número suelto $12.000. El importe se calcula también en el servidor y se valida en la base. Si hay conflicto con cualquiera de los números elegidos, se revierte la reserva completa.

Ver [plan y resultados del flujo](docs/PRUEBAS-FLUJO.md), incluidos límites y pendientes de producción.
