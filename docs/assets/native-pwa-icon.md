# Icono nativo de Mi Agenda para PWA

Fuente exacta: `/Applications/Mi Agenda.app/Contents/Resources/MiAgendaIcon.png`, 1024×1024 RGBA, Mi Agenda macOS 8.0.0 (800). SHA256 `05ef17ffb13c190fed256f77185542e1580da18d8abcbb959e8fe749bf465fde`.

Coincide byte a byte con `MiAgenda-8.0.0-FINAL/MiAgenda/Resources/Assets.xcassets/AppIcon.appiconset/icon_512x512@2x.png` de la entrega local del 4 de octubre. Info.plist selecciona AppIcon; la extracción de AppIcon.icns confirma el mismo diseño. El PNG original se conserva sin cambios en public/icons/agenda-native-original.png; no se ha inventado una fuente SVG.

180/192/512: reducción Lanczos del original, conservando RGBA. Maskable 512: original completo reducido a 280×280, centrado en (116,116), sobre RGB (23,24,29), el fondo nativo. Todo el cuadrado del original cabe en el círculo seguro de radio 204,8 px (diagonal media 198 px). La prueba M4 decodifica el PNG y comprueba los píxeles reales contra ese círculo.

Manifest conserva identidad, scope, start_url, shortcuts y demás campos. Apple usa 180 px; los nombres nuevos evitan reutilizar URLs antiguas. El SW conserva su estrategia y calcula la versión a partir del contenido de todo el shell, incluyendo manifest e iconos. El original de archivo no se precachea; los cuatro assets de instalación sí.

Gate final: confirmar visualmente el icono instalado en iPhone antes de integrar main, tag o GitHub Release. Eliminar la PWA anterior si conserva el icono; abrir Safari, añadir de nuevo a pantalla de inicio y comparar con Mi Agenda Escritorio. Las notificaciones físicas siguen opcionales y sin certificar.
