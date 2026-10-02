# Rifa Tropa Jiu Jitsu · Dolores

Aplicación para una rifa de 100 números: Smart TV Noblex 50″ o premio opcional de $500.000. Un número cuesta **$12.000**; dos cuestan **$20.000**. La organización confirma los pagos manualmente.

## Instalación en Windows, macOS o Linux

Requisitos: Node.js 24 LTS (mínimo 22.13 para la aplicación; las pruebas usan Node 24), Git y pnpm. El proyecto utiliza Vinext/React, Cloudflare D1 (SQLite) y R2. Para desarrollo, ambos servicios se emulan en la computadora: no se necesita una cuenta Cloudflare ni un servidor de base de datos.

1. Clonar este repositorio y entrar en la carpeta:
   ~~~sh
   git clone https://github.com/NoahEritier/RifaTropaJiujitsu.git
   cd RifaTropaJiujitsu
   ~~~
2. Si no hay pnpm, instalar la versión declarada en package.json:
   ~~~sh
   npm install --global pnpm@11.25.0
   ~~~
3. Instalar las versiones fijadas, crear la clave local y aplicar las migraciones:
   ~~~sh
   pnpm install --frozen-lockfile --prefer-offline
   npm run local:setup
   npm run dev
   ~~~
4. Abrir **http://127.0.0.1:5173**. Administración está en **/admin** y la consulta privada en **/consulta**.

La clave local se genera aleatoriamente en **.dev.vars**, campo ADMIN_KEY. Abrí ese archivo en tu editor para copiarla al ingresar al panel. No se muestra en logs, README ni código. Nunca compartas el archivo. .env.example contiene sólo un ejemplo, no una clave utilizable.

