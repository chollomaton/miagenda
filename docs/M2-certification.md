# M2 — certificación multidispositivo

Base verificada: `78c9e6222bb54c6e3143cc366f01057ecfe944c7`, padre
`4356863a340be4f26192c69bb80380642529df2a`, abuelo
`98b13c67c6004b93f8389413565421d4deb7b7c4`. Árbol inicial limpio.
Rama: `feature/1.1-multidevice-certification`.

## Harness

`tests/multidevice-sync.test.ts`: dos AgendaStore, MemoryPersistence, AuthManager,
writerID (Mac/iPhone), outbox, cursor y SyncEngine propios. Identidad lógica común
`firebase:M2-user`; MemoryRepository compartido y paginado a dos registros.
Link permite desconexión, respuesta de pull retenida por Promise, fallo puntual y
ACK perdido después de aplicar una operación. No implementa merge ni sync:
ambos pertenecen al código productivo existente. Orden de sync seleccionable;
clocks controlados con fake time para el conflicto simétrico, random fijo y
nextAttemptAt ajustado para evitar sleeps. Convergencia compara todas las entidades
completas, ordenadas por UUID, contra el estado remoto reconstruido recorriendo
**todas** sus páginas; no elimina campos ni clocks de las entidades. Outbox vacía
se comprueba aparte; cursor y estado visual no forman parte de las entidades.

## Matriz de ejecución

Los números son los del encargo. Todos PASS en la suite completa. Los títulos
numerados del archivo M2 identifican cada caso nuevo; la reutilización siguiente
es explícita y evita duplicar pruebas existentes que verifican exactamente el caso.

| Escenarios | Certificación |
|---|---|
| 1–3 | M2: independencia y creación bidireccional/simultánea |
| 4 | M2: ACK perdido/retry mismo operationID; core: replay y OPERATION_REUSE |
| 5 | M2: title/priority concurrentes |
| 6–8 | M2: mismo instante, writerID, ambos órdenes con mismos snapshots y sync repetida |
| 9–10 | M2: complete/delete con edición offline independiente |
| 11 | M2: delete/restore concurrentes y ganador esperado por merge |
| 12–13 | M2: restore con edición y tombstone tras reconnect |
| 14–18 | M2: Task/Subtask, labels asignadas, jerarquía y cambios independientes; referencias finales verificadas |
| 19–26 | M2: ocho tests por kind, comparación de entidad completa |
| 27–29 | M2: start/duration independiente |
| 30 | Reutilizado core, Task scheduling core (TB1): `normalizes concurrent unschedule against newer resize without inventing clocks` y `rejects merged planned start with null companions instead of inventing defaults` |
| 31–36 | M2: offline, varias ediciones, reconnect, pull antes de push, convergencia y outbox vacía |
| 37–39 | Reutilizado indexeddb: `concurrent IndexedDB tabs merge field edits and all pending operations`, `concurrent IndexedDB creates do not drop another tab records`; implementation: `CAS stale persistence merges both local tabs without dropping outbox` fuerza conflicto y recuperación |
| 40 | Reutilizado indexeddb: `an acknowledged operation is not resurrected by a stale tab` |
| 41–43 | M2 respuesta retenida/logout; reutilizado local-certification: `STALE_SESSION_RESPONSE pull/push cannot change new scope Store IDB cursor or quarantine` (cambio efectivo A→B con respuesta pendiente); session-isolation impide envío por engine antiguo |
| 44–45 | M2: authentication expiration, outbox durable y relogin mismo usuario con nuevo engine |
| 46 | Reutilizado indexeddb: `IndexedDB isolates entities outbox cursor preferences and quarantine by user`; firebase-runtime y user-scope-critical verifican scopes Firebase y UUID compartido |
| 47–48 | M2: avance normal, tokenExpired seguido exactamente de un full pull |
| 49 | M2: moreComing con cursor estancado → offline/SYNC_FAILED |
| 50 | M2: iPhone vacío, full pull paginado de todos los kinds, activos, completados, tombstones, labels, templates, Preferences y Task programada |
| 51–54 | M2: network/conflict retry, permission/invalidRecord permanentFailure |
| 55 | M2: authentication expira auth y conserva operaciones |
| 56–57 | M2: fallo bloquea siguientes operaciones de esa entidad; otra entidad se aplica |
| 58 | M2: UUID con kind diferente quarantined, original intacto |
| 59 | M2: reloj futuro y nextClock con tiempo hacia atrás; core: `hybrid clock survives backward time` |
| 60 | M2: merge conmutativo/idempotente/determinista y ambos órdenes de entrega; core field merge, implementation equal field clock collision y local-certification SAME_FIELD |

## Resultado y límites

30 tests nuevos M2 PASS. Suite completa: 29 archivos, 522 tests PASS.
Incluye core, indexeddb, auth/session, firebase-runtime, sync (core e
implementation), backup, M1 (local-firebase-migration y local-migration-controls),
smoke y PWA. M1 sigue PASS.
Typecheck PASS; lint sin warnings PASS; security: 71 archivos, 0 findings PASS;
build PASS (aviso de tamaño de chunk >500 kB, sin cambios de bundling).

Bugs reales encontrados: ninguno. Sólo tests y documentación; sin cambios
productivos. Preferences con dos UUID distintos convergen y permanecen dos:
se documenta para M3B, sin repair.

Certificación determinista del protocolo existente con remote in-memory, no prueba
de red Firebase real, emulador Firebase, navegador físico ni dispositivos físicos.
IndexedDB y sesión se certifican con las pruebas existentes, no con disco físico
independiente en el harness M2. La semántica existente de unschedule/move puede
rechazar INVALID_SCHEDULING: queda certificada por las pruebas TB1, no reparada.
El caso conflict de M2 inyecta una respuesta conflict y verifica retry; el merge
remoto real se reutiliza de core (`CloudKit saves with change tags and merges conflict`).

No push. Main permanece en `98b13c67c6004b93f8389413565421d4deb7b7c4`.
Sin producción, deploy, tag, release ni bump; schema, Backup V2, rules, billing,
realtime, backend y UI intactos. M2 termina aquí; no se inicia M3.
