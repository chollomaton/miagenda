# Mi Agenda 1.1.0

## Cambios para el usuario

- Migración voluntaria de la agenda local a Firebase, con copia previa, validación y fuente local conservada.
- Sincronización multidispositivo con pruebas automatizadas de convergencia, conflictos y reconstrucción.
- Modo local-only sin transporte cloud ni outbox de sincronización.
- Integridad y papelera: advertencias recuperables diferenciadas de corrupción, dependencias protegidas y purga local atómica confirmada.
- Estados de sincronización más claros, recuperación de sesión y conservación de cambios pendientes al caducar o cerrar sesión.
- PWA: actualización aplazada durante operaciones y migraciones; ajustes móviles para iPhone.
- Rendimiento: Firebase y vistas pesadas se cargan de forma diferida.
- Avisos foreground de recordatorios, eventos y tareas, incluyendo Time Blocking, recurrencia y deduplicación.

## Compatibilidad y limitaciones conocidas

- En iOS, el icono de pantalla de inicio puede seguir mostrando la M antigua por caché/metadata de Web Clip. Es una limitación visual no bloqueante; no afecta al funcionamiento, los datos, Firebase ni la PWA. Su investigación queda aplazada por decisión del usuario.
- Sin notificaciones push con la app totalmente cerrada. La notificación real foreground es opcional, requiere consentimiento del navegador/sistema y sigue sin certificación física; no se garantiza puntualidad si el navegador suspende la app.
- La certificación automatizada y el smoke de publicación no equivalen a una certificación física completa de iPhone ni de notificaciones nativas.
- Chunk cloud/Firebase superior a 500 kB: warning conocido de build, fuera de la ejecución inicial local. El precache aún descarga todos los chunks.
- Backup V2 conserva formatVersion 2 y schemaVersion 1; applicationVersion identifica el producto como 1.1.0. No cambia el esquema de entidades ni la versión IndexedDB.
- El ZIP de backup conserva los límites de tamaño y formato documentados en 1.0.0. CloudKit real sigue sin certificación.

La historia de 1.0.0 permanece en `RELEASE_NOTES.md`. Los documentos de preparación y certificación RC son registros históricos; sus estados pendientes describen aquellas sesiones.
