# Endo 4.0 — integración de Tremor: análisis inicial

29 de octubre de 2026. Propuesta basada en el código local. Este documento no implementa la fusión ni cambia los archivos de Tremor.

## Recomendación

Integrar Tremor como **Motion aplicado a una capa de dibujo de Endo**, separado del material de la capa y de los filtros de imagen. La pintura usa pinceles normales; los materiales se aplican desde Blending Options. Chrome, Relief, Crayon, Cement, Sand y Powder deben poder recibir Antenna, Signal o Ghost sin cambiar de pincel. Endo conserva artboards, capas, borrador, materiales, ajustes y exportación estática; Motion agrega una evaluación temporal de los gestos originales.

No reemplazar el motor de Endo por el de Tremor. Tremor hoy pinta color base y ruido animado; Endo reconstruye relieve, textura, luces, sombras y composición por capas. Copiar el motor completo perdería esa identidad y el orden de ajustes. Tampoco conviene registrar cada cuadro como un cambio del proyecto: reproducir y pausar nunca deben ensuciar el guardado ni generar Undo.

## Qué ya existe y qué puede reutilizarse

| Pieza | Código | Reutilización y límite |
|---|---|---|
| Deformación determinista | [`livePoints`](../../dist/tremor/motion.js) | Antenna mueve X/Y con ruido espacial; Signal desplaza principalmente X por líneas; conserva tiempo, presión y puntos fuente. Reutilizar el algoritmo como función pura que reciba tiempo, configuración y origen local. |
| Detalle a lo largo del gesto | [`livePoints`](../../dist/tremor/motion.js) | Remuestrea segmentos cada 3 unidades, incluso una línea definida por dos puntos. Preparar esa malla una vez; el código actual vuelve a crearla en cada evaluación. |
| Settle | [`motion.js`](../../dist/tremor/motion.js) | La amplitud decae según edad y Settle. No es un efecto periódico: no puede repetirse como loop sin definir qué pasa con la edad. |
| Ghost | [`rebuild`](../../dist/tremor/engine.js) | Dibuja una segunda pasada a `t − 100 ms`, ancho ×0,65 y opacidad 0,3, con desplazamiento adicional. Extraer la estrategia; no copiar su composición de altura máxima como si fuera una capa alfa de Endo. |
| Ruido animado | [`ChromeSurface.render`](../../dist/tremor/engine.js) | Se suma al RGB según tick. Debe incorporarse después del sombreado del material de Endo y antes de sus ajustes de imagen. |
| Exportación animada | [`gif-worker.js`](../../dist/tremor/gif-worker.js), [`gif-encode.js`](../../dist/tremor/gif-encode.js) | Worker y codificador locales ya disponibles. El worker actual usa el motor de Tremor y no sabe de capas/artboards de Endo: se reemplaza su llamada de render, no se reutiliza sin cambios. |
| Recorte y capas | [`FrameSurface`, `LayeredSurface`, `renderLayerDocument`](../../dist/endo-renderer.js) | Deben seguir siendo la base. El límite de cada artboard, su fondo y su pila de ajustes se aplican también a cada cuadro animado. |
| Persistencia de edad | [`ment-format.js` de Tremor](../../dist/tremor/ment-format.js), [`freezeState`/`resumeState`](../../dist/project-store.js) | Ya distinguen edad guardada de `performance.now()`. Usar esa separación como antecedente, sin trasladar el reloj de ejecución al archivo. |

Los modos antiguos de pincel `antenna`, `signal` y `ghost` ya se normalizan a `brush: 'tremor'` más `animation` al abrir Tremor; el adaptador debe respetar esa compatibilidad. Véase [`loadState`](../../dist/tremor/app.js).

## Orden de evaluación propuesto

```text
Gestos originales de una capa (paint y erase)
  → Motion de geometría en coordenadas locales del artboard
  → repetición/simetría del gesto
  → raster de altura, cobertura y propietario de Endo
  → sombreado y textura del material
  → ruido temporal de superficie, si está habilitado
  → composición de la capa y ajustes superiores, en su orden
  → fondo y recorte del artboard
```

Antenna y Signal son efectos de geometría, no filtros RGB. Brightness/Contrast/Dither y los filtros de pintura siguen siendo ajustes de imagen y conservan el orden de la pila. No usar el mismo `roughness` para relieve y movimiento: `motion.roughness` y `settings.roughness` necesitan controles y campos separados.

La repetición se aplica **después** de deformar el gesto base, para conservar el comportamiento actual de Tremor: las copias repiten la misma deformación. Un modo de ruido independiente por copia sería una opción posterior.

El campo de movimiento debe usar `point − artboard.origin`, de manera que mover el artboard no cambie su animación. Hoy Tremor evalúa ruido en coordenadas del documento; Endo ya ancla las texturas de materiales al artboard mediante `textureOriginX/Y` en [`engine.js`](../../dist/engine.js). La semilla debe ser estable y persistida; no usar el índice visual de una capa o de un trazo, porque ordenar/duplicar/borrar cambiaría el efecto.

