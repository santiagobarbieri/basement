# Basement Beta 2.0

**Sitio público:** https://basement-two-gamma.vercel.app/

**Repositorio:** https://github.com/santiagobarbieri/basement

Sitio estático de herramientas creativas para Google Chrome. Desarrollo local sin framework ni instalación: abrir **Abrir BASEMENT.command**. El launcher inicia el servidor y abre una pestaña normal en `http://127.0.0.1:8000/hub/`.

Conservar ese origen y la base IndexedDB `basement-projects`. Para comprobar el servidor: `python3 scripts/launch.py --status`. Solo se sirve `dist/`; el launcher avisa si el puerto 8000 está ocupado por otro servidor.

## Artboards

Elegir una carpeta antes de crear o importar. Cada Artboard es un `.ment` portable que contiene sus recursos y solo se edita con su Studio. La carpeta es el destino principal; el navegador recuerda el permiso y conserva una copia de recuperación.

- Autoguardado a los cinco segundos de inactividad y guardado manual.
- Nombres únicos, renombrado con identificadores estables y duplicación.
- Abrir, copiar o mover bibliotecas desde Settings → Folder; verificar copias antes de eliminar originales.
- Importar `.ment` o ZIP, resolver conflictos y exportar biblioteca o selección.
- Trash dentro de `.basement-trash/`, restauración y eliminación con confirmación. Los vencidos a los 30 días requieren una última decisión del usuario.
- Ante un fallo de disco, bloquear la edición y ofrecer reconexión, reintento y `.ment` de emergencia. Nunca presentar una copia de IndexedDB como guardado exitoso en disco.

El hub tiene grilla/lista, búsqueda, filtro, selección múltiple, perfil local, temas y desglose de Storage. Export, Import y Trash están en la barra superior. Una sola pestaña activa; el Studio se abre en esa misma pestaña. Studios / Apps, About y Contact muestran Coming soon.

## Studios disponibles

| Studio | Técnica | Documentación |
| --- | --- | --- |
| Endo | Pinceles con textura y relieve | [Endo](docs/studios/endo.md) |
| Kiln | Mosaicos y materiales | [Kiln](docs/studios/kiln.md) |
| Tremor | Trazos animados | [Tremor](docs/studios/tremor.md) |
| Foundry | Creación y exportación de tipografías | [Foundry](docs/studios/foundry.md) |
| Contour | Siluetas y separación de figuras | [Contour](docs/studios/contour.md) |
| Marble | Marmolado y exportaciones animadas | [Marble](docs/studios/marble.md) |
| Distortion | Fragmentos y tratamientos de imagen | [Distortion](docs/studios/distortion.md) |

Crear y abrir Artboards desde el hub. La ruta `/` lleva al hub cuando no tiene parámetros; los Artboards de Endo mantienen `/?project=…`.

## Conexión y actualizaciones

El sitio necesita conexión para cargar. Una sesión abierta puede seguir editando y guardando en la carpeta si se desconecta. No hay instalación PWA ni copia offline.

Settings → Updates detecta nuevas versiones. Solo se aplican desde el hub, sin otras ventanas, operaciones o guardados pendientes. Nunca forzar una recarga en un Studio ni borrar datos del navegador.

Después de editar `dist/`, ejecutar:

```sh
python3 scripts/build-precache.py
```

También existe `node scripts/gen-precache.mjs`. El launcher regenera el índice automáticamente. `dist/precache.json` y el BUILD generado de `dist/sw.js` deben permanecer sincronizados; no editar el hash a mano.

## Estructura

- `dist/`: aplicación, recursos utilizados y dependencias locales de los Studios.
- `scripts/`: launcher y generadores de revisión.
- `tests/`: pruebas de motores, formatos, almacenamiento y navegador.
- `docs/requirements-beta-2.md`: decisiones vigentes del producto.
- `docs/studios/`: documentación técnica de los siete Studios.
- `docs/design/`: referencia de diseño de Distortion.
- `STATUS.md`: estado actual resumido.

Los modelos ONNX y WASM de Contour se usan para separar figuras del fondo. Las dependencias de Foundry generan fuentes. Sus archivos `LICENSE` y `NOTICE` forman parte de la distribución y deben conservarse.

## Verificación

```sh
node tests/storage-usage.test.mjs
node tests/folder-workspace.test.mjs
node tests/hub-utilities.test.mjs
node tests/pwa-browser.mjs
node tests/studio-browser.mjs
node tests/endo-ui-browser.mjs
```

Las pruebas de Chrome usan un perfil y una biblioteca OPFS temporales, con servidor aislado. Nunca acceden a la biblioteca real. La ejecución local de Chrome requiere permiso fuera del sandbox. El nombre histórico `pwa-browser.mjs` se conserva para la prueba del sitio online y sus actualizaciones.

## Publicación

El proyecto Vercel `basement` está conectado a `main` de GitHub. Cada push publica automáticamente con `vercel.json`: sin framework, build `node scripts/gen-precache.mjs` y salida `dist/`. Las rutas de los Studios se sirven sin reescritura SPA.

La configuración local de Vercel y las credenciales de GitHub no se versionan. El historial de la app anterior permanece en Git; la etiqueta `desktop-before-beta-2-2026-10-27` señala el último commit de escritorio.

El sitio público tiene su propio permiso de carpeta, separado del origen local. Al entrar por primera vez, elegir la carpeta de Artboards existente permite abrir los mismos `.ment`.
