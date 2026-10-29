# Basement Beta 2.0 — estado actual

## Desarrollo local de Endo — 29 Oct 2026

Sin commits, push ni publicación, por pedido de Santi. Punto de retorno: 787b10f. Se retiró Settings; Layers ocupa su espacio, admite selección múltiple y acciones en lote. Cada gesto se pinta en la capa activa, con nuevas capas manuales; pintar sobre un ajuste crea un único destino encima. Pinceles normales con ocho presets y color plano se controlan arriba; los seis materiales ahora se aplican por capa desde Blending Options. Miniaturas reales y menú con clic izquierdo permiten rasterizar, combinar, duplicar y borrar. New Layer, Blending Options y Artboards ocupan temporalmente la columna derecha hasta cerrar o crear. F abre presets y propiedades de artboards. Los filtros se editan individualmente desde Layers, con un catálogo de 14 efectos que incluye Brightness, Contrast y texturas de pintura.

High es el valor inicial, con render Retina y presupuesto de 6 M píxeles; Standard y Draft permiten reducir calidad/costo. PNG reconstruye originales a 2× independientemente del preview. Formato Endo .ment v2, biblioteca y otros Studios conservados. Ver docs/studios/endo.md y el análisis inicial de integración por capa en docs/studios/endo-4-tremor-analysis.md. La fusión con Tremor todavía no se implementa.


27 Oct 2026. Beta 2.0 publicada en https://basement-two-gamma.vercel.app/. Código en https://github.com/santiagobarbieri/basement, rama main, con publicación automática en Vercel. Historial anterior conservado; etiqueta desktop-before-beta-2-2026-10-27.

Hub con siete Studios: Endo, Kiln, Tremor, Foundry, Contour, Marble y Distortion. Biblioteca de Artboards con grilla/lista, búsqueda, filtros, selección múltiple, creación en dos pasos, perfil local y temas. Export, Import y Trash están junto a Search en la barra superior, como en la última referencia. Studios / Apps, About y Contact permanecen en Coming soon.

Estructura fija, scroll limitado a las colecciones de Artboards, cuatro cards por fila en escritorio, con ancho adaptable y separación de 16 px. Bordes suaves de gris neutro en ambos temas. Filtro por encima de la grilla, símbolo activo visible y filas de navegación estables sin separadores sobre las esquinas de la selección. Storage distingue bytes reales por Studio/papelera y cuota estimada del navegador.

Endo trabaja con frames finitos de 64–2048 px por lado, cada uno con fondo y capas propios. La repetición usa el frame activo. Los efectos son capas de ajuste reordenables entre trazos, con propiedades flotantes y alcance sobre el contenido inferior del mismo frame. Vista de edición reducida, miniaturas de 96 px para frames inactivos y PNG del frame elegido a 2× desde los originales. Formato Endo .ment v2 con importación v1 y conservación de los datos anteriores; los demás Studios mantienen su formato. Verificado en Chrome aislado: clipping, cambio de frame/calidad, capas y ajustes, popup, resize/move, PNG con/sin fondo, historial, guardado/reapertura, temas y layout compacto.

Un .ment portable por Artboard en la carpeta elegida. Guardado automático a los cinco segundos, guardado manual, IDs estables, mudanzas verificadas, ZIP con resolución de conflictos y papelera con confirmación de eliminación/vencimiento. Errores de disco bloquean la edición con recuperación y copia de emergencia. Cambios externos permiten elegir la versión. Apertura confirmada sin aviso de salida; el trabajo realmente pendiente mantiene su protección.

Sitio por URL, launcher de desarrollo en pestaña normal y una sola sesión activa. Sin instalación ni caché offline. Actualizaciones únicamente desde el hub y sin operaciones o ventanas pendientes.

Se retiraron releases históricas, prototipos, launchers reemplazados, empaquetado de escritorio y recursos sin dependencias activas. Documentación útil reunida en docs/. Se mantienen pruebas, dependencias de motores y avisos/licencias de terceros. Los modelos de Contour son necesarios y continúan en dist/contour/.

Pruebas: motores y formatos en tests/*.test.mjs; almacenamiento, uso de espacio y ZIP; flujos integrados de hub/Studios en Chrome aislado. No usar la biblioteca real para QA. Regenerar el índice de versiones después de cualquier edición de dist/.

Decisiones vigentes: docs/requirements-beta-2.md. Detalles de cada Studio: docs/studios/.

Publicación verificada sobre HTTPS: ocho rutas públicas, tipos MIME de modelos/WASM, headers de actualización, BUILD idéntico a la versión revisada y validación completa de recursos. Chrome aislado comprobó la API segura de carpeta, apertura de Endo, guardado manual y regreso al hub con OPFS temporal; no se usó la biblioteca real.
