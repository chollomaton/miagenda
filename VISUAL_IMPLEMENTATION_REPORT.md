# Mi Agenda Web — integración visual de la app local 7.2.0

26 de septiembre de 2026. Implementación real sobre el checkpoint de fuentes cuyo SHA-256 es `f62d668eabf817cd0543e35be505be95b93a484d82552d5fa5bf628cb8491d94`. No es una release 1.0 ni certificación de CloudKit.

## A. Fuentes utilizadas

Se extrajo íntegramente `MiAgenda-7.2.0-FINAL-CORREGIDA.zip` localizado en el Escritorio. SHA-256: `b3cbb42f21cceabafd8d24d06c0dc7152b7243c1b28f6aa22be0ede0b0850b43`.

Fuentes visuales principales: `Shared/DesignSystem.swift`, `Core/Models.swift`, `Features/Root/RootView.swift`, `Features/Dashboard/DashboardView.swift`, `Features/Agenda/TasksRemindersView.swift`, `Features/Calendar/CalendarView.swift`, `Features/QuickNotes/QuickNotesView.swift`, `Features/Labels/LabelsView.swift` y `Features/Settings/SettingsView.swift`. Se inspeccionó también la estructura de recursos/assets. No se copiaron fuentes privadas ni ejecutables de la app.

La captura `Captura de pantalla 2026-09-26 a las 21.42.56.png`, también localizada en el Escritorio, se usó para contrastar el dashboard oscuro: sidebar, header, distribución, densidad, superficies y acentos. No había capturas nativas de las demás pantallas o del modo claro; esas adaptaciones se contrastaron con el código SwiftUI, no con una comparación pixel a pixel.

## B. Tokens y componentes extraídos

Inventario previo completo: `miagenda/VISUAL_PARITY.md`.

- Sidebar de 220 px según la captura; grupos Agenda/Organización, badges positivos y Nuevo inferior.
- Dashboard: dos columnas, separación horizontal 12 px y vertical 14 px; padding de página 22 px; tarjetas de radio 16 px y padding 17 px.
- Glyphs de 42 px, radio 12 px; títulos de tarjeta 18 px semibold; acciones discretas con radio 9 px.
- Tipografía del sistema: `-apple-system`, `BlinkMacSystemFont`, `system-ui`, sin recursos privados.
- Paletas dinámicas: superficies neutras, tareas azul, recordatorios rosa, eventos verde, Hoy/notas naranja, etiquetas magenta, completados turquesa.
- Componentes nuevos: `Dashboard`, `Icon`, `useAppearance`; tokens centralizados en `native.css`. Sin nuevas dependencias.
- SF Symbols se mapearon a SVG locales: grid, checklist, bell, calendar, pencil, tag, archive, gear, plus, search y acciones. Etiquetas usa equivalentes conocidos y tag como fallback; conserva el identificador del icono en los datos.

## C. Archivos web modificados

Modificados:

- `src/app/App.tsx`: shell, sidebar, dashboard, acceso a Completados, paneles de Ajustes y navegación responsive.
- `src/main.tsx`: incorporación del estilo nativo.
- `src/styles/base.css`: retirada de la antigua paleta azul oscura.
- `src/views/CalendarTimeline.tsx`: clases semánticas de color; mismo comportamiento.
- `src/views/LabelTree.tsx`: iconografía SVG equivalente; mismos datos y relaciones.
- `tests/smoke.test.tsx`: adaptación de nombres visibles y tres regresiones funcionales.

Añadidos: `src/components/Dashboard.tsx`, `src/components/Icon.tsx`, `src/app/useAppearance.ts`, `src/styles/native.css`, `VISUAL_PARITY.md`.

Auditoría byte a byte contra el ZIP base: **sin cambios en models, stores, services, repositories, offline, sync, auth, backup, recovery, cloud, utils o search**. Scripts del service worker, dependencias y lockfile también conservados. No hay migración de esquema ni nuevo almacenamiento de preferencias. Evidencia: `source-audit.json`.

## D. Pantallas alineadas

| Pantalla | Resultado y alcance |
|---|---|
| Dashboard | Composición reconstruida desde SwiftUI y captura: Hoy/Mañana, mini calendario Semana/Mes, Tareas, Recordatorios y Notas. Acciones conectadas a datos reales. |
| Tareas / Recordatorios | Cabeceras con glyph, colores, filas, bordes, espaciados y controles coherentes; funciones existentes conservadas. |
| Calendario | Paleta, cabecera y controles; eventos verde, recordatorios rosa y tareas azul. Vistas Día/Semana/Mes/Agenda conservadas. |
| Notas rápidas | Cabecera, superficies, lista, editor y autoguardado existente. |
| Etiquetas | Jerarquía existente con glyphs SVG y acento magenta. |
| Completados | Acceso propio en sidebar usando el selector existente; reapertura de tareas verificada. |
| Papelera | Sigue en Ajustes → Datos y recuperación; restauración verificada. |
| Ajustes | Navegación interna de paneles, filas de preferencias y tema persistente. |
| Bóveda | No existe equivalente de dominio/cifrado en la web; no se añadió una simulación. |

El dashboard es la parte con mayor paridad de composición. Las demás pantallas comparten el lenguaje visual real, pero conservan la estructura funcional de la web y no se presentan como réplicas 1:1.

## E. Claro / Oscuro / Automático

