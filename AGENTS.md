# Basement

- Sitio estático en `dist/`, sin framework. Beta 2.0 se usará por URL en Chrome; el comando se conserva solo para desarrollo local. No agregar instalación PWA ni caché offline.
- Mantener el origen `http://127.0.0.1:8000` y la base IndexedDB `basement-projects` para conservar la biblioteca.
- Después de editar archivos en `dist/`, ejecutar `python3 scripts/build-precache.py` (o `node scripts/gen-precache.mjs`). El índice y la revisión de `dist/sw.js` deben quedar sincronizados. No editar manualmente el hash de BUILD.
- El launcher regenera el índice y abre una pestaña normal de Chrome. El worker verifica versiones sin guardar una copia offline. Una sesión abierta no se recarga automáticamente; actualizar desde el hub.
- Actualizar desde el hub solamente. Conservar el bloqueo de actualización si hay otras ventanas abiertas. No forzar recargas en Studios ni borrar IndexedDB al actualizar.
- Para cambios de plataforma/actualizaciones, comprobar `node tests/pwa-browser.mjs` (nombre histórico): usa Chrome y servidor aislados, necesita permiso de ejecución local fuera del sandbox. Nunca probar borrando la biblioteca real.

- El guardado principal de proyectos usa la carpeta elegida (File System Access). `project-store.js` es la interfaz común; IndexedDB conserva el permiso y la copia de recuperación. No hacer fallback silencioso a IndexedDB si falla la escritura en disco. Mantener los `.ment` portables y los identificadores estables al renombrar.
- Para cambios de almacenamiento: `node tests/folder-workspace.test.mjs` y `node tests/pwa-browser.mjs`. Los tests de Chrome usan OPFS en un perfil aislado y no deben acceder a la biblioteca del usuario.
