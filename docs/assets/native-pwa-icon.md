# Icono nativo de Mi Agenda para PWA

## Fuente activa verificada

`/Applications/Mi Agenda.app/Contents/Resources/MiAgendaIcon.png`, 1024×1024 RGBA, Mi Agenda macOS 8.0.0 (800). SHA256 `05ef17ffb13c190fed256f77185542e1580da18d8abcbb959e8fe749bf465fde`.

Es idéntico byte a byte a `/Users/carlos/Documents/Codex/2026-10-04/referenced-chatgpt-conversation-this-is-an-7/work/delivery/MiAgenda-8.0.0-FINAL/MiAgenda/Resources/Assets.xcassets/AppIcon.appiconset/icon_512x512@2x.png` y al original archivado `public/icons/agenda-native-original.png`.

Debug y Release seleccionan `ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon`. Info.plist instalado selecciona AppIcon. AppIcon.icns extraído con iconutil contiene el mismo diseño (máximo disponible 256 px). Además `MiAgenda/App/MiAgendaApp.swift:93–95` carga MiAgendaIcon.png como `NSApplication.shared.applicationIconImage`: es el icono activo al arrancar, no una variante legacy. Se inspeccionaron visualmente ambos diseños.

## Diagnóstico del 8 de octubre de 2026

Antes del cambio, Pages servía HTML, manifest y los cinco PNG exactamente iguales al repositorio. Apple apuntaba únicamente a `./icons/agenda-native-180.png` (PNG 180×180 RGBA con alpha 0–255); favicon 192, manifest any 192/512 y maskable 512. No había referencias SVG ni otros iconos en el HTML. Las rutas convencionales apple-touch-icon.png, apple-touch-icon-precomposed.png y favicon.ico devolvían 404. Headers de Pages: HTTP 200, tipos correctos y `Cache-Control: max-age=600`.

No se ha demostrado un asset fuente incorrecto ni una referencia rota. La persistencia en el iPhone puede deberse a una instalación/HTML/icono almacenados; la transparencia también dejaba la composición de las esquinas a iOS. Sin inspeccionar las peticiones o el icono del dispositivo no es posible atribuir la causa exacta.

## Corrección

Apple: `miagenda-touch-1.1.0.png`, PNG RGB opaco 180×180. Manifest/favicon: `miagenda-192-v2.png`, `miagenda-512-v2.png`; maskable: `miagenda-maskable-512-v2.png`. Nombres nuevos reales, sin query params.

Se compone el original sobre RGB (23,24,29), su propio fondo, y se reduce con Lanczos. No se redibuja, recorta ni añade padding: el dibujo conserva su proporción nativa. Maskable conserva su composición anterior: original reducido a 280×280 centrado en (116,116), sobre el mismo fondo; cumple el círculo seguro central del 80%. Los archivos anteriores se conservan para clientes antiguos, pero ninguna referencia de instalación actual los selecciona.

Manifest mantiene id, start_url, scope, shortcuts y demás campos. El service worker precachea los nuevos cuatro assets y calcula su versión con los bytes del shell, HTML, manifest e iconos. El original de archivo no se precachea.

Los tests comprueban una única referencia Apple, nombre versionado exacto (rechaza legacy, SVG y query), existencia, firma PNG, 180×180 y RGB; manifest comprueba nombres, dimensiones 192/512, RGB y safe area maskable.

La validación física queda pendiente: eliminar la PWA, cerrar Safari si hace falta, abrir https://chollomaton.github.io/miagenda/ y Compartir → Añadir a pantalla de inicio. El servidor puede verificarse; no se garantiza cuándo iOS descartará su icono almacenado. No integrar main, crear tag ni GitHub Release en este trabajo.
