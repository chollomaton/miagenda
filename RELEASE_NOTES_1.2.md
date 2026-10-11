# Mi Agenda 1.2.0

Mirror de EventKit e iCloud Drive hacia Firebase, con web exclusivamente de consulta. Pairing con aprobación Google, identidad propia del Mac, credenciales en Keychain, lease y revocación. Caché validada por generación/hash, PWA y arranque offline tras la primera sincronización.

El Mac requiere macOS 14+, permisos Apple y selección explícita de carpeta y calendarios en Ajustes → Cuentas → Espejo web. No se publican fuentes automáticamente. La selección se repite tras reiniciar. El publisher sólo lee las fuentes seleccionadas; el uso normal de la agenda nativa conserva sus funciones existentes.

Firebase Spark, sin Functions, backend propio ni facturación. Rules conservan la ruta entities de 1.1. No hay push con la app cerrada; la publicación requiere el Mac abierto y autorización vigente. No hay GC remoto automático; las cuotas Spark son finitas. El instalable local usa firma ad hoc, sin notarización Apple.

## Rollback a 1.1

Detener publicación y revocar el Mac desde la web. Restaurar las Rules exactas de `git show 39fffa78d1061ced5ff56d0f420f1f836b565350:firestore.rules` y deshabilitar Anonymous conservando Google y dominios. Ejecutar Pages desde la rama `release/1.1.0-rc` después de verificar su SHA estable, o desde una rama de rollback creada en `39fffa78d1061ced5ff56d0f420f1f836b565350`; sin force-push. Restaurar la copia de la app instalada guardada antes del reemplazo. No borrar ni modificar datos Apple o entities 1.1.
