# M3B — Integridad y recuperación

Base verificada: rama `feature/1.1-local-only-store`, HEAD `ca99e598088dc721ad5eb11e517a1c6cf829cb0b`, árbol limpio. Rama de trabajo: `feature/1.1-integrity-recovery`.

## Integridad y backups

La inspección es pura. Registros inválidos, IDs duplicados e identidad inválida permanecen en cuarentena. `ORPHAN_PARENT`, `ORPHAN_LABEL` y `LABEL_CYCLE` se conservan; son problemas estructurales que bloquean backups mediante `blocksBackup`. Referencias de entidades activas a padres/etiquetas existentes eliminados generan `DELETED_PARENT_REFERENCE` / `DELETED_LABEL_REFERENCE`, sin bloquear backups. Más de una Preferences activa válida genera `DUPLICATE_PREFERENCES`; no se consolida ni repara. Las Preferences eliminadas no cuentan como configuración activa.

Exportación y parseo conservan exactamente Backup V2 y checksum. Los avisos recuperables sobreviven exportación/importación. Corrupción, estructura inválida y checksum incorrecto bloquean. La UI de exportación y la copia previa de importación rechazan un store con cuarentena; nunca se serializa la cuarentena. `exportBackup(entities)` sólo conoce los registros recibidos; las rutas que disponen del store verifican además su cuarentena. Replace puede obtener copia previa con avisos recuperables. El preview habla de coincidencias que se combinarán.

## Papelera local

`purgeDependencies` es un helper puro que devuelve `activeBlockers`, `deletedDependencies` y `expandedPurgeSet`. Recorre dependencias inversas hasta cerrar transitivamente el conjunto, con un Set que termina incluso ante ciclos. Los dependientes activos bloquean. Los dependientes eliminados requieren que el llamador confirme y envíe el conjunto completo; nunca se amplía silenciosamente en el store.

La UI confirma PURGAR con el número de elementos del conjunto. El store vuelve a cargar disco, exige lifecycle deleted y comprueba todas las dependencias antes de una única escritura atómica. Un conflicto entre lectura y escritura aborta; no reintenta una purga usando un conjunto obsoleto. Undo/redo se limpia sólo tras guardar con éxito. La validación M3A de pestañas concurrentes y rollback sigue vigente.

La recuperación explícita de etiquetas elimina exclusivamente el ID seleccionado de labelIDs, incluidas las definiciones de Templates, y desvincula parentLabelId cuando apunta a esa etiqueta. Conserva las demás etiquetas, valores y lifecycle. Requiere confirmación y no se ejecuta al eliminar ni arrancar. Restaurar el padre también permanece disponible. No hay cascade de Task; las subtareas activas bloquean, las eliminadas pueden purgarse conjuntamente.

En sync-enabled se rechaza siempre la purga física, incluso tras ACK; se mantienen tombstones. La UI ofrece restaurar y explica que los eliminados se conservan para evitar reapariciones desde otros dispositivos. No cambia transporte Firebase ni rules.

## Validación

18 pruebas nuevas M3B (15 de dominio y 3 de UI), todas PASS. Suite completa: 33 archivos, 564/564 PASS, dos workers. Incluye core, IndexedDB, persistencia obsoleta, rollback, backup JSON/ZIP/UI, migración M1, multidispositivo M2, local-only M3A, smoke, aislamiento de sesión, Firebase runtime, sync y PWA.

Typecheck PASS; lint PASS; security PASS (73 archivos, 0 hallazgos); build PASS (Vite y generación del shell). Se ejecutaron las etapas directamente con el runtime disponible, porque npm no está instalado. Build conserva aviso de tamaño del chunk cloud; no se cambia fragmentación fuera del alcance.

Pruebas existentes adaptadas: semántica de tombstones cloud, warning Template y texto de preview. La prueba de rollback replace usa metadatos válidos para llegar a la escritura; cuarentena se comprueba separadamente en M3B.

## Límites

No consolidación Preferences; no reparación automática al boot; no resolución automática de subtareas activas; no purga cloud. Desvincular jerarquía desde recuperación quita todas las referencias a la etiqueta seleccionada en una acción explícita. Pruebas UI con jsdom, sin sesión Firebase real ni comprobación visual en navegador.

Main, producción, deploy, tags, releases, versión 1.0.0, billing, Firestore rules, esquema de entidades e IndexedDB v1 intactos. Sin push. No se inicia M3C/M4/M5/M6.