**PASS.** Selector en Ajustes → General → Apariencia. Usa `Preferences.theme` existente, sin sustituir zona horaria ni otras preferencias. Tres pruebas nuevas elevan el total de 166 a 169.

En navegador se verificó: Claro con sistema oscuro, Oscuro con sistema claro, cambio del sistema con Automático sin recarga, persistencia tras recarga y actualización del color de la barra PWA. `prefers-reduced-motion` produce transiciones de duración cero. El modo claro se deriva de colores dinámicos nativos y contraste web, sin captura nativa clara disponible.

## F. Responsive

**PASS en navegador integrado**, con tamaños explícitos:

- Desktop 1370 × 865: sidebar fija, tarjetas en dos columnas y paneles de Ajustes laterales.
- Tablet 834 × 1112: sidebar desplegable y dashboard en dos columnas.
- Mobile 390 × 844: tarjetas en una columna, navegación inferior, menú desplegable, controles adaptados y editores móviles.

Se recorrieron Tareas, Recordatorios, Calendario, Notas, Etiquetas, Completados y Ajustes en los tres tamaños. Sin desbordamiento horizontal del documento. El calendario mensual móvil trunca los títulos largos; tocar el evento abre su contenido completo. Las capturas de página completa muestran la barra móvil fija a la altura de la ventana original.

Esto no certifica Safari/iPhone físico, rotación, teclado virtual o PWA instalada en iOS. Evidencia: `browser-visual-checks.json` y capturas PNG.

## G. Tests y verificaciones

**npm run check: PASS**, salida 0 en la última ejecución:

- TypeScript y lint: PASS.
- **169 tests / 11 archivos: PASS**.
- Seguridad: 37 archivos, cero hallazgos.
- Build: PASS.

Pruebas nuevas: persistencia de apariencia sin sustituir preferencias; reapertura desde Completados conservando identidad; interacción Semana/Mes y apertura de evento del mini calendario. Registro completo: `npm-run-check.log`.

Smoke de navegador con datos sintéticos: evento, recordatorio, nota/autoguardado, etiqueta, tarea, completar, enviar a Papelera, restaurar y comprobar integridad: PASS; 0 incidencias y 0 registros en cuarentena. Datos de prueba sólo en el origen local `127.0.0.1:4190`, no incluidos en el ZIP.

Las fechas introducidas mediante automatización en controles datetime-local quedaron con sus valores predeterminados; no se usa ese smoke para certificar edición de fechas. Las pruebas existentes del motor de fechas permanecen verdes.

Las suites existentes de offline, sync, backup y PWA pasaron. No se repitió en esta sesión el ensayo físico de actualización/cierre offline del checkpoint anterior, ni se probó caída del proceso. Durante desarrollo se utilizó la compilación de producción para verificar la política CSP existente: el servidor de desarrollo inyecta CSS que esa política bloquea; no se debilitó la CSP.

## H. Diferencias respecto a la app local

- SVG equivalentes, no SF Symbols exactos; algunos símbolos son de contorno frente a los rellenos nativos.
- Sin vibrancy de AppKit sobre el escritorio, curva continua exacta de macOS ni controles de ventana ficticios. Superficies CSS y blur en diálogos.
- Colores AppKit dinámicos aproximados en sRGB; las fuentes y rasterización cambian según plataforma.
- Sidebar indica Agenda local, no Apple/iCloud conectado. Bóveda no disponible.
- Ajustes agrupa sólo las funciones web existentes en tres paneles. No reproduce controles de EventKit o integración macOS ausentes.
- Dashboard añade acceso a Notas fijadas; el subtítulo de cabecera sigue siendo general. No se implementa toda la lógica nativa del resumen o panel flotante.
- Calendario, editores y listas conservan capacidades/estructura de la web; la alineación visual no equivale a paridad funcional total con la app nativa.

## I. Pendientes técnicos para 1.0

Se integran los pendientes del cierre anterior, conservado como `CIERRE_1_0_ANTERIOR.md`:

1. Implementar y configurar autenticación Apple y transporte concreto CloudKit Development: pull inicial, CRUD, errores y reconexión reales.
2. Ensayo con dos dispositivos: convergencia, conflictos por campo, borrado offline, restore y sesiones obsoletas.
3. Safari/iPhone/PWA instalada: modo avión, cierre de proceso, background/resume y actualización.
4. Interrupción física de Replace/import y recuperación; cierre abrupto con cambios pendientes.
5. Repaso funcional completo de módulos en dispositivos reales y revisión final de accesibilidad con lector de pantalla/contrastes instrumentados.
6. Repositorio/commit reproducible, versión/tag y artefacto release; smoke Production cuando corresponda.
7. Revisión visual final con capturas nativas adicionales de modo claro y pantallas secundarias para reducir las diferencias documentadas.

CloudKit sigue sin conexión real en esta copia. No se ha contactado Production. El trabajo visual no cierra esos gates.

## J. Checkpoint y entregables

`miagenda-0.3.0-native-7.2-parity.zip`: fuentes, configuración, tests, lockfile y documentación; excluye node_modules, dist, datos de prueba y secretos. SHA-256 en el archivo `.sha256` adjunto. También se entrega la carpeta de fuentes `miagenda/`, el informe, las capturas y los registros.

El ZIP es un checkpoint local estable según las comprobaciones ejecutadas, no una certificación 1.0 ni una publicación en producción.
