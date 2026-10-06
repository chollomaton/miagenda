# Inventario previo — Mi Agenda 7.2.0 → Web

Fuente: ZIP completo MiAgenda-7.2.0-FINAL-CORREGIDA.zip del Escritorio y captura de pantalla 2026-09-26 a las 21.42.56.png (1370 × 865). Base web: checkpoint local-certified-sw-update, sin modificaciones al dominio.

| Fuente SwiftUI | Valores / comportamiento | Equivalente web |
|---|---|---|
| Shared/DesignSystem.swift, AgendaDesign | padding 24, separación 16, radios 14/10 | variables compartidas CSS |
| PremiumSurface | padding 18, radio 16, controlBackgroundColor .96, borde secondary .07 | card/surface y borde tenue |
| SectionGlyph | 42–44 px, radio tamaño × .28, símbolo .40, fondo color .11 | Icon SVG y bloque semántico |
| QuietActionStyle | semibold, padding 11 × 7, radio 9, fondo .075 / pressed .15 | botón quiet por módulo |
| Root/RootView.swift, SidebarItem | icono 14 semibold, texto 14 medium, badges sólo >0, grupos Agenda/Organización/Privado, Nuevo inferior | navegación agrupada de 220 px según captura |
| Core/Models.swift | grid/checklist/bell/calendar/pencil/tag/archive/shield/gear | SVG locales equivalentes; no existe librería de iconos en la web actual |
| Dashboard/DashboardView.swift | columnas separadas 12; filas 14; padding horizontal 22; DashboardCard padding 17, radio 16, título 18 semibold, min-height 210 | dashboard Hoy+Calendario / Tareas+Recordatorios |
| Dashboard TodayTomorrowSummary | superficies naranja/índigo, miniagenda y resumen | paneles Hoy/Mañana y vista de calendario compacta |
| Agenda/TasksRemindersView.swift | listas compactas, acentos azul/rosa, segmentados | toolbar, filas y filtros existentes |
| QuickNotes/QuickNotesView.swift | título 32 bold, tarjeta 13, borde .065 | notas con tarjetas y acento naranja |
| Labels/LabelsView.swift | tag, superficies 9/10, magenta en captura | árbol existente, chips y acento magenta |
| Settings/SettingsView.swift + Root appearance | Sistema/Claro/Oscuro; preferencia persistente | Preferences.theme existente system/light/dark; etiqueta Automático |

Los colores nativos son dinámicos de AppKit/SwiftUI, no constantes hex del ZIP. La paleta web aproxima sus valores renderizados: fondo oscuro #1e1e1e, sidebar #2d2929, tarjeta #202020, texto #e5e5e7; azul #0a9dff, rosa #ff375f, verde #30d158, naranja #ff9f0a. Modo claro usa superficies neutras y tonos semánticos más oscuros para contraste.

Sin inventar Bóveda: no existe entidad/servicio cifrado equivalente en la web. Completados puede exponerse con el selector existente; Papelera conserva restauración/purga en Ajustes. Agenda web se conserva como vista adicional.
