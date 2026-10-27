# Contour — primera versión
14 de octubre de 2026. Studio rosa de siluetas con jitter, integrado a Basement.

Entrada: PNG transparente o figuras oscuras sobre fondo claro. Auto usa alpha si encuentra transparencia significativa; Mask permite elegir explícitamente Transparency o Light background. Auto / Foreground usa ORMBG q8 para separar el primer plano de fotografías opacas. Las imágenes transparentes usan directamente su alpha.

Silueta: Threshold, Roughness (simplificación en píxeles de la imagen), Fill, Stroke Width y fondo transparente / imagen original / color. Motion: Jitter, FPS, seed editable y Random, Labels y tamaño de letra. Colores independientes para relleno, borde/etiquetas y fondo. Preview fijo, paneles con scroll, zoom/pan, undo/redo.

Motor: máscara de primer plano de hasta 1000 px, trazado de límites de píxeles, Douglas-Peucker, conservación de huecos con fill evenodd, jitter determinista por vértice. La exportación redibuja estos contornos: PNG hasta 6000 px / 32 MP; GIF hasta 2400 px / 4 MP en loop de 2 segundos, con cadencia ajustada por FPS. No recupera detalle que no exista en la máscara.

Guardado: .ment portables en la carpeta elegida, con IndexedDB como recuperación y biblioteca/apertura desde el hub. Formato basement.ment v1, studio contour, imagen fuente y ajustes editables.

Validación: 12 pruebas de Basement pasan. Chrome carga figuras con transparencia, conserva huecos, guarda y reabre; PNG 4500×6000, GIF 24 cuadros con movimiento y alpha.

## Detección de figuras
ORMBG q8 + Transformers.js 3.8.1 y ONNX Runtime WASM están instalados en `models/` y `vendor/` (~67 MB). Inferencia en worker, una vez por imagen; máscara PNG almacenada dentro de source.foreground en el proyecto local y .ment. No se envían las imágenes a servicios externos. Puede tardar al cargar el modelo por primera vez. Mask permite detección de primer plano, transparencia o umbral clásico. Figures permite todas las figuras significativas o solo el componente principal. Limpieza de manchas pequeñas y jitter espacial coherente. La segmentación automática puede requerir ajustar Threshold según la imagen.
Fuentes técnicas y licencias: dist/contour/vendor/NOTICE.md.
