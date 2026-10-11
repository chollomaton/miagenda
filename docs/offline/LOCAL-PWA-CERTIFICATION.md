# Certificación local offline 1.2

El registro pertenece al arranque común mirror y usa `BASE_URL` (`/miagenda/`), scope explícito y `updateViaCache: none`. El worker manual se genera al finalizar `npm run build`; ejecutar sólo Vite no genera el shell. La identidad instalada y el start URL 1.1 se conservan para actualizar la misma instalación.

Sólo se precachean raíz, index, manifest sin query, cuatro iconos y los chunks emitidos del build. No hay runtime caching ni acceso del SW a IndexedDB. Navegación: raíz, start URL conocido y rutas explícitas `dashboard`, `calendar`, `tasks`, `reminders`, `notes`, `labels`, `templates`, `settings` con slash final opcional. Queries ajenas y rutas API/privadas no se interceptan. El fallback entrega index; no implementa un router nuevo.

La activación reclama clientes después de limpiar sólo shells obsoletos. No hay skipWaiting automático: actualizaciones necesitan acción explícita, editor cerrado y una sola ventana. El mirror es solo lectura: flush no necesita persistir mutaciones. La restauración usa Firebase Auth local, después LocalMirrorSession scoped por proyecto/uid y publisher, valida el snapshot y sólo entonces lo adopta. No se crea un locator global que sustituya Auth. Sin sesión offline aparece un mensaje claro y el login queda deshabilitado.

## Reproducción sin Firebase real

Desde el repo, con Node 24 y Chrome instalado. Reutilizar una instalación existente de playwright-core mediante PLAYWRIGHT_MODULE (ruta absoluta a index.mjs); no se añadió dependencia ni navegador descargado.

```sh
VITE_FIREBASE_API_KEY=offline-fixture-key \
VITE_FIREBASE_AUTH_DOMAIN=offline-fixture.invalid \
VITE_FIREBASE_PROJECT_ID=offline-fixture \
VITE_FIREBASE_APP_ID=offline-fixture npm run build
PLAYWRIGHT_MODULE=/ruta/absoluta/playwright-core/index.mjs node scripts/check-offline-browser.mjs
npm run check
```

El harness falla si el build no tiene la configuración sintética. Sirve exclusivamente en loopback con prefijo Pages y sin fallback del servidor. Bloquea peticiones externas, inserta una sesión Firebase sintética y la generación de interoperabilidad Swift en IndexedDB desde el navegador, fuera del bundle. Verifica registro automático, scope, control, actualización explícita con click real, precache estático, cinco cierres/reaperturas de pestaña offline y refresh, nota visible, otro owner, logout y retorno de shell online. Contexto efímero eliminado al terminar.

Los ciclos abren nuevas páginas sin memoria JS previa, conservando el perfil local y SW. No equivalen a reiniciar el proceso completo de Chrome ni a instalar una PWA de iOS. La revalidación remota exitosa se prueba en suites locales de session/runtime; el harness deliberadamente bloquea Firebase, así que no acredita una revalidación contra el servicio real.

Tras probar, `npm run check` restaura el build normal sin fixtures/config sintéticos. No desplegar el build sintético. El scanner y check-mirror-production forman parte del check normal.
