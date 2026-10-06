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