La base, los comprobantes y su metadata persisten juntos en **.wrangler/state/** y sobreviven al reinicio. No borrar esa carpeta: borrar su contenido elimina los datos locales. node_modules y .sites-runtime se pueden regenerar. Los datos locales son independientes de los de producción.

## Preparar y abrir el sorteo

Desde Administración completar:

- Alias y titular de la cuenta.
- WhatsApp con país y código de área, por ejemplo el formato numérico de WhatsApp.
- Fecha o condición de realización.
- Mecanismo para elegir al ganador y publicar el resultado.
- Condiciones del premio opcional: quién elige TV o efectivo y cómo se entrega.
- Condiciones de participación, pagos, rechazos y resolución de transferencias si una solicitud vence.
- Numeración **00–99** o **1–100**, y confirmación de esa elección.
- Plazo de reservas pendientes entre 1 y 720 horas (por defecto 48 horas).

Guardar y habilitar reservas sólo cuando la información sea definitiva. La aplicación exige todos estos datos antes de abrir.

La numeración se bloquea permanentemente al recibir la primera solicitud, incluso si después se rechaza o vence. Para organizar otra rifa, usar otra base/proyecto: no modificar manualmente el historial de una rifa existente. Cambiar el plazo sólo afecta a solicitudes nuevas.

El dinero del premio opcional y las características del televisor del afiche son los del proyecto actual; el campo de Administración permite definir sus condiciones, no sustituye la información del afiche.

## Reservas, pagos y privacidad

- Elegir uno o dos números no los bloquea. Se reservan al enviar el formulario con comprobante.
- El servidor valida números, datos y comprobante, calcula el importe y registra solicitud y números en una transacción.
- La clave única de cada número impide reservas duplicadas. Reintentar el mismo envío devuelve la misma solicitud; no genera otro pago ni otra reserva.
- Si falla el envío, se conservan datos, archivo y selección. Si otro participante ocupó un número, aparece un aviso para reemplazarlo.
- JPG, PNG y PDF: hasta **5.000.000 bytes** por archivo. Se verifican tamaño, firma y tipo, incluyendo el límite del cuerpo aunque no exista Content-Length. La página muestra vista previa y progreso.
- Guardar el código privado de 64 caracteres recibido. La consulta lo envía por POST, sin incluirlo en URL ni mostrar datos personales o comprobantes. Es un secreto de consulta: no compartirlo.
- Si se corta la conexión después de enviar, consultar ese mismo código antes de volver a transferir. El reintento debe conservar los datos del envío original.
- Administración usa sesiones de cuatro horas en cookies HttpOnly y SameSite=Strict (Secure en HTTPS). La clave no se guarda en el navegador. Cada dirección dispone de cinco intentos de ingreso por 15 minutos; cerrar sesión revoca el acceso.
- El panel permite buscar por nombre, WhatsApp o número, filtrar estados y revisar importes aprobados y pendientes. Hay paginación de 50 solicitudes, con resumen sobre toda la base.
- Sólo aprobar tras verificar la acreditación en la cuenta: adjuntar una imagen no prueba que el dinero se haya recibido.
- Rechazar libera los números. Las reservas pendientes vencen al llegar su plazo; se liberan antes de actualizar la grilla, consultar, reservar o administrar. Sin actividad, la marca se actualiza en la próxima operación. Los pagos aprobados no vencen.
- Los números originales permanecen en el historial aunque se liberen. No volver a aprobar una solicitud rechazada o vencida: resolver la transferencia con el participante.
- Los comprobantes se conservan privados en R2 y sólo se descargan con sesión de Administración. No habilitar una URL pública del bucket.

## Verificaciones

~~~sh
npm run typecheck
npm run lint
npm test
npm run secrets:check
npm run security:audit
npm run build
~~~

GitHub Actions ejecuta estos controles al subir cambios o abrir un pull request.

Las pruebas de negocio usan SQLite aislado, incluidas dos conexiones simultáneas. Para probar HTTP y navegador, usar exclusivamente una **base local vacía, con reservas cerradas**:

~~~sh
node tests/api-smoke.mjs
~~~

La prueba HTTP crea participantes ficticios, comprueba cargas de hasta 5 MB, reenvíos, carreras, aprobación, rechazo, vencimiento, consultas y CSV. Después elimina únicamente sus solicitudes y comprobantes y restaura la configuración.

tests/browser-smoke.mjs requiere Playwright y un navegador instalados. Puede recibir PLAYWRIGHT_MODULE_PATH (ruta a index.mjs de Playwright), BROWSER_EXECUTABLE y TEST_BASE_URL. Comprueba celular y escritorio, errores de carga, conservación del formulario, reserva, aprobación, consulta, exportación y cierre de sesión. No ejecutarla sobre una rifa con participantes. Las capturas quedan en .sites-runtime/qa/, fuera de Git.

## Exportación y respaldo

Desde el panel se pueden exportar **participantes, números y pagos** a CSV. Los importes están en pesos enteros y las fechas en ISO UTC. La exportación incluye todos los registros, independientemente del filtro de pantalla. Se escapan comillas y se neutralizan fórmulas de planillas. El CSV contiene datos personales: guardarlo con acceso restringido. No incluye los comprobantes ni los códigos privados; **no reemplaza un respaldo**.

Para un respaldo local completo:

1. Detener el servidor con Ctrl+C. Si se usa otro puerto, configurar LOCAL_PORT.
2. Ejecutar:
   ~~~sh
   npm run backup
   ~~~
3. Guardar la carpeta generada dentro de backups/ en otra ubicación privada. Contiene base y comprobantes, inventario y hashes SHA-256. Conservar también este commit, pnpm-lock.yaml y .dev.vars por separado y de forma privada.

Para recuperar:

1. Detener el servidor.
2. Copiar la carpeta del respaldo a backups/ de este proyecto.
3. Usar el mismo lockfile y versión de dependencias.
4. Ejecutar:
   ~~~sh
   npm run restore -- backups/NOMBRE-DE-LA-CARPETA
   npm run dev
   ~~~
5. Revisar configuración, reservas y descarga de comprobantes. La herramienta verifica hashes y conserva el estado anterior en .wrangler/previous-... antes de reemplazarlo. Si falla el reemplazo, restaura el estado anterior.

Son respaldos del emulador local, no exportaciones portables hacia producción. El procedimiento de producción está en [docs/PUBLICACION.md](docs/PUBLICACION.md).

## GitHub

El remoto origin ya apunta a **NoahEritier/RifaTropaJiujitsu**. .gitignore excluye claves, estado local, comprobantes, respaldos, dependencias y artefactos de compilación. Sólo .env.example puede publicarse como ejemplo.

Antes de subir:

~~~sh
npm run secrets:check
git status
git diff
~~~

No incluir .dev.vars, .env con valores reales, .wrangler, backups, comprobantes ni CSV de participantes. La detección por patrones revisa también el historial disponible, pero no puede garantizar encontrar todo secreto. Si una clave se publicó alguna vez, revocarla; borrarla del último commit no basta.

## Compilación y publicación

~~~sh
npm run build
npm start
~~~

npm start ejecuta el Worker compilado en loopback y comparte la misma persistencia local. Se necesita haber corrido local:setup. Puede usarse otro puerto con npm start -- --port 8787.

Este proyecto conserva el manifiesto de Sites .openai/hosting.json. Publicar mediante Sites, con D1 y R2 reales y ADMIN_KEY como secreto de producción. **wrangler.local.json es sólo para desarrollo**: el identificador de base es un marcador local, no una base de producción. No usarlo para desplegar.

Ver [docs/PUBLICACION.md](docs/PUBLICACION.md) para publicar y respaldar en producción, y [docs/AUDITORIA.md](docs/AUDITORIA.md) para los cambios, pruebas y límites de esta revisión.