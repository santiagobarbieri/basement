# Distortion V1

Versión cerrada por Santiago el 19 de octubre de 2026. Base conservada para un futuro replanteo; no se considera resuelta la dirección final del Studio.

Abrir `/distortion/` desde el servidor BASEMENT o el hub.

Una imagen, una grilla y un lenguaje visual compartido. Cuatro efectos: Contorno, ASCII, Pixel y Semitono. Original restaura la fotografía en una pieza. Los fragmentos conservan su recorte de origen, transformaciones y posibilidad de subdivisión.

## Configuración global

La composición tiene una sola configuración de brillo, contraste, umbral, tamaño de unidad, escala/densidad y familia ASCII. Cada efecto interpreta la misma información tonal con su técnica; el cambio de tratamiento no crea ajustes de color separados.

**Colores** es siempre global, incluso con una selección activa:

- Paleta compartida: hasta ocho muestras editables, con activación y pesos. Los cuatro efectos eligen directamente entre estas muestras. Pixel utiliza también el color de fondo para conservar las diferencias tonales cuando hay una sola tinta.
- Desde la imagen: los cuatro efectos toman colores del mismo muestreo de la fuente.
- Color de fondo y fondo Papel/Transparente comunes. El fondo no se vuelve a colorear después de renderizar.
- Extraer de la imagen construye una paleta global a partir de colores frecuentes diferenciados.

No hay tinta por pieza, paletas locales, colores aleatorios por efecto ni una segunda pasada de Influencia que reemplace los colores elegidos. Los pesos afectan la afinidad de muestreo; no garantizan porcentajes exactos de píxeles. El suavizado de los bordes mezcla tinta y fondo naturalmente.

## Selección y excepciones locales

Sin selección aparecen imagen, grilla, distribución y ajustes globales. Click en una pieza muestra su tratamiento y ajustes locales; Shift + click agrega/quita piezas. Click fuera de la imagen, Escape o Deseleccionar vuelve a globales. Los valores distintos de una selección múltiple indican Mixto.

Una pieza hereda la configuración global. Se pueden crear excepciones de brillo, contraste, umbral, tamaño, densidad/escala ASCII y movimiento. Cambiar el efecto conserva estas excepciones y utiliza la misma paleta global. **Usar ajustes globales** elimina las excepciones de la selección. Los ajustes locales no modifican los valores globales; los cambios globales siguen afectando los valores heredados.

La distribución usa Intervención, Agrupación, pesos de los cuatro efectos y seed. El icono de mezcla genera otra distribución y conserva paleta, ajustes globales, excepciones, geometría y piezas protegidas/bloqueadas. Los controles trabajan en vivo. Cada arrastre continuo se deshace en un paso.

## Piezas y protección

Selección simple/múltiple, pincel de efecto, borrador, transformaciones, zoom/pan y selección por rectángulo. El escudo pinta protección; Alt la quita. Proteger restaura la foto original y excluye esa pieza de los efectos y ajustes tonales. Bloquear excluye una pieza de la edición y redistribución; sigue perteneciendo al estilo global compartido.

Subdividir selección crea hasta cuatro fragmentos que conservan exactamente su cobertura y transformaciones, incluso con skew. Hasta tres niveles y 1800 piezas. Cambiar filas/columnas reconstruye la grilla con aviso si existen ediciones. Toda operación es reversible con Undo.

## Jitter y exportación

Contorno, ASCII y Semitono oscilan alrededor de anclas en la fuente. La amplitud se limita por el tamaño de detalle, los bordes quedan fijos y se atenúa el movimiento en zonas de alto contraste. Contorno se desplaza sobre las normales del trazo. Pixel permanece estático.

Movimiento, intensidad y velocidad tienen una base global y excepciones por pieza. **Velocidad** modifica el ritmo real de la oscilación (0.5× a 3×); no es un control de FPS. El ciclo común es de cuatro segundos y admite las seis velocidades sin cortes. Las pestañas ocultas no siguen renderizando. La animación no agrega entradas al historial.

PNG del cuadro inicial hasta 8192 px de lado mayor y aproximadamente 16 MP. GIF transparente de cuatro segundos hasta 1024 px de lado mayor, con progreso; sin movimiento genera un cuadro. Guardado local compartido con el hub y .ment editable conservan estilo, paleta y excepciones. Preview, miniaturas, PNG y GIF usan el mismo resolver de configuración y renderer.

## Compatibilidad y límites

Los documentos anteriores se adaptan al estilo compartido al abrirse. Se toma su paleta global, o una paleta existente de la obra si no había una global. Tintas/fondos/paletas internos anteriores dejan de controlar los efectos. Los tratamientos retirados se convierten a Pixel o Semitono; se conservan imagen, grilla, transformaciones y geometría. El archivo .ment de origen no se modifica al abrirlo.

Una fuente de trabajo de hasta 4096 px de lado mayor; una imagen por documento. Protección por fragmentos, sin segmentación de objetos ni máscara libre. Contorno reconoce regiones tonales, no sujetos. Worker con caché de texturas de 64 MiB y fallback Canvas 2D; grillas densas pueden tardar más.

## Verificación

`node --test tests/distortion.test.mjs`

Pruebas de geometría, subdivisión, persistencia, herencia de estilo, excepciones locales, migración, amplitud/continuidad/periodicidad del jitter y cuatro tratamientos activos. Chrome con fuente sintética: controles globales/locales, contraste/brillo/umbral/velocidad por selección, reset a globales, conservación de paleta al randomizar y recarga. Comparación de píxeles a alta resolución confirma tinta y fondo elegidos en los cuatro efectos; PNG generado y GIF decodificado (24 cuadros a 6 FPS, cuatro segundos). Las fotos del usuario requieren revisión visual en su documento.
