# Mi Agenda — evidencia de cierre, 26 septiembre 2026

LOCAL-CERTIFIED: YES para el gate automatizado local (166 tests), ampliado con smoke en navegador real. No equivale a release 1.0 ni a certificación iPhone o recuperación ante caída del proceso.

Base: /Users/carlos/Documents/Codex/2026-09-26/referenced-chatgpt-conversation-this-is-an-10/work/base/miagenda. Los 60 archivos del checkpoint previo coincidían byte a byte al iniciar; SHA del ZIP previo a733b444519d3bc055252a0e65eb121b7c006f3c838bb1819f90e0099bb338af. Se reutilizaron esos PASS. La nueva suite completa se ejecutó por cambios demostrados, no como revisión repetida. No hay repositorio Git propio ni commit/tag certificado.

## A. Críticos locales

Los nombres de archivo de esta tabla son relativos a tests/ dentro del ZIP. PASS automatizado usa jsdom/fake-indexeddb, salvo evidencia de navegador expresamente indicada.

| Crítico | Estado | Evidencia equivalente |
|---|---|---|
| USER_SCOPE_ISOLATION, mismo UUID | PASS | user-scope-critical.test.ts; indexeddb.test.ts |
| ATOMIC_ENTITY_OUTBOX, fallo/rollback | PASS | atomic-rollback-critical.test.ts |
| NO_OP_SAVE | PASS | no-op-save-critical.test.ts: activo y borrado |
| DIFFERENT_FIELD_MERGE | PASS | core.test.ts: preserves concurrent different fields; implementation.test.ts |
| SAME_FIELD deterministic | PASS | local-certification.test.ts: ignores updatedAt in both directions |
| DELETE_VS_OFFLINE_EDIT | PASS | local-certification.test.ts; core.test.ts |
| EXPLICIT_RESTORE latest content | PASS | local-certification.test.ts; edición/borrado/restore real conserva título |
| STALE_SESSION Store/IDB/metadata/token | PASS | session-isolation, local-certification, stale-persistence-critical; 2 nuevas regresiones de error tardío |
| OPERATION_ID_RETRY + stale sending | PASS | core.test.ts; OFFLINE_COLD_RELOAD en local-certification.test.ts |
| OFFLINE_COLD_RELOAD/local durability | PASS | Simulado y cierre/reapertura de pestaña con servidor apagado. Caída del proceso: NOT RUN |
| NOTE_AUTOSAVE_RACE + close/flush | PASS | smoke.test.tsx: latest text behind an in-flight save and survives reopen |
| CIVIL_DATE + DST spring/autumn | PASS | core.test.ts y local-certification.test.ts |
| Mensual 31 + Feb 29 | PASS | core.test.ts; local-certification.test.ts |
| CORRUPT_BACKUP_ZERO_MUTATION | PASS | local-certification.test.ts y comparación real de los cinco almacenes IDB |
| REPLACE_ROLLBACK | PASS | Aborto transaccional en local-certification.test.ts; Replace normal real y recarga |
| REPLACE interrupted recovery físico | NOT RUN | Falta terminación del proceso durante la transacción y reapertura; no confundir con rollback inyectado |
| REMOTE_QUARANTINE + token safety | PASS | local-certification.test.ts: rollback conjunto |
| SW/PWA data preservation | PASS | pwa/local-certification + actualización real N→N+1 y recarga sin servidor; iPhone NOT RUN |

## B. P0 y check

P0 automatizado equivalente: PASS. No hay script P0 separado. npm run check: PASS, salida 0: typecheck, lint, 166 tests/11 archivos, seguridad (33 archivos, cero hallazgos), build. Registro npm-run-check.log.

## C. Fallos demostrados y cambios

1. Una apertura IDB antigua rechazada tras detach ponía el Store vigente en safe y publicaba STORAGE_OPEN_FAILED. Dos regresiones fallaron antes (logout y reapertura) y pasan después. src/stores/AgendaStore.ts comprueba epoch también en catch; tests/stale-persistence-critical.test.ts añade ambos casos.
2. En navegador real, el SW nuevo miagenda-shell-3daebeb035a6 almacenó HTML antiguo que referenciaba index-BV01Y_7a.js, mientras su lista contenía index-CdgvfKvc.js. La instalación reutilizaba caché HTTP. scripts/service-worker.ts usa Request con cache:reload para el shell. tests/pwa.test.ts añade regresión FAIL antes/PASS después. scripts/build-shell.mjs incorpora el contenido generado del worker al identificador de caché para que un cambio del algoritmo no reutilice la caché activa.
3. LOCAL_CERTIFICATION.md se actualiza con este informe. dist se regeneró por build y no entra en el ZIP de fuentes. No se cambiaron dependencias, UI ni funcionalidades.

## D. Navegador real

Entorno: navegador integrado de Codex, origen de prueba 127.0.0.1:4180/miagenda/, sólo datos CERT-49. No es Safari ni un iPhone. Los clics de automatización tenían problemas de posición; se completaron los controles con teclado accesible.

