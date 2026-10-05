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
