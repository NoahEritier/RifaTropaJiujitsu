# Publicar en Vercel

## Recursos

El proyecto rifa-tropa ya está conectado al repositorio GitHub NoahEritier/RifaTropaJiujitsu. Esta adaptación usa Next.js, Node.js 24, Turso y Vercel Blob privado. El código no crea recursos externos ni contrata planes.

1. Crear/conectar una base Turso (Starter si sus límites gratuitos alcanzan) al proyecto Vercel.
2. Crear un Blob store con acceso **private** y conectar únicamente a este proyecto. No usar almacenamiento público para comprobantes.
3. Configurar secretos: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, BLOB_READ_WRITE_TOKEN y ADMIN_KEY (al menos 32 caracteres aleatorios). Generar ADMIN_KEY independiente de desarrollo. No configurar ALLOW_LOCAL_DATA en Vercel.
4. Usar otra base y otro Blob store para previews que vayan a modificar datos. No conectar previews a los recursos de producción por comodidad.
5. Aplicar las migraciones antes de habilitar reservas, con credenciales en un archivo ignorado `.env.production.local`:

```sh
node --env-file=.env.production.local scripts/remote-migrate.mjs
```

El migrador usa un diario y una transacción por migración. No elimina tablas. Aplicarlo sobre una base nueva; una base antigua requiere respaldar y verificar el esquema antes de ejecutar modificaciones.

6. Desplegar y comprobar disponibilidad cerrada, acceso al panel, persistencia tras redeploy, carga privada de 5 MB, consulta, carrera entre reservas y cierre de sesión. La compilación por sí sola no comprueba los recursos remotos.
7. Completar los datos reales y confirmar numeración/plazo en Administración. Abrir reservas sólo después de verificar el flujo y la recuperación de un respaldo.

## Cargas y privacidad

La carga directa a Blob evita el límite de 4,5 MB de Vercel Functions. El permiso permite un solo pathname aleatorio, ligado al hash del código de solicitud, hasta 5 MB y por diez minutos; no permite sobrescribir archivos. El servidor vuelve a validar el contenido y su pertenencia a la solicitud. El Blob queda privado; el panel entrega su stream solamente después de validar la sesión.

Turso y Blob no comparten una transacción. Un archivo puede quedar sin reserva tras una carga abandonada o una respuesta incierta. No borrar objetos por edad sin comprobar referencias: reconciliar contra requests.receipt y conservar los asociados a cualquier solicitud. Un comprobante nunca sustituye la revisión bancaria.

## Respaldo de producción

Exportar la base Turso con la herramienta oficial y descargar todos los objetos privados referenciados por requests.receipt con credenciales del store. Guardar el conjunto cifrado fuera del repositorio, incluyendo esquema, migraciones, inventario y hashes. Un CSV no es un respaldo completo. Antes de abrir, restaurar la base y los objetos en recursos aislados y comprobar que las sesiones, estados, numeración y comprobantes sean consistentes. Nunca probar una restauración sobre producción.

## Documentación de proveedores

- [Turso JavaScript SDK y transacciones](https://tursodatabase.github.io/libsql-client-ts/)
- [Vercel Blob privado](https://vercel.com/docs/vercel-blob/private-storage)
- [Carga directa de Blob](https://vercel.com/docs/vercel-blob/client-upload)
- [Límites de Vercel Functions](https://vercel.com/docs/functions/limitations)