# Validación local — 2026-09-26

Base real: miagenda-0.3.0-checkpoint.zip (React/TypeScript/Vite).
SHA-256 de la base: eae6f4ba2428f9a1ea5cc7ba3f32f7cae27f7c8d4819486629f312a9041b59c4
MI_AGENDA_WEB_CHECKPOINT_8.1.0-dev.2.zip no localizado; el historial recuperado carece de adjuntos y declara ese ZIP no disponible.

Implementado: SyncEngine queda vinculado a generation e identity de creación; evita reutilizar un motor antiguo tras cambiar de usuario. Sin cambios visuales ni de tooling.
Testeado: nueva regresión falla antes y pasa después; 117 pruebas afectadas pasan. npm run check final PASS: tipos, lint, 139 pruebas en 6 archivos, escáner (33 archivos, 0 hallazgos), build.
Validado: aislamiento del motor entre sesiones; suite existente cubre IndexedDB/outbox, clocks/merge, tombstones/restore, operationID, respuestas tardías, backup/rollback, fechas/DST y SW. Inspección dirigida, no certificación exhaustiva de todos los contratos del chat.
Entorno: dependencias locales reutilizadas del checkpoint anterior; versiones directas comprobadas contra package.json. No se ejecutó instalación limpia de red.
Pendiente: CloudKit real, pruebas manuales multidispositivo y despliegue. No se certifica RC/producción ni cero defectos fuera del alcance comprobado.

El ZIP contiene código, pruebas, lockfile y configuración; excluye node_modules, dist, .git y temporales.

## ZIP backup y certificación local — 2026-10-05

Base verificada: `/Users/carlos/Documents/Codex/miagenda`, rama `main`, HEAD
`d1d4d9baafb7a2a9f4af403e64d1f38821e621b9`, árbol limpio, sin remote.
El ZIP de esta mejora es un backup de datos; el ZIP mencionado en el informe histórico anterior es un checkpoint de código distinto.

Implementado: exportación ZIP estándar de una única entrada `backup.json`, con compresión nativa deflate-raw y fallback sin compresión; exportación JSON conservada; importación ZIP/JSON V1/V2 con el validador existente.
Los datos V2 mantienen plantillas, planificación, papelera, clocks, relaciones y checksum SHA-256 existentes, sin modificar dominio, esquema, persistencia ni Firebase.
La importación comprueba límites (20 MB de JSON), estructura y coincidencia de cabeceras, nombre exacto, CRC32 y checksum antes de mostrar una vista previa. Rechaza cifrado, ZIP64, múltiples entradas, symlinks, entradas inesperadas y formatos de contenedor fuera del alcance documentado.
Un archivo inválido borra la vista previa anterior; resultados tardíos tras desmontar controles se ignoran.
Exportar, previsualizar y cancelar no escriben datos. Combinar/reemplazar reutilizan las operaciones existentes. Reemplazar exige confirmación exacta e inicia la descarga de la copia ZIP antes del import; si esa preparación falla, no reemplaza.

Validación ejecutada con el runtime Node disponible y dependencias locales existentes, sin instalar dependencias:

- `vitest run tests/backup-zip.test.ts tests/backup-controls.test.tsx tests/core.test.ts tests/templates.test.ts tests/local-certification.test.ts tests/task-scheduling.test.ts tests/smoke.test.tsx`: 256 tests PASS en 7 archivos.
- Primera suite completa `vitest run`: 439 PASS y un timeout de 5 s en una prueba existente de `task-time-blocking-ui.test.tsx`. Reejecución aislada de ese archivo: 16 PASS.
- Suite completa final `vitest run --maxWorkers=2`: **440 tests PASS en 25 archivos**, incluyendo registry, CmdK, Quick Capture, Time Blocking, Templates, Radar, URL/keyboard, PWA, persistencia/rollback y aislamiento.
- `tsc --noEmit`: PASS.
- ESLint de archivos afectados y `eslint . --max-warnings 0`: PASS.
- `node scripts/security-scan.mjs`: PASS, 69 archivos, 0 hallazgos.
- `vite build` y `node scripts/build-shell.mjs`: PASS. Sigue el aviso de chunk mayor de 500 kB presente antes de esta mejora.
- Shell generado: assets bajo `/miagenda/`, manifest idéntico al público con los cuatro shortcuts y `service-worker.js`: PASS.
- Lector independiente Python `zipfile`: abre ZIP comprimido y almacenado, verifica una sola entrada, CRC y contenido UTF-8 idéntico. El test también usa el descompresor independiente de zlib.
- `git diff --check`: PASS.

Certificación **local automatizada** del alcance probado. No se realizaron instalación PWA/manual en navegadores, pruebas multidispositivo, Firebase real ni despliegue. La descarga de seguridad se inicia antes del reemplazo; las APIs del navegador no confirman su guardado efectivo en disco. Sin push.

## Intento de certificación manual Browser/PWA — 2026-10-05

### Base observada

Ruta de trabajo `/Users/carlos/Documents/Codex/miagenda`; rama `main`; HEAD
`61c6218616f958a4abb294bffedc660f04a4314b`; `git status --porcelain=v1`
vacío y `git remote -v` vacío antes de ejecutar checks. Coincide con la base
solicitada. La certificación automatizada de 440 tests de la sección anterior
es histórica; no se volvió a ejecutar esa suite en este intento.

### Bloqueo observado del navegador

No hay herramienta de interacción/inspección de navegador expuesta en esta sesión.
Chrome y Firefox están instalados. Un único intento de lanzar Chrome real con
Playwright disponible en el runtime local, perfil temporal independiente y
`headless: true`, abortó antes de poder abrir `about:blank`:
`browserType.launch: Target page, context or browser has been closed`.
El registro muestra proceso lanzado, terminación con `signal=SIGABRT` y
`exception while trying to kill process: Error: kill EPERM`.
La causa interna del aborto no está determinada; no se atribuye a la aplicación.
No se repitió el lanzamiento ni se cambió el perfil habitual del usuario.
No se llegó a abrir la app en un navegador ni a interactuar con su UI.

### Resultados manuales

- **Desktop browser: BLOCKED / PENDIENTE.** Sin resultados observados de arranque,
  Dashboard, Task crear/editar/completar/reabrir/eliminar/restaurar, Reminder CRUD,
  Event CRUD, Quick Note, Labels, CmdK abrir/cerrar/navegar/Enter/Esc/restaurar foco,
  Quick Capture parsear y llevar a editor, Templates crear/editar/usar/guardar,
  Time Blocking planificar/modificar/quitar y Day/Week, Radar counts/desplegar/abrir,
  URL actions new-task/new-reminder/new-event/today y limpieza de action,
  shortcuts teclado, ni exportación/lectura/importación segura de ZIP desde UI.
- **Responsive/mobile: BLOCKED / PENDIENTE.** No se visualizaron anchos 1280, 834,
  393. Pendientes a 393: navegación, overflow de modales/editor, touch targets,
  safe area/100dvh, calendario, Templates Settings, Time Blocking dialog,
  CmdK y Quick Capture.
- **PWA/offline: BLOCKED / PENDIENTE.** No se observaron instalación/standalone,
  shell offline después de visita previa, creación/edición offline, persistencia
  tras reload offline, reconexión ni actualización de SW conservando drafts/datos.
  Archivos generados correctos no demuestran estos comportamientos.
- **Multi-tab local: BLOCKED / PENDIENTE.** Sin dos pestañas reales no se observaron
  convergencia, locks ni ausencia de duplicación indebida de outbox.

### Checks complementarios realmente ejecutados

Con Node del runtime local y dependencias existentes, sin instalación:

