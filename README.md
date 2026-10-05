# Mi Agenda

Aplicación web local, esquema V1. Node 24.

```sh
npm ci
npm run dev
npm run check
```

Desarrollo: `/miagenda/`. IndexedDB: `miagenda`, datos separados por usuario.
CloudKit y autenticación reales pendientes de configuración externa; adapters y mocks incluidos.
CI y Pages preparados localmente. Pages solo por ejecución manual futura.

## Backups locales

En Ajustes → Datos y recuperación se puede exportar ZIP o JSON e importar ambos.
El ZIP contiene un único `backup.json` en formato V2; también se conservan las importaciones JSON V1/V2.
Incluye plantillas, planificación, preferencias y papelera, con sus identificadores y clocks.
El formato de datos y las reglas de combinar/reemplazar siguen siendo los existentes.

ZIP usa compresión nativa cuando está disponible y resulta más pequeña; en otros navegadores se exporta sin compresión.
La importación admite ese contenedor de una entrada, almacenada o deflate, con un máximo de 20 MB de JSON descomprimido.
Valida estructura, nombre, tamaño, CRC y checksum del backup antes de presentar la vista previa.
No admite ZIP cifrado, ZIP64, múltiples entradas ni contenedores modificados con comentarios o descriptores de datos.
Si el navegador no admite descompresión, se puede extraer `backup.json` e importar el JSON.

Reemplazar requiere `REEMPLAZAR` y primero inicia la descarga de una copia ZIP de los datos actuales.
El navegador no permite comprobar que el usuario haya guardado esa descarga en disco.
Los backups contienen los datos de la agenda, sin credenciales, cursores ni outbox.
