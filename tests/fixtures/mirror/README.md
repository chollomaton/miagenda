# Fixtures sintéticas, sin datos personales

Payload normalizado del modelo nativo 8.x inspeccionado, no export real.
`label-flat` + `label-second` sustituyen el tree solicitado: LabelDefinition no
contiene parent. Añadir parent sería inventar un modelo que no existe.
`trash-tombstone` representa tombstone auxiliar iCloud Drive sin contenido,
no papelera universal EventKit. Arrays de subtasks/parts y pares weekdays/
weekNumbers preservan orden. MonthDays/yearDays/yearWeeks/months/positions
son sets numéricos. Todas las fechas instantáneas wire: UTC ISO con milisegundos;
DateComponents se proyecta explícitamente a civil date/time/timeZone (null = floating).
TimeBlock.updatedAt convierte epoch Foundation a UTC, sin cambiar el archivo nativo.
Metadata es proyección resuelta por provider, no copia de flags hasOverride.
Root liga source/schema/publisher/app/calendarScope y referencias de contenido.