**Borrador:** deformar tanto pintura como borrado con el mismo campo de la capa. Un agujero borrado debe acompañar al material; mantener el borrador quieto mientras la pintura se mueve produciría reapariciones inesperadas. Esta regla necesita pruebas de cobertura y bordes. Ghost requiere una composición adicional con alfa real; el motor actual de Endo no aplica `settings.opacity` al depositar material. Duplicar un `StrokeBuilder` y pasar `opacity: .3` no basta: esa opacidad debe aplicarse al componer la pasada fantasma, sin convertirla en una capa guardada por cuadro.

## Datos y compatibilidad

Configuración propuesta, todavía no implementada:

```js
project.playback = { durationMs: 2000, previewFps: 12, loop: true, posterTimeMs: 0 };
paintLayer.motion = {
  enabled: false, mode: 'antenna', amount: 3, rate: 12,
  roughness: 70, settle: 0, noise: 10,
  seed: 12345, timeOffsetMs: 0
};
```

- **Capa:** tipo de movimiento y sus parámetros, semilla y desplazamiento temporal. Un mismo campo permite que varios trazos y borrados formen una pieza coherente. Los valores específicos por trazo quedan fuera del primer alcance.
- **Artboard:** habilitación/pausa de su reproducción y tiempo de póster para exportación estática. No duplicar todos los parámetros de Motion en cada artboard.
- **Project:** duración, loop y tasa de previsualización/exportación. El reloj en ejecución, cachés y estado de selección no se serializan.
- **Documento estático:** Motion ausente equivale a desactivado y debe producir los mismos píxeles que Endo actual.

No introducir esos campos a escondidas en `.ment` v2. [`editableContent`](../../dist/ment-format.js) serializa un conjunto explícito y [`metadata`/validación](../../dist/endo-model.js) reconstruye metadatos de capa. Un lector actual podría descartar propiedades nuevas o rechazarlas; [`importMent`](../../dist/project-store.js) admite v1 y v2 solo para Endo. La implementación debe definir una revisión de formato con capacidad explícita de Motion —propuesta: `.ment` v3, independiente del nombre comercial Endo 4.0—, lectores v1/v2/v3 y validación de rangos. Los documentos estáticos pueden seguir escribiéndose como v2 si no necesitan campos nuevos. Nunca exportar como v2 una animación cuyo movimiento se perdería al reabrir.

La migración de Tremor debe ser una acción explícita **“Abrir una copia en Endo”**, no reescribir automáticamente la biblioteca. Se conserva el `.ment` Tremor original. La copia recibe identificador nuevo y conserva gestos/números, colores, edades y procedencia. Sus marcos actuales son áreas de exportación, no contenedores de capas: elegir primero el encuadre a convertir en artboard y mostrar una previsualización. Si excede el máximo de artboard de Endo, ofrecer encuadre, escala o varios artboards; no eliminar puntos ni inventar una equivalencia silenciosa.

## Tiempo, loop y guardado

Primera versión: loop de dos segundos, para comparar exactamente con Tremor. `rate` actual es entero entre 1 y 24; el índice del ruido se repite cada `2 × rate`. Para duraciones variables habrá que parametrizar el número de ticks y fijar un único reloj para editor y exportación.

Settle necesita una elección visible. El GIF actual calcula la amplitud correspondiente a la edad al iniciar la exportación, la congela y desactiva el envejecimiento adicional; así el loop no cambia de fuerza entre cuadros. Recomendación inicial: conservar ese resultado como **“Loop con amplitud actual”**. Una futura animación de asentamiento progresivo será un modo de una sola reproducción y no se prometerá como loop sin salto.

Play/Pause cambia solo el reloj de vista. Guardar conserva parámetros, edad/tiempo de referencia y póster; no conserva `performance.now()`. Pausar y volver a reproducir no reinicia Settle por accidente. PNG exporta el cuadro del póster explícito; GIF evalúa una secuencia temporal congelada a partir de la versión del documento que el usuario eligió exportar.

## Render y rendimiento

El bucle actual de [`tremor/app.js`](../../dist/tremor/app.js) reconstruye toda la superficie con `setInterval(1000/24)`. No trasladarlo a un Project de varios artboards.

1. Un scheduler por Project, con reloj monotónico, pausa al ocultarse la pestaña y evaluación solo cuando cambia el tick de una capa animada. Una capa a 1 fps no debe reconstruirse 24 veces por segundo.
2. Mantener rasters de las capas estáticas. Agregar invalidación y reconstrucción de **las capas animadas**, no llamar al replay completo de todos los artboards por tick.
3. Tiempo de ejecución separado de `scene`: la clave [`sourceKey`](../../dist/endo-renderer.js) incluye `scene`; añadir `scene.frameTime` invalidaría también cachés estáticas y miniaturas. La clave temporal debe afectar únicamente a entradas animadas.
4. Solo el artboard activo anima a la calidad de edición elegida. Los demás muestran miniatura congelada en su póster; activar otro artboard cambia el destino del scheduler. No hacer una animación por miniatura del Project.
5. Cachear el remuestreo de puntos y descartar cuadros atrasados; priorizar respuesta del puntero. Selección/transformación puede pausar temporalmente en un cuadro estable para que sus tiradores no salten. El propietario del píxel debe seguir remitiendo al gesto fuente, no a un gesto temporal nuevo.
6. Conservar un presupuesto de memoria por artboard y una indicación real de calidad. El control de resolución de esta iteración no debe convertirse en promesa de animar/exportar sin límite. El benchmark debe medir número de puntos remuestreados, capas animadas, resolución, tiempo por cuadro y memoria.

