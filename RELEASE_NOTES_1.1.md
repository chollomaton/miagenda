# Mi Agenda 1.1.0 — release candidate local

Estado: preparado para revisión; sin publicación. Fecha: 7 de octubre de 2026.

## Cambios para el usuario

- Migración voluntaria de la agenda local a Firebase, con copia previa, validación y fuente local conservada.
- Sincronización multidispositivo certificada mediante pruebas automatizadas de convergencia, conflictos y reconstrucción; Firebase real pendiente en este RC.
- Modo local-only corregido: sin transporte cloud ni outbox de sincronización.
- Integridad y papelera: distinción entre advertencias recuperables y corrupción, dependencias protegidas y purga local atómica confirmada.
- Estados de sincronización más claros, recuperación de sesión y conservación de cambios pendientes al caducar o cerrar sesión.
- PWA: actualización aplazada durante operaciones y migraciones. Ajustes móviles para iPhone certificados en DOM/CSS; prueba física pendiente.
- Rendimiento: Firebase y vistas pesadas se cargan de forma diferida.
- Notificaciones foreground de recordatorios, eventos y tareas, incluyendo Time Blocking, recurrencia y deduplicación.

## Compatibilidad y límites

- Backup V2 conserva formatVersion 2 y schemaVersion 1; applicationVersion identifica el producto como 1.1.0. No cambia el esquema de entidades ni la versión IndexedDB.
- Sin push con la app cerrada; notificaciones reales requieren consentimiento del navegador/sistema y prueba física pendiente.
- iPhone físico, instalación PWA, actualización real, Google login y sincronización Firebase real de este RC siguen pendientes.
- Chunk cloud/Firebase superior a 500 kB; queda fuera de la ejecución inicial local. El precache aún descarga todos los chunks.
- El ZIP de backup mantiene sus límites de tamaño y formato documentados en 1.0.0.

Estas notas describen un RC local. No constituyen autorización de deploy, tag ni GitHub Release. La historia de 1.0.0 permanece en RELEASE_NOTES.md.
