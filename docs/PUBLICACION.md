# Preparación de publicación

Las reservas quedan cerradas hasta completar los datos reales. El código está preparado para un Worker con bindings DB (D1), BUCKET (R2 privado) y ADMIN_KEY (secreto). El manifiesto .openai/hosting.json conserva el project_id existente.

## Publicar con Sites

1. Confirmar que el proyecto de Sites pertenece a la cuenta correcta y revisar el sitio y su audiencia actuales. Mantener la audiencia privada mientras se configura el sorteo.
2. Subir primero los cambios revisados al repositorio de GitHub y comprobar el resultado de los controles de .github/workflows/ci.yml. Este trabajo prepara los archivos localmente; no realiza un push automáticamente.
3. Configurar una clave aleatoria de producción de al menos 32 caracteres como ADMIN_KEY mediante los secretos/variables privados de Sites. No reutilizar .dev.vars ni incluir claves en Git, en hosting.json o en vars del artefacto.
4. Mediante el flujo de Sites, compilar y guardar una versión del proyecto existente con sus migraciones. El artefacto generado en dist/ contiene el Worker, archivos públicos y .openai/drizzle. Los bindings lógicos del manifiesto se reemplazan por los recursos del sitio.
5. Aplicar las migraciones en orden: 0000_early_nico_minoru.sql y 0001_secure_reservations.sql. En una base existente aplicar sólo la segunda si la primera ya figura como aplicada. No importar el estado .wrangler local ni recrear tablas de producción. Hacer un respaldo antes de migrar datos existentes.
6. Desplegar esa versión con audiencia privada y verificar que DB, BUCKET y ADMIN_KEY estén disponibles. El build y las pruebas locales no confirman el despliegue remoto.
7. Desde /admin, completar alias, titular, WhatsApp, fecha, mecanismo, premio opcional, condiciones, numeración y plazo. Guardar con reservas cerradas.
8. Verificar en ese entorno el ingreso, descarga privada de comprobantes y consulta. Comprobar las cabeceras de seguridad y que las peticiones públicas no permitan obtener nombres, teléfonos ni comprobantes.
9. Cambiar la audiencia a pública cuando se decida habilitar el acceso y activar las reservas desde Administración. Hacer una prueba de apertura supervisada sin inventar transferencias reales.

La publicación no se realizó como parte de la preparación. Antes de habilitar faltan los datos comerciales definitivos, una clave independiente de producción, el despliegue/migración remotos y la comprobación del flujo en ese entorno.

El framework utilizado, Vinext 1.0.0-beta.5, es una versión beta. Mantener el lockfile, ejecutar las pruebas antes de actualizar y repetir especialmente la carga multipart y el manejo de sesiones en cada cambio del framework.

## Respaldos de producción y recuperación

Los CSV del panel permiten seguimiento, pero no incluyen todos los campos internos ni archivos. Se requiere un respaldo conjunto de D1 y R2.

Con Sites, coordinar el respaldo/restauración de los recursos del sitio mediante su plataforma. Esta sesión no tiene identificadores reales de D1/R2 ni acceso de administración de la cuenta Cloudflare; no asumir que el marcador de wrangler.local.json identifica esos recursos.

Si se administran directamente los recursos de la cuenta Cloudflare:

1. Cerrar las reservas y suspender las aprobaciones durante el respaldo para mantener un corte consistente.
2. Registrar el commit y la versión publicada. Obtener los identificadores reales de la base y el bucket desde la cuenta, no desde el archivo local.
3. Exportar D1 como SQL con la herramienta de Cloudflare y registrar el punto de recuperación disponible. D1 ofrece Time Travel; verificar su ventana para el plan utilizado.
4. Copiar todos los objetos y su metadata del bucket privado R2 a un destino privado separado usando las herramientas autorizadas de esa cuenta. D1 Time Travel no recupera por sí solo los archivos R2.
5. Guardar un manifiesto con claves de objetos, tamaños, tipos y hashes. Proteger el SQL, el manifiesto y los objetos como datos personales. Mantener ADMIN_KEY separada.
6. Recuperar primero en recursos nuevos/aislados: restaurar D1 y todos los objetos R2 con las mismas claves del respaldo; asignar esos recursos a una versión privada del sitio.
7. Comprobar conteos por estado, importes y correspondencia entre tickets y solicitudes. Descargar comprobantes de muestra con Administración; verificar que no haya reservas duplicadas ni pagos aprobados sin números.
8. Sólo después cambiar los bindings del sitio o promover la versión verificada. Conservar el estado anterior para volver atrás y mantener las reservas cerradas durante el cambio.
9. Revocar sesiones restauradas y configurar de nuevo una clave de producción independiente. La restauración de base también puede restaurar sesiones antiguas; cambiar ADMIN_KEY las invalida.

Referencias oficiales:
- [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
- [Comandos D1, exportación e importación](https://developers.cloudflare.com/d1/wrangler-commands/)
- [R2: herramientas de acceso a objetos](https://developers.cloudflare.com/r2/objects/)

## Operación

La expiración se procesa en cada operación de disponibilidad, reserva, consulta o Administración. No requiere un trabajo programado: después del plazo un número nunca se ofrece como pendiente vigente a un nuevo participante. Si no hay actividad, la marca de estado se actualiza con la siguiente operación.

Revisar pendientes antes del vencimiento. Si un participante transfirió pero su solicitud venció o fue rechazada, resolver el dinero directamente con él: el sistema no envía reintegros ni vuelve a asignarle automáticamente números ocupados por otra persona.

D1 y R2 no comparten una transacción. Si la escritura en la base falla con resultado incierto, se conserva el objeto de comprobante para evitar perder un archivo de una solicitud que sí pudo registrarse. Para reconciliar, comparar las claves receipts/ de R2 con requests.receipt: revisar y respaldar los objetos sin referencia antes de eliminarlos. No borrar por antigüedad los comprobantes de pagos aprobados.

Definir quién administra, dónde se guardan los respaldos y cuándo se eliminan los datos personales tras terminar la rifa. La aplicación no realiza por sí sola esa eliminación ni envía mensajes por WhatsApp.