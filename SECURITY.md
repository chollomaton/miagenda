# Seguridad

Texto renderizado por React, URLs limitadas a HTTP/HTTPS, CSP local y shell PWA con allowlist.
Almacenamiento separado por identidad, invalidación por generación y diagnóstico sin contenido personal.
El cierre de sesión desacopla memoria y sincronización; las operaciones pendientes quedan en el espacio privado de su usuario para evitar pérdida de datos.
El backup excluye credenciales, cursores y outbox; contiene datos personales introducidos por el usuario.
`npm run security` revisa patrones peligrosos, secretos, correos reales y artefactos de plataforma prohibidos; no sustituye una auditoría completa.