- `tsc --noEmit`: PASS.
- `vite build`: PASS; persiste el aviso de chunk mayor de 500 kB.
- `node scripts/build-shell.mjs`: PASS.
- Inspección mediante assertions de archivos de build: PASS. Manifest distribuido
  idéntico al público; cuatro shortcuts con URLs esperadas; assets con base
  `/miagenda/`; iconos referenciados presentes; worker generado incluye shell
  index y manifest. Esto es comprobación de artefactos, no certificación PWA.
- `git diff --check`: PASS antes y después de actualizar este informe.

No se encontraron bugs de aplicación mediante interacción, porque esta quedó
bloqueada. No hubo fixes ni tests de regresión ni commit nuevo. HEAD sin cambios.
Único cambio versionado previsto al cerrar: este informe; árbol dirty por
`VALIDATION_REPORT.md`. Sin push, cambios de versión, tag, nuevas features,
certificación Firebase real ni production smoke.

### Siguiente paso mínimo: checklist manual en navegador externo

Servir el build con `vite preview --host 127.0.0.1` desde la ruta canónica y abrir
`http://127.0.0.1:4173/miagenda/` en Chrome con un perfil de pruebas aislado.
Ejecutar todos los elementos pendientes de las cuatro fases anteriores; usar
sólo datos sintéticos para export/import y ambas pestañas del mismo perfil/scope.
Para offline y update, conservar ese perfil entre visita, desconexión, reload,
reconexión y cambio del worker. Registrar resultado y evidencia por prueba;
instalación real y safe areas requieren además el dispositivo compatible.
La certificación Firebase real queda para después de cerrar estas fases y disponer
de proyecto/credenciales reales.

## Preparación release 1.0.0 — 2026-10-06

Gate inicial PASS: ruta canónica `/Users/carlos/Documents/Codex/miagenda`, rama `main`, HEAD y main remoto `a48df5b17f1bdabe769737b5ad7bdaa5ea1f2d56`, árbol limpio y sin tags remotos.
Los informes anteriores son históricos y no equivalen a un smoke sobre el nuevo SHA.
La certificación real Firebase y CI/Pages previos (37505823403 / 37505851186) son datos proporcionados por el usuario, no pruebas nuevas de esta sesión.
No hay blockers P0 abiertos documentados en los informes inspeccionados; las limitaciones de certificación manual siguen sujetas al gate de release.
Cambios limitados a versión de paquete/lock npm, metadata visible y de backup, README y notas; esquema V1 y comportamiento conservados. pnpm-lock.yaml no almacena la versión del paquete raíz y no necesita cambios.
### Validación nueva de esta sesión

- Runtime Node 24.19.0, npm 11.6.2; `npm ci` PASS (315 paquetes instalados). La salida de instalación anunció 5 vulnerabilidades altas.
- `npm run check` PASS: tipos, lint, **453 tests / 26 archivos**, security **69 archivos / 0 hallazgos**, build y generación del shell. Duración Vitest: 11.99 s.
- `git diff --check` PASS.
- Inspección independiente PASS: manifest distribuido idéntico al público, cuatro shortcuts con URLs esperadas, assets bajo `/miagenda/`, iconos presentes y worker generado con index/manifest. Esto no certifica ejecución offline.
- Búsqueda adicional de claves privadas, tokens GitHub/OpenAI, service accounts y claves API Google en archivos versionados y dist: 0 hallazgos. `.env.example` sólo contiene variables vacías. No se encontraron archivos privados/temporales entre los archivos versionados.
- Bundle CloudApp 663.77 kB (195.98 kB gzip): warning >500 kB, no error.
- `npm audit --json` adicional devolvió 16 hallazgos altos, 0 críticos, asociados a dos advisories transitivas de grpc-js y una de source-map-js, además de sus cadenas de dependencias. Esta respuesta difiere del conteo anunciado durante npm ci; se conserva el resultado de ambas operaciones. Alcance/explotabilidad pendientes de evaluación; no se ejecutó audit fix ni se cambiaron dependencias. El escáner del proyecto no sustituye esta revisión.

### Gate de publicación y smoke

**RELEASE BLOCKED.** No hay controles Computer Use/browser expuestos. Un intento con Playwright y Chrome real, perfil temporal independiente y headless, abortó al arrancar: `browserType.launch: Target page, context or browser has been closed`. No llegó a cargar producción. No se modificó el perfil habitual ni se ejecutaron flujos Firebase reales.
Carga limpia, agenda local, Task CRUD/complete/reopen/trash/restore, CmdK, Quick Capture, Templates, Time Blocking, Radar, exportación ZIP, Firebase login/sync/logout/relogin/persistencia, responsive desktop/393 y PWA/offline: **BLOCKED en el smoke nuevo**. Los tests automatizados PASS no reemplazan esta certificación.
El conector GitHub permite crear commit/actualizar main y consultar resultados. No expone dispatch del workflow manual Pages; git no tiene credencial HTTPS local disponible. No se deben reejecutar runs antiguos para certificar el nuevo SHA.
No se crean ZIP/SHA de distribución, tag ni GitHub Release mientras A–E no sean PASS. Se conserva FIREBASE TEST y no se modifican billing, schema ni migración.

## Gates seguridad y producción — 2026-10-06, sesión nueva

Gate 0 PASS: pwd canónico, rama main, HEAD inicial
`eaa32ca4be8ae490fe628e5ab0996e6bc474e14c`, árbol limpio y origin
`https://github.com/chollomaton/miagenda.git`. Main remoto vuelve a comprobarse
en ese SHA al cierre. HEAD final sin cambios; no commit ni push nuevos.

Seguridad A PASS para los 16 HIGH en runtime browser: tabla completa,
advisories, versiones instaladas, fixes raíz y límites en SECURITY.md.
Audit reproducido con npm 11.6.2: 16 HIGH/0 críticos; sin cambios de lockfile.
Build local de diagnóstico con sourcemaps PASS; grpc/source-map-js ausentes
de las 67 fuentes JS. No fixes aplicados. No se reejecuta la suite local por
cambio de código: no hubo cambios de código. Validación del mismo SHA en
Pages nueva: npm ci y npm run check PASS, 453 tests/26 archivos.

