# Mi Agenda 1.0.0

- Agenda local-first: tareas, recordatorios, eventos, notas, etiquetas y papelera con restauración.
- CmdK, captura rápida, plantillas, Time Blocking y Radar.
- Persistencia IndexedDB; Firebase opcional con Google Auth y sincronización Firestore, con aislamiento por usuario. Sin migración automática de datos locales a Firebase.
- PWA con shell offline, cuatro shortcuts y actualización del worker al cerrar los clientes abiertos.
- Exportación ZIP/JSON e importación validada con vista previa, combinar/reemplazar y copia previa al reemplazo.

## Limitaciones conocidas

- No hay notificaciones en segundo plano; CloudKit real no está certificado.
- El backup ZIP admite una entrada backup.json, hasta 20 MB de JSON; no ZIP64, cifrado ni múltiples entradas. Si no hay descompresión nativa, extraer e importar el JSON.
- El navegador no confirma que una descarga se haya guardado en disco.
- El bundle supera 500 kB: aviso de build, no error.
- Instalación iPhone, pruebas multidispositivo, caída del proceso durante Replace y evacuación de almacenamiento no cuentan con certificación actual.

La preparación de versión no certifica por sí sola producción. Tag y publicación sujetos al smoke final del SHA desplegado.