## Exportación animada y límites concretos

Tremor hoy exporta **25 cuadros de 80 ms** (2 segundos, muestreo de 12,5 fps), como muestra [`gif-worker.js`](../../dist/tremor/gif-worker.js). [`gifGeometry`](../../dist/tremor/gif-geometry.js) limita a 640 px por lado, 320.000 píxeles por cuadro y resolución lógica ≤0,5. El encoder usa paleta fija de 216 colores y alfa binaria (`alpha < 128` transparente): el metal y las transparencias suaves de Endo perderán información. Se debe explicar esa limitación en Export, no degradar el canvas para parecerse al GIF.

Primer prototipo: un artboard, mismo límite actual, worker y botón Cancel, progreso por cuadro; cada cuadro usa `renderLayerDocument` con una instantánea temporal de sus gestos. Cambiar parámetros durante la exportación no cambia esa instantánea. El número de cuadros, dimensiones y cantidad de capas se validan antes de reservar memoria.

El worker actual guarda **todos los RGBA** en `frames[]`, y `encodeGif` acumula arrays de bytes y códigos. A 640 × 500 × 25, los RGBA solos ocupan unos 32 MB; a 4096² × 25, unos 1,68 GB, sin rasters ni encoder. No subir el límite copiando el PNG 2× de Endo. Antes de exportar más grande: encoder incremental por cuadros y reducción de copias; luego render de cada cuadro por teselas con margen para sombreado y filtros espaciales. La equivalencia ROI/full está cubierta para el motor estático por [`resolution.test.mjs`](../../tests/resolution.test.mjs), pero debe repetirse para Motion, Ghost, filtros espaciales y dither. Render por teselas no reduce por sí solo el tamaño del archivo ni la memoria del encoder actual.

## Plan de implementación y pruebas de aceptación

| Paso | Entrega concreta | Prueba que debe pasar antes de avanzar |
|---|---|---|
| 1. Adaptador puro | `endo-motion.js`: evaluar puntos sin mutar fuente; Antenna y Signal; coordenadas locales y semilla persistida. | Amplitud cero produce los originales; mismo tiempo/semilla da idéntico resultado; mover artboard conserva el aspecto; bordes/tiempo/presión intactos; mismo loop a 0 y 2000 ms con Settle congelado. |
| 2. Capas vivas | Motion por capa, controles desde Layers y Play/Pause; materiales Endo intactos. | Una capa estática no se reconstruye por tick; borrados acompañan la pintura; ajustes solo afectan lo que tienen debajo; solo anima el artboard activo; seleccionar sigue identificando el trazo fuente. |
| 3. Formato y migración | Capacidad Motion y lector nuevo; “Abrir copia de Tremor”. | Ida/vuelta conserva parámetros, edades, semillas, marcos y gestos; v1/v2 siguen abriendo; original Tremor queda sin cambios; reproducción no produce dirty/Undo ni escrituras periódicas. |
| 4. Ghost y Noise | Pasada fantasma con composición alfa; ruido temporal sobre sombreado. | Opacidad 0,3 real, clipping y borrador correctos; cambio de material no elimina Motion; diferencias temporales deterministas; pruebas de orden con Threshold/Dither. |
| 5. Exportación | GIF de un artboard con progreso, Cancel y límite actual; PNG de póster. | Mismas muestras temporales entre preview y worker; dimensiones/fondo correctos; Settle congelado consistente; export no depende del tiempo de ejecución ni de la calidad de edición; cancel libera worker. |
| 6. Calidad mayor | Encoder incremental y teselas, con límite definido por benchmark en el Mac de Santi. | Memoria acotada por tamaño de trabajo; equivalencia de píxeles entre teselas/full; nunca archivo vacío ni bloqueo silencioso; sesiones, guardado y actualización del hub continúan funcionando. |

Base de regresión útil: [`tremor.test.mjs`](../../tests/tremor.test.mjs) ya cubre amplitud, inmutabilidad, Settle y firma estable; [`tremor-areas.test.mjs`](../../tests/tremor-areas.test.mjs) cubre recorte, coordenadas negativas y `.ment`. Se suman a las pruebas actuales de frames, capas, materiales, borrador, filtros y almacenamiento de Endo. Estas pruebas existentes no certifican aún una fusión ni la equivalencia Ghost/Endo: eso pertenece al prototipo.

## Decisiones propuestas para el primer prototipo

Motion por capa de dibujo; dos segundos de loop; artboard activo solamente; Antenna y Signal primero; PNG del póster y GIF pequeño en el worker; copia explícita de Tremor; ningún cambio al archivo original. Ghost, Noise y exportación grande se incorporan después de comprobar composición y memoria. Así se prueba la identidad de **pintura viva** de Endo sin convertirlo en dos editores superpuestos.
