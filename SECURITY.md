# Seguridad

Texto renderizado por React, URLs limitadas a HTTP/HTTPS, CSP local y shell PWA con allowlist.
Almacenamiento separado por identidad, invalidación por generación y diagnóstico sin contenido personal.
El cierre de sesión desacopla memoria y sincronización; las operaciones pendientes quedan en el espacio privado de su usuario para evitar pérdida de datos.
El backup excluye credenciales, cursores y outbox; contiene datos personales introducidos por el usuario.
`npm run security` revisa patrones peligrosos, secretos, correos reales y artefactos de plataforma prohibidos; no sustituye una auditoría completa.

## Evaluación release 1.0.0 — 2026-10-06

Base: `eaa32ca4be8ae490fe628e5ab0996e6bc474e14c`. Origen de los 16 HIGH:
`npm audit --json`, no el escáner del proyecto. Reproducido con npm 11.6.2
y el lockfile intacto: 16 entradas HIGH, 0 críticas. Son 16 paquetes marcados
por propagación transitiva, no 16 advisories independientes.

Advisories raíz y correcciones publicadas, consultados en GitHub y npm:

- G: [GHSA-m9gg-hp2v-232j / CVE-2026-101916](https://github.com/advisories/GHSA-m9gg-hp2v-232j), HIGH. Autenticación de certificados en servidores gRPC con configuración específica. Corregido en 1.13.6 y 1.14.5.
- GL: [GHSA-f596-whhp-79r4 / CVE-2026-101915](https://github.com/advisories/GHSA-f596-whhp-79r4), **LOW**, aunque el paquete recibe HIGH por G. Filtración de mensajes de error en servidores gRPC. Corregido en 1.13.6 y 1.14.5.
- S: [GHSA-68fv-2mgg-jv7q / CVE-2026-93749](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), HIGH. Bloqueo del event loop al procesar offsets de source maps indexados no confiables. Corregido en source-map-js 1.2.2, disponible en npm.

En la tabla, la corrección indica la versión del componente raíz; no implica
que npm pueda actualizar automáticamente cada paquete padre. Todas las filas
fueron etiquetadas HIGH por npm. Las cadenas parten de dependencias directas;
los enlaces de peer/peerOptional del tooling también se reflejan en el audit.

| Paquete instalado | Alcance | Cadena / advisory | Clasificación | Fixed raíz |
| --- | --- | --- | --- | --- |
| firebase 12.19.0 | prod | firebase → firestore (directo y compat) → grpc; G/GL | No alcanzable en browser bundle | grpc 1.13.6 / 1.14.5 |
| @firebase/firestore 4.17.2 | prod | firebase → firestore → grpc; G/GL | No alcanzable: entrada browser no usa grpc | grpc 1.13.6 / 1.14.5 |
| @firebase/firestore-compat 0.4.14 | prod | firebase → compat → firestore → grpc; G/GL | No alcanzable; compat no importado por la app | grpc 1.13.6 / 1.14.5 |
| @grpc/grpc-js 1.9.16 | prod | firebase → firestore → grpc; G/GL | No alcanzable; servidor Node ausente en Pages | grpc 1.13.6 / 1.14.5 |
| source-map-js 1.2.1 | dev | vite → postcss → source-map-js; jsdom → css-tree → source-map-js; S | Dev-only, no explotable en runtime publicado | 1.2.2 |
| postcss 8.5.28 | dev | vite → postcss → source-map-js; S | Dev-only | source-map-js 1.2.2 |
| vite 8.3.1 | dev | vite → postcss → source-map-js; S | Dev-only | source-map-js 1.2.2 |
| @vitejs/plugin-react 6.1.1 | dev | plugin-react → vite → postcss → source-map-js; S | Dev-only | source-map-js 1.2.2 |
| @vitest/mocker 5.0.2 | dev | vitest → mocker → vite → postcss → source-map-js; S | Dev-only | source-map-js 1.2.2 |
| vitest 5.0.2 | dev | vitest → vite/mocker; vitest → jsdom → css-tree → source-map-js; S | Dev-only | source-map-js 1.2.2 |
| @testing-library/jest-dom 7.0.1 | dev | jest-dom → vitest → jsdom/vite → source-map-js; S | Dev-only | source-map-js 1.2.2 |
| jsdom 30.1.1 | dev | jsdom → css-tree (directo y selectores) → source-map-js; S | Dev-only | source-map-js 1.2.2 |
| css-tree 3.2.1 | dev | jsdom → css-tree → source-map-js; S | Dev-only | source-map-js 1.2.2 |
| @asamuzakjp/dom-selector 9.2.1 | dev | jsdom → dom-selector → css-tree → source-map-js; S | Dev-only | source-map-js 1.2.2 |
| @bramus/specificity 2.4.2 | dev | jsdom → specificity → css-tree → source-map-js; S | Dev-only | source-map-js 1.2.2 |
| @csstools/css-syntax-patches-for-csstree 1.1.14 | dev | jsdom → css-syntax-patches → css-tree → source-map-js; S | Dev-only | source-map-js 1.2.2 |

Evidencia: `npm explain @grpc/grpc-js source-map-js --json`, lockfile y
`@firebase/firestore/package.json`: exports browser resuelve `dist/index.esm.js`,
mientras Node resuelve `index.node.*`. Build de diagnóstico con Vite 8.3.1,
`--sourcemap`, en directorio temporal: 67 fuentes en mapas JS; ninguna contiene
grpc ni source-map-js. Firestore resuelve `dist/index.esm.js` y su módulo ESM
común. La app importa firebase/app, auth y firestore, no compat ni un servidor
gRPC. El sitio publicado sirve assets estáticos; no ejecuta el tooling Node.
El bundle remoto `CloudApp-C0Q_6BuD.js` contiene versión 1.0.0 y no contiene
`getAuthContext` ni `IndexedSourceMapConsumer` (comprobación complementaria,
no usada por sí sola como prueba de ausencia).

Conclusión del gate A: **PASS en el alcance de los 16 hallazgos: 0 HIGH
relevantes/explotables identificados en el runtime browser publicado**.
No equivale a auditar el servicio Firebase gestionado, las reglas Firestore,
el entorno de desarrollo ni toda la aplicación. Los advisories son reales;
no se clasifican como falsos positivos.

No se modificaron dependencias ni se ejecutó audit fix. El parche dev-only
source-map-js 1.2.2 cabe en los rangos ^1.2.1 de sus padres y queda como mejora
de tooling disponible, no como requisito del gate runtime. grpc 1.13.6 queda
fuera del rango ~1.9.0 de Firestore: no se fuerza ni se añade override.
Los datos crudos y mapas de diagnóstico permanecen locales bajo
`node_modules/.release-evidence/release-audit/`, excluidos de Git y distribución.