- Creación de recordatorio, recarga y persistencia de entidad/cola: PASS.
- Servidor detenido, cierre de pestaña y apertura de pestaña nueva: shell y registro disponibles, PASS. No se cerró el proceso entero del navegador.
- Edición offline, borrado y restore: PASS; contenido editado conservado.
- Actualización corregida: nueva caché bb2a53801df2 instalada en espera; activada al cerrar cliente; recarga posterior sin servidor carga index-CdgvfKvc.js y mantiene el registro y cuatro operaciones. PASS.
- Exportación JSON real: archivo descargado con el registro esperado. El evento de descarga de la herramienta agotó espera, pero se verificó el archivo físico y se reimportó por selector de archivos.
- Importación Merge y Merge repetido: PASS, sin duplicados ni nuevas operaciones; comparación de los cinco almacenes físicos idéntica.
- Backup alterado sin recalcular checksum: rechazo visible y cinco almacenes idénticos antes/después, PASS.
- Replace normal: creada tarea sobrante, preview anuncia un envío a papelera; se descarga copia previa con ambos registros activos, Replace mueve sólo la tarea sobrante a papelera. Recarga sin servidor conserva resultado, seis operaciones pendientes e integridad/cuarentena cero. PASS.
- Caída del proceso durante Replace, actualización iPhone y evacuación de almacenamiento: NOT RUN.

Evidencia: browser-checks.json, navegador-evidencia.txt, backup-integridad.png. Los dos archivos de backup sintético descargados permanecen en Descargas; los datos de prueba quedan sólo en el origen local dedicado. Servidores de prueba detenidos.

## E. CloudKit Development

| Bloque | Estado | Alcance/bloqueo |
|---|---|---|
| Serializer/decoder de los 7 tipos | PASS | core.test.ts, encode/decode local; no llamada a Apple |
| Auth Apple | NOT RUN | App utiliza localAuth; falta conexión real |
| Initial pull | NOT RUN | CloudKitZoneTransport sólo está definido como interfaz |
| Create/update/delete/restore Dev | NOT RUN | Sin transporte concreto ni contenedor Dev configurado |
| Segundo dispositivo | NOT RUN | Requiere lo anterior y dos clientes reales |
| Different-field conflict | NOT RUN | Sólo mocks certificados |
| Same-field convergence | NOT RUN | Sólo mocks certificados |
| Delete vs offline edit + restore | NOT RUN | Sólo mocks certificados |
| Offline reconnect | NOT RUN | Sólo mocks certificados |
| Stale logout/request safety real | NOT RUN | Sólo pruebas locales con respuesta demorada |

La integración Apple está NOT IMPLEMENTED en esta copia; no basta con proporcionar una contraseña. .env.example sólo contiene placeholder comentado; faltan transporte real, contenedor Development, esquema/zona privada, origen autorizado y autenticación Apple. No se implementó una integración nueva dentro de este trabajo de cierre sin nuevas features. Production no se contactó.

## F. Riesgos abiertos y pendientes

- Bloqueante de release, Cloud: conexión Apple no implementada; auth/CRUD/convergencia real no demostrados.
- Alto, multi-device: falta ensayo con dos dispositivos reales, especialmente conflictos, borrado offline y restore.
- Alto, PWA/iPhone: falta Safari/standalone, modo avión, cierre del proceso, background/resume y actualización instalada. El smoke del navegador integrado no cubre estos escenarios.
- Alto, backup/recovery: interrupción física de Replace NOT RUN. Rollback simulado, export/import reales y Replace normal sí PASS. No se certifica su resistencia a caída del proceso.
- Medio, local/core: faltan ensayos de cierre abrupto del proceso y matriz completa de módulos en dispositivos. No queda un FAIL conocido de los casos ejecutados.
- Production/release: smoke Production pendiente por prohibición expresa, repo/commit reproducible, versión final, tag y artefacto release.

Chequeo barato de patrones: updatedAt sólo agrega metadato; merge decide por clocks/campo. No deleteDatabase/reset automático encontrado. operationID se genera al crear operación, no en el retry. Fechas civiles usan cálculo de calendario y getters UTC internamente, sin bug de desplazamiento demostrado. El SW sólo elimina cachés miagenda-shell-* y no accede a IndexedDB. No se abrió un refactor.

## G. Estimación y entrega

Preparación global orientativa 60–70% (aprox. 65%), no métrica de cobertura ni promesa. Con implementación/acceso Dev y dispositivos disponibles: optimista 4–6 sesiones sustanciales de 1–2 horas, probable 6–9, con incidencias 10–16+. El avance local no elimina la integración Cloud pendiente.

ZIP nuevo porque hubo cambios validados: fuentes, tests, lockfile y configuración; sin node_modules, dist, work ni .git. SHA-256 adjunto. Es checkpoint local, no tag 1.0.0 ni garantía de árbol Git limpio.
