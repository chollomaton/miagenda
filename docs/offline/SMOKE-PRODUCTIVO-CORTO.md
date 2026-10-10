# Próximo Work — smoke productivo corto (NO ejecutado aquí)

1. Precheck: web/nativo limpios, hashes de commits, producción 1.1 estable, configuración 1.1 de Rules/Auth respaldada de forma privada y rollback preparado. Confirmar plan gratuito sin cambios de billing.
2. Recrear exclusivamente las siete entidades TEST: dos eventos, dos recordatorios, una nota, una etiqueta y una plantilla. Preflight de captura/validación; seleccionar sólo calendarios y carpeta TEST.
3. Promoción temporal mínima de Rules/Auth conforme al procedimiento anterior; no desplegar hosting. Comprobar denegación ajena y preservar datos 1.1.
4. Pairing real nuevo, challenge único y aprobación antes de expiry. Verificar grant/lease; no reutilizar capacidades consumidas.
5. Publicar primera generación TEST. Abrir build 1.2 de producción desde origen seguro con prefijo `/miagenda/`, sin query diagnóstica. Comprobar siete entidades, hashes y solo lectura.
6. Esperar SW ready: registro activo con scope exacto, controller presente y precache completo. Si hay actualización pendiente, aceptarla con una única ventana y esperar recarga/ready. No registrar manualmente el SW para producir un PASS.
7. Cerrar la página/PWA, cortar red para todo el contexto, reabrir por URL directa/start_url. Ver shell, `iCloud · Solo lectura`, indicador offline y las siete entidades de la generación validada. Refresh profundo bajo el scope debe volver al shell. Si se usa iPhone, repetir desde PWA instalada; icono antiguo sigue deferido.
8. Recuperar red: revalidar sesión y copia real sin perder datos. Cambiar owner/logout y comprobar que no se muestra la caché anterior. Verificar que Cache Storage sólo contiene recursos estáticos.
9. Revocar grant y comprobar rechazos de autoridad previstos, antes de retirar credenciales. Detener publisher. Limpiar sólo fixtures/caché/locator TEST de esa pareja, sin borrados amplios ni datos personales.
10. Restaurar exactamente Rules/Auth 1.1, confirmar hashes/config y web 1.1. Ejecutar validaciones finales, scanner 0 y revisar árboles/HEADs. Conservar evidencia sanitizada; no merge/tag/release/publicación de 1.2 dentro del smoke sin la decisión posterior correspondiente.

Gate: ante fallo de offline, scoping, integridad o autoridad, parar y ejecutar revoke/cleanup/rollback. La promoción y publicación final de 1.2 no forman parte de este runbook de ensayo.