Deploy B PASS: iniciado por UI GitHub autenticada, Pages (manual) sobre main,
run [37512787091](https://github.com/chollomaton/miagenda/actions/runs/37512787091),
Success, 50 s, job 112437971801. SHA completo eaa32ca4be8ae490fe628e5ab0996e6bc474e14c.
Artefacto Pages 11435985076, digest
`e089e4c62bd520b8c1dee2cb6cb07c6e2a63cd9c1282e1933996605b35feaf06`.
Producción por HTTP: index-ocoSZ7Ez.js y CloudApp-C0Q_6BuD.js; UI 1.0.0.
Workflow sin cambios. gh no está instalado; no se buscaron ni expusieron tokens.

Smoke C **PARTIAL**, mediante navegador integrado local y Chrome local
conectado por extensión; no se lanzó Chrome cloud ni standalone Playwright.

| Prueba sobre producción nueva | Resultado observado |
| --- | --- |
| Carga limpia y agenda local | PASS; UI 1.0.0 con bypass temporal de SW/caché para excluir shell antiguo |
| Task crear/editar/completar/reabrir/eliminar/restaurar | PASS con tarea sintética Smoke 1.0.0 2026-10-06; notas persistidas y restauración a pendientes |
| CmdK + Quick Capture | PASS abrir CmdK, seleccionar captura, parsear mañana 2026-10-07 y llevar título/fecha al editor; cancelado sin crear |
| Templates básico | PASS crear/guardar Plantilla smoke 1.0.0 y usarla, editor precargado; cancelado sin crear tarea |
| Time Blocking básico | PASS planificar 2026-10-06 09:00, 60 min y comprobar persistencia al reabrir editor |
| Radar básico | PARTIAL; estado vacío mostrado, falta interacción con un vencimiento/solape real |
| Backup ZIP export | PARTIAL; botón accionado, sin alert/error observado, pero waitForEvent(download) agotó 20 s; archivo no verificado |
| Firebase | PARTIAL; Chrome muestra Cuenta Google, sincronización activada, 0 pendientes, FIREBASE TEST existente conservado. No se certifican sync/logout/relogin nuevos |
| Responsive desktop/393 | PASS básico: 1280 px, client/scroll 1265; 393 px, client/scroll 378. Editor móvil dentro del viewport, sin overflow horizontal; capturas inspeccionadas |
| Service worker/offline | PARTIAL; shell de inicio carga offline tras visita y cierre/reapertura para activar worker nuevo. Agenda completa después de recarga offline no certificada: apertura local no produjo estado verificable |

Las primeras cargas servían un shell antiguo (index-DDj3NKk4.js y metadata
0.3.0), con estados Firebase distintos. No se contaron como smoke nuevo.
No se purgaron caches ni datos privados. Bypass de SW/caché y red offline
fueron temporales y se restauraron; viewport también restaurado. Las
observaciones incompletas de descarga/offline no demuestran por sí solas un
bug de aplicación. Sin nuevas features, schema changes, billing ni migración.

Bloqueo explícito: revisión automática de aprobación rechazó el click
«Sincronizar ahora», al considerar que transmitiría datos de agenda sensibles
a la cuenta Firebase sin autorización específica del payload. No se eludió
el rechazo por otro medio. Logout/relogin del ciclo solicitado no realizados.

Mínimos pendientes en https://chollomaton.github.io/miagenda/ con UI 1.0.0:

1. Autorizar expresamente la sincronización de la agenda de la cuenta Google
   ya conectada con su mismo Firebase, sin migrar la agenda local; ejecutar
   sync, logout, relogin, reload y confirmar persistencia de FIREBASE TEST.
2. En agenda de pruebas con datos sintéticos: exportar ZIP, confirmar guardado
   y abrirlo con lector ZIP independiente; verificar backup.json/CRC.
3. Crear un vencimiento o solape sintético; desplegar Radar y abrir el item.
4. Cerrar pestañas de la app para activar SW nuevo, visitar 1.0.0, desconectar,
   recargar, abrir agenda local y comprobar la tarea persistida; reconectar.

Release D **BLOCKED por C incompleto**: no MiAgenda-1.0.0.zip, no SHA256 de
distribución, no tag v1.0.0, no GitHub Release. Tag local/remoto ausente.
Working tree final dirty únicamente por SECURITY.md y VALIDATION_REPORT.md.
Evidencia diagnóstica local ignorada en node_modules/.release-evidence/;
no incluye export de datos privados ni credenciales.

### Continuación con autorización — 2026-10-06

El usuario autoriza explícitamente sincronizar la agenda de la cuenta Google
con su mismo Firebase, sin migrar la agenda local. La acción «Sincronizar
ahora» se ejecuta sin nuevo rechazo; sigue mostrando 0 pendientes.
Logout PASS: la app vuelve a «Google: sesión cerrada». Relogin abre el
selector Google con varias cuentas; tras la respuesta «hecho» el popup
desaparece pero la app sigue signedOut, también después de reload.
Se reabre el login y se solicita identificar la misma cuenta; no se elige
una cuenta a ciegas ni se cambia ninguna credencial.

Radar básico ahora PASS: botón Hoy en el editor fija 2026-10-06 09:00,
se guarda, Radar muestra 1 vencidos/0 conflictos, se despliega y el resultado
abre el editor de la tarea sintética correcta.

Offline básico ahora PASS: recarga con red offline por CDP, shell de inicio
cargado, apertura local por UI, DOM confirma Mi Agenda Web 1.0.0 y la tarea
persistida con fecha/planning. Captura guardada y conexión restaurada.

ZIP export sigue PARTIAL: nuevos intentos por la API documentada de descarga
en navegador integrado y Chrome local agotan 10 s sin entregar ruta de archivo.
En Chrome se usa agenda local inicialmente vacía, con única tarea sintética
ZIP smoke 1.0.0; no se exporta la agenda Firebase ni se migra la local.
No se puede certificar archivo/CRC. La ausencia del evento en la herramienta
no demuestra por sí sola fallo de la app.

Pendientes actualizados: relogin con la misma cuenta y persistencia Firebase;
archivo ZIP exportado verificable. Seguridad/deploy permanecen PASS,
smoke PARTIAL y release bloqueada. HEAD intacto; sólo los dos informes dirty.

### Verificación de ZIP descargado — 2026-10-06

Gate 0 de esta continuación PASS: main, HEAD
`eaa32ca4be8ae490fe628e5ab0996e6bc474e14c`, cambios iniciales únicamente
en SECURITY.md y VALIDATION_REPORT.md; se conservan íntegramente.

Backup ZIP **PASS**: archivo real
`/Users/carlos/Downloads/mi-agenda-backup-2026-10-06 (2).zip`,
1014 bytes, abierto con lector independiente Python zipfile. Contiene
exactamente un backup.json, sin cifrado; testzip() confirma CRC íntegro.
JSON válido, MiAgendaBackupV2, formatVersion 2, schemaVersion 1,
applicationVersion 1.0.0; entityCount 1 coincide con los grupos.
Contiene la tarea sintética ZIP smoke 1.0.0 en fields.title. Checksum
interno SHA-256 coincide al serializar los grupos en el orden definido
en src/backup/backup.ts (tasks, subtasks, reminders, events, quickNotes,
labels, preferences, templates), sin espacios y en UTF-8. Inspección
recursiva sin claves outbox/cursor/cursors/quarantine/sessionToken/
recordChangeTag/accessToken/refreshToken/credentials/tokens.
SHA-256 del ZIP de backup:
`dd317249adc03b2093138fc650a1a369611528cf36c1225fe8ba939a99ecdb46`.
El backup permanece en Descargas; no se añade al repositorio ni a release.

Relogin **BLOCKED**: Chrome conserva el selector con varias cuentas;
la app muestra Google: sesión cerrada. No hay evidencia suficiente para
identificar la misma cuenta previa. Se solicita una única intervención:
seleccionar esa cuenta y responder hecho. FIREBASE TEST y sync posteriores
a relogin aún no verificados. Smoke final BLOCKED por ese único gate;
no commit de certificación, tag ni release mientras quede pendiente.

## Certificación final 1.0.0 — 2026-10-06

La confirmación manual nueva del usuario cierra el último gate pendiente:
relogin Firebase **PASS**. La captura descrita por el usuario muestra
`Cuenta Google · 0 cambios pendientes` y
`Sincronización con Firebase activada.` Después de relogin, el usuario
entró en Tareas y confirmó que `FIREBASE TEST` reaparece: **PASS**.
Esta evidencia se registra como confirmación manual del usuario; no como
una nueva prueba de navegador ejecutada por el agente.

Backup ZIP **PASS**, según la verificación real documentada arriba de
`/Users/carlos/Downloads/mi-agenda-backup-2026-10-06 (2).zip`.
Seguridad, Pages run 37512787091, Radar y offline conservan sus PASS
previamente documentados. **Smoke final PASS** en el alcance de los gates
registrados para el SHA funcional `eaa32ca4be8ae490fe628e5ab0996e6bc474e14c`.
Los estados PARTIAL/BLOCKED anteriores son históricos y quedan resueltos
por las continuaciones y esta confirmación. Se mantienen las limitaciones
conocidas de RELEASE_NOTES.md y el alcance de SECURITY.md.

Cierre autorizado: commit exclusivo de SECURITY.md y VALIDATION_REPORT.md;
sin cambios funcionales, schema, Firebase, billing ni datos. El backup de
usuario se excluye de la distribución. Publicación de main, CI, ZIP/SHA256,
tag anotado y GitHub Release se verifican después del commit.
