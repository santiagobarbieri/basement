# Basement Beta 2.0 — estado actual

27 Oct 2026. Beta 2.0 publicada en https://basement-two-gamma.vercel.app/. Código en https://github.com/santiagobarbieri/basement, rama main, con publicación automática en Vercel. Historial anterior conservado; etiqueta desktop-before-beta-2-2026-10-27.

Hub con siete Studios: Endo, Kiln, Tremor, Foundry, Contour, Marble y Distortion. Biblioteca de Artboards con grilla/lista, búsqueda, filtros, selección múltiple, creación en dos pasos, perfil local y temas. Export, Import y Trash están junto a Search en la barra superior, como en la última referencia. Studios / Apps, About y Contact permanecen en Coming soon.

Estructura fija, scroll limitado a las colecciones de Artboards, cuatro cards por fila en escritorio, con ancho adaptable y separación de 16 px. Bordes suaves de gris neutro en ambos temas. Filtro por encima de la grilla, símbolo activo visible y filas de navegación estables sin separadores sobre las esquinas de la selección. Storage distingue bytes reales por Studio/papelera y cuota estimada del navegador.

Endo recibió su primera pulida con la identidad del hub: cabecera integrada de guardado/exportación, temas compartidos, herramientas sobre el lienzo, controles agrupados por alcance y vista previa fija. Verificado en Chrome aislado: tres materiales, selección e historial, guardado en carpeta, exportación .ment/PNG transparente, ambos temas y escritorio compacto.

Un .ment portable por Artboard en la carpeta elegida. Guardado automático a los cinco segundos, guardado manual, IDs estables, mudanzas verificadas, ZIP con resolución de conflictos y papelera con confirmación de eliminación/vencimiento. Errores de disco bloquean la edición con recuperación y copia de emergencia. Cambios externos permiten elegir la versión. Apertura confirmada sin aviso de salida; el trabajo realmente pendiente mantiene su protección.

Sitio por URL, launcher de desarrollo en pestaña normal y una sola sesión activa. Sin instalación ni caché offline. Actualizaciones únicamente desde el hub y sin operaciones o ventanas pendientes.

Se retiraron releases históricas, prototipos, launchers reemplazados, empaquetado de escritorio y recursos sin dependencias activas. Documentación útil reunida en docs/. Se mantienen pruebas, dependencias de motores y avisos/licencias de terceros. Los modelos de Contour son necesarios y continúan en dist/contour/.

Pruebas: motores y formatos en tests/*.test.mjs; almacenamiento, uso de espacio y ZIP; flujos integrados de hub/Studios en Chrome aislado. No usar la biblioteca real para QA. Regenerar el índice de versiones después de cualquier edición de dist/.

Decisiones vigentes: docs/requirements-beta-2.md. Detalles de cada Studio: docs/studios/.

Publicación verificada sobre HTTPS: ocho rutas públicas, tipos MIME de modelos/WASM, headers de actualización, BUILD idéntico a la versión revisada y validación completa de recursos. Chrome aislado comprobó la API segura de carpeta, apertura de Endo, guardado manual y regreso al hub con OPFS temporal; no se usó la biblioteca real.
