# Mi Agenda

Mi Agenda 1.1.0 RC — aplicación web/PWA local-first, esquema V1. Node 24.

Agenda local con tareas, recordatorios, eventos, notas, etiquetas, plantillas,
CmdK, captura rápida, Time Blocking, Radar y copias ZIP/JSON.
Firebase es opcional; los datos locales no se migran automáticamente a la cuenta Google.

```sh
npm ci
npm run dev
npm run check
```

Desarrollo: `/miagenda/`. IndexedDB: `miagenda`, datos separados por usuario.
Firebase se configura mediante variables de build; no incluye credenciales de usuario.
CloudKit real sigue pendiente de configuración externa.
CI valida cada push; Pages se despliega con el workflow manual.

La certificación Firebase y los runs anteriores comunicados por el usuario
corresponden al SHA `a48df5b17f1bdabe769737b5ad7bdaa5ea1f2d56`.
La preparación local de 1.1.0 está en `RELEASE_NOTES_1.1.md`. La certificación
automatizada no sustituye el smoke Firebase, notificaciones e iPhone físico.
El deploy y la publicación requieren una instrucción posterior explícita.
Consultar `docs/1.1-release-preparation.md`; `RELEASE_NOTES.md` conserva la historia de 1.0.0.

## Configurar Firebase para Pages

1. Crear el proyecto Firebase y registrar una aplicación web.
2. En Authentication, habilitar el proveedor Google y añadir `chollomaton.github.io` a Authorized domains.
3. Crear Cloud Firestore y desplegar las reglas de `firestore.rules` en ese proyecto antes de usar la sincronización.
4. En GitHub → Settings → Secrets and variables → Actions → Variables, crear las cuatro Repository Variables: `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID` y `FIREBASE_APP_ID`, con la configuración de la aplicación web. Usar el authDomain Firebase (`<proyecto>.firebaseapp.com`).
5. Ejecutar manualmente el workflow `Pages (manual)` y certificar en la web publicada el login Google, logout, aislamiento por usuario y sincronización Firestore.

El workflow fija `VITE_CLOUD_BACKEND=firebase` e inyecta esas variables como `VITE_FIREBASE_*` durante `npm run check` (incluido el build). Si faltan o son inválidas, el build compila y Firebase permanece `unavailable`.
El login usa popup sin scopes adicionales; cerrar o bloquear la ventana permite reintentar. La CSP permite conexiones Google APIs/Firebase, los frames de autenticación y los scripts de `https://apis.google.com` necesarios para el popup de Google; el SDK de Firebase sigue empaquetado.
El flujo canónico es npm (`npm ci`); `pnpm-lock.yaml` coexiste y se conserva, pero los workflows usan `package-lock.json`.

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
