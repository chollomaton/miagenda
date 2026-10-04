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
