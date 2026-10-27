# Marble · Color in Motion

Versión inicial para la beta de BASEMENT. Disponible en `/marble/` y en el hub. No se declara cerrada.

## Crear

- **Gota (D):** una pulsación crea una sola gota del color elegido. Mantener presionado la hace crecer por tiempo, sin mover el cursor. Al soltar queda depositada; mover el puntero mientras se mantiene la pulsación no genera otras gotas ni desplaza su centro. Crecimiento controla la velocidad en px/s.
- **Arrastre (S):** estira las fronteras de tinta según la dirección del gesto; fuerza y alcance editables.
- **Peine (C):** varias púas con separación y cantidad configurables.
- **Salpicar gotas:** agrega grupos reproducibles con la seed actual.
- **Crear mezcla / icono de mezcla:** distribuye 14 gotas individuales sin pasadas automáticas de peine; el icono elige otra seed. Una sola acción de Undo.

Cada gota guarda su propio color al depositarse. Editar una muestra o cambiar de paleta afecta solamente las próximas gotas; las anteriores conservan su tinta. Cuatro paletas iniciales, papel editable, formatos horizontal/cuadrado/vertical/pantalla, pan, zoom y fit. Cambiar formato escala la geometría existente y se puede deshacer. Hasta 180 gotas/polígonos, 32000 puntos y 16 estados de historial. Los límites revierten la operación completa si no puede terminarse.

## Movimiento

El flujo anima la mezcla terminada mediante dos deformaciones de corte periódicas, sin acumular error ni cambiar sus datos editables. Amplitud, longitud de onda y duración del ciclo (4–16 s). Es una aproximación matemática de marmolado, no una simulación completa de fluidos.

Los nuevos baños empiezan sin animación automática, para trabajar con gotas simples. La vista previa se reproduce con el botón superior. Pausarla conserva el cuadro actual y permite exportar el ciclo animado. La casilla Animación activa/desactiva la deformación del documento. Los gestos congelan momentáneamente el tiempo y convierten el cursor mediante la transformación inversa, de modo que la tinta cae donde se ve el puntero. Se pausa el render cuando la pestaña está oculta.

## Descargar e incluir en una web

**Export → Descargar HTML animado** genera un archivo autónomo, con geometría, paleta y motor incluidos. No importa scripts, imágenes, fuentes ni librerías externas. Se puede abrir directamente con doble click. Conserva el tamaño adaptable y la geometría vectorial renderizada en canvas.

Subí ese archivo junto a tu página. En **Código para mi web** elegí HTML animado y copiá el iframe, por ejemplo:

```html
<iframe src="mi-marble.html" title="Marble animation"
  style="width:100%;height:480px;border:0;display:block" loading="lazy"></iframe>
```

El ajuste Cubrir/Mostrar completo controla el encuadre dentro del iframe. La animación exportada respeta `prefers-reduced-motion`, usa hasta 2× de densidad y deja de dibujar cuando está fuera de pantalla o la pestaña está oculta. El alojamiento de la web debe permitir scripts inline dentro del documento exportado; una política CSP restrictiva requiere adaptar esa integración.

**Descargar video WebM** graba un ciclo a 30 FPS, hasta 1280 px de lado mayor sin ampliar el baño original. El proceso ocurre en tiempo real con un canvas independiente: editar durante la grabación no cambia su snapshot. Disponible en navegadores con MediaRecorder/WebM. Elegí Video WebM en el selector del código para obtener:

```html
<video src="mi-marble.webm" autoplay muted loop playsinline
  style="width:100%;height:480px;object-fit:cover;display:block"></video>
```

Para grabar WebM, mantené la pestaña visible; el navegador puede limitar los temporizadores en segundo plano. El HTML conserva el loop matemático exacto. WebM es una captura a FPS fijos y depende del rendimiento/temporización del navegador, por lo que no se garantiza un cierre de video idéntico a nivel de cuadro.

También se exportan PNG de hasta 4096 px (16 MP), SVG del cuadro actual y .ment editable. El guardado local se comparte con el hub; la importación .ment y los proyectos guardados conservan geometría, paleta, herramientas y movimiento.

## Motor y referencias

El desplazamiento radial de las gotas usa `C + (P − C) sqrt(1 + r² / |P − C|²)`, verificado en [Dropping Paint, Aubrey Jaffer](https://people.csail.mit.edu/jaffer/Marbling/Dropping-Paint). Las pasadas de peine/arrastre usan desplazamientos paralelos que decaen exponencialmente con la distancia perpendicular, basados en [The Mathematics of Marbling](https://people.csail.mit.edu/jaffer/Marbling/Mathematics). El renderer poligonal subdivide bordes según su error de deformación y mantiene un presupuesto de vértices.

El crecimiento se recalcula desde la geometría previa a la pulsación, por lo que no depende de la cantidad de frames ni acumula deformación extra. El radio está limitado a la mitad del lado menor del baño. Soltar confirma una sola acción de Undo; Escape, pérdida de foco o cancelación del puntero revierten toda la gota. Los documentos anteriores conservan su geometría; las gotas antiguas reciben su color actual al abrirse.

La animación exportada es un flujo periódico de la mezcla final; no es un video del proceso de creación ni una reproducción de los gestos. Editor, HTML, PNG, SVG y WebM comparten la misma función de deformación/dibujo.

## Verificación

`node --test tests/marble.test.mjs tests/distortion.test.mjs`

Pruebas de gotas, relación de áreas, inversas de arrastre/peine, límites, undo/redo, seeds, periodicidad/inversa del flujo, .ment/hub, SVG y HTML seguro sin imports. Chrome: depósito y arrastre reales, undo/redo, mezcla de 14 polígonos, recarga; PNG 2048×1536; SVG abierto como imagen; HTML ejecutado como iframe independiente y archivo `file://`; WebM grabado y decodificado 320×240. Descargas reales HTML/SVG/.ment y entrada/filtro de Marble en el hub verificados. No se afirma rendimiento universal para composiciones al límite.

Actualización de interacción verificada en Chrome: pulsación de aproximadamente un segundo aumenta el área visible sin mover el cursor; mover el puntero durante la pulsación conserva una sola gota en el centro inicial. Pulsación corta de otro color desplaza la gota anterior, sin cambiar su tinta. Undo/redo, Escape, recoloración futura, .ment/HTML/SVG y recarga comprobados.
