# BASEMENT — DISTORTION

Referencia de diseño original. El comportamiento actual está documentado en `../studios/distortion.md`; las decisiones vigentes del producto están en `../requirements-beta-2.md`.
## Master Implementation Prompt — Hybrid Fragment System / Prototype V0.1

### 1. Project Context

You are developing **DISTORTION**, a new creative Studio within BASEMENT, an existing modular web application for visual experimentation.

Before implementing anything, inspect the current repository and read:

- `README.md`
- `STATUS.md`
- Existing Studio implementations, especially Endo, Kiln and Tremor.
- Main Hub architecture, project persistence, `.ment` serialization and export systems.

Use the latest verified implementation as the technical reference. Historical documentation may contain superseded decisions.

**Do not rebuild BASEMENT or modify completed Studios unnecessarily.**

DISTORTION must integrate into the existing application while maintaining its own specialized rendering and interaction engine.

### 2. Creative Direction

**Name:** DISTORTION

**Concept:** Reality, rearranged.

**Studio philosophy:** Fragment. Treat. Transform.

DISTORTION is an experimental image manipulation tool that allows users to destroy and reconstruct the visual structure of an image.

Instead of applying effects to an entire photograph, DISTORTION divides it into a configurable grid of equal-sized fragments. Every fragment can receive an independent graphical treatment and geometric transformation.

The result is a composition in which photography, typography, digital patterns, pixelation and visual distortion coexist.

The primary artistic reference is a mixed-media grid collage combining photographic fragments, ASCII patterns, pixelated regions and contrasting textures.

The original image must remain intact and reconstructable throughout the editing process.

### 3. Core Interaction Model — HYBRID

The Hybrid system combines two behaviors:

**FIXED GRID**

All fragments initially occupy their original positions, reconstructing the complete source image without visible gaps.

Treatments modify the contents of fragments without changing the overall geometry.

**FREE FRAGMENTS**

Individual fragments or selected groups can be displaced, rotated, scaled or otherwise transformed independently.

Fragments may overlap, reveal transparent areas or occupy positions outside their original grid cells.

The transition between these states must be seamless.

There is no need for separate editing modes called Fixed and Free. Fragments simply remain aligned until the user transforms them.

Every fragment retains its original grid position and geometry, even after being moved.

Provide a **Reset Transform** action that restores selected fragments to their original positions without removing their graphical treatments.

### 4. Fragment Data Model

Each fragment must preserve two independent geometries:

**Source Geometry**

Defines which pixels are sampled from the original image.

Includes:
- Source image reference.
- Original grid row and column.
- Source coordinates.
- Source dimensions.
- Original clipping geometry.

**Display Geometry**

Defines how the fragment appears in the final composition.

Includes:
- Position X/Y.
- Rotation.
- Scale X/Y.
- Opacity.
- Display clipping geometry.
- Rendering order.

Moving a fragment must never change which original pixels it represents.

Each fragment must also store:

- Stable unique ID.
- Treatment type.
- Treatment parameters.
- Static jitter parameters.
- Random seed where applicable.
- Selection-independent editable state.

Use normalized source-image coordinates where appropriate to preserve resolution independence.

The fragment model must support future animation and multiple source images without requiring a complete rewrite.

### 5. Grid Engine

Develop a configurable grid that subdivides the imported image into geometrically consistent fragments.

**V0.1 parameters:**

- Columns.
- Rows.
- Skew X.
- Skew Y.
- Grid Origin X/Y.
- Grid Visibility.

Default geometry must be rectangular.

Skew transforms the grid into uniform parallelograms using a consistent affine transformation.

Do not approximate parallelograms by moving rectangular image crops without transforming their geometry.

Source sampling, clipping and display transformations must remain mathematically consistent.

Adjacent fragments in their default state must reconstruct the original source without unintended gaps or overlaps.

**Grid behavior:**

When the grid changes, rebuild its fragments deterministically.

Preserve treatments and transformations where an unambiguous cell correspondence exists.

For structural changes that make exact correspondence impossible, use a documented deterministic remapping strategy or require explicit confirmation before resetting fragment-specific edits.

Never silently discard substantial user work.

A grid must not be destructively baked into the source image.

### 6. Fragment Selection

Create a precise interaction system supporting:

- Click to select one fragment.
- Shift + Click for multiselection.
- Drag selection rectangle.
- Select All.
- Deselect.
- Delete selected fragments.
- Restore deleted fragments using Undo.
- Reset Transform.
- Reset Treatment.
- Reset Fragment.

Use visible selection outlines and transformation handles.

Selection must work correctly with zoom, pan, rotation, skew and overlapping fragments.

For overlapping fragments, select the topmost visible fragment under the pointer.

Selection must not modify the underlying artwork.

**Group editing**

When several fragments are selected, editing a shared parameter should affect all selected fragments.

Relative transformations should preserve the spatial relationship between fragments.

Parameter changes made through a continuous slider gesture should constitute one undoable action.

### 7. Transform Tools

Provide a Transform interaction mode.

Users must be able to:

- Drag selected fragments.
- Rotate fragments.
- Scale fragments.
- Modify position numerically.
- Restore original transformations.

Use a visual bounding box and intuitive manipulation handles.

Support keyboard modifiers where useful:

- Shift for constrained transformations.
- Arrow keys for precise position adjustment.
- Escape to cancel the current transformation.

Implement transformations without resampling and replacing the source image.

The output must be reconstructed from source geometry, treatments and transforms.

### 8. Treatment Library

Implement a modular graphical treatment engine.

For the first interactive prototype, include four treatments:

**Original**
- Unmodified source pixels.
- Acts as the default treatment.

**ASCII**
- Converts the fragment into typographic characters.
- Adjustable character density.
- Adjustable character scale.
- Contrast adjustment.
- Foreground/background colors.
- At least one predefined character set.

**Pixel**
- Pixelates the source region.
- Adjustable pixel size.
- Optional color reduction.

**Dither**
- Converts tonal information into controlled pixel patterns.
- Adjustable pattern density or scale.
- Threshold/contrast controls.
- At least one deterministic dithering algorithm.

Treatments must operate on the individual fragment's source region.

Treatment parameters must be editable independently for every fragment.

Use a modular interface so additional effects can later be registered without changing the document model.

Do not implement the complete future filter catalog yet.

### 9. Treatment Browser

Create a visual Treatment Browser in the right panel.

Treatments should appear as selectable preview tiles.

**Important:** previews should be generated using actual imagery from the current project, rather than generic decorative thumbnails.

The user should be able to understand the visual consequence of selecting a treatment before applying it.

When the user selects a fragment, the browser should indicate its active treatment.

When multiple fragments with different treatments are selected, display a mixed state.

Selecting a treatment applies it to the current selection.

If nothing is selected, the chosen treatment becomes the active treatment for the Brush tool.

Treatment-specific parameters appear below the Treatment Browser.

Hide irrelevant controls.

### 10. Brush Tool

Implement a brush interaction that applies the active treatment to the fragments crossed by the pointer.

The brush does not paint raw pixels. It assigns treatment settings to grid fragments.

Required behavior:

- Click to treat one fragment.
- Drag across several fragments.
- Apply the currently selected treatment.
- Avoid repeatedly processing the same fragment during one stroke.
- Commit the entire stroke as one Undo action.

Provide an Eraser tool that restores the Original treatment while preserving fragment transformations.

Brush operations must be deterministic and must not change the original image.

### 11. Shuffle & Random Distribution

Implement a non-destructive distribution engine.

The user selects a set of treatments and assigns relative weights.

Example:

- Original: 40%.
- ASCII: 25%.
- Pixel: 20%.
- Dither: 15%.

The engine distributes these treatments over the grid according to the configured proportions.

Required controls:

- Enable/disable individual treatments in the distribution.
- Percentage or weight per treatment.
- Numeric Seed.
- Randomize Seed.
- Apply Distribution.
- Shuffle.

A fixed seed and identical input must generate identical results.

**Distribution rules:**

- Operate on all fragments or selected fragments.
- Preserve fragment geometry and transformations.
- Modify only the properties explicitly targeted by the operation.
- Commit the entire distribution as one Undo action.
- Avoid introducing non-reproducible randomness.

For V0.1, use random weighted distribution only. Do not implement image-aware Smart Distribution yet.

### 12. Static Jitter

Introduce controlled geometric randomness without animation.

Jitter should support:

- Position variation.
- Rotation variation.
- Scale variation.

Allow the user to apply jitter to all fragments or a selection.

Jitter must be based on a seed.

Changing the seed should generate a different but reproducible arrangement.

Jitter must be applied relative to each fragment's stored base transformation, not accumulated repeatedly on already-jittered positions.

Set all jitter values to zero to recover the base composition exactly.

Animation and temporal jitter are excluded from this prototype.

### 13. Artboard and Navigation

Follow BASEMENT's established Studio navigation patterns wherever practical.

Provide:

- Zoom.
- Pan.
- Fit to View.
- Correct cursor-coordinate conversion.
- Consistent selection precision at different scales.

The complete image must remain visible when initially imported.

Moving fragments outside the original image bounds must be possible.

Do not automatically delete or clip free fragments solely because they move outside the source-image rectangle.

Establish a document/export boundary model compatible with the existing BASEMENT architecture.

### 14. Interface Design

Follow BASEMENT's existing dark visual system and Controlled Chaos direction.

**Accent color proposal:** `#D9F36A`.

Use the existing components, typographic conventions, iconography and spacing rules wherever possible.

Suggested arrangement:

**Top Toolbar**
- Select
- Brush
- Eraser
- Transform
- Undo
- Redo
- Zoom controls

**Left Panel**
- Source Image
- Grid Configuration
- Distribution
- Seed
- Static Jitter

**Central Workspace**
- Interactive image canvas
- Optional grid overlay
- Selection handles
- Fragment manipulation

**Right Panel**
- Treatment Browser
- Treatment Properties
- Fragment Properties
- Selection Information
- Preview where useful

Do not force all controls into the interface simultaneously.

Use collapsible sections where necessary.

Prioritize visual clarity and immediate interaction feedback.

The interface must remain functional at common desktop viewport sizes without introducing unnecessary page scrolling.

### 15. Rendering Architecture

Keep these systems independent:

1. Source image management.
2. Grid geometry.
3. Fragment document model.
4. Treatment processing.
5. Fragment transforms.
6. Composition renderer.
7. Interaction overlays.
8. History.
9. Persistence.
10. Export.

Use Canvas 2D and/or WebGL2 according to actual rendering needs.

Prefer GPU acceleration when it materially improves performance, but do not introduce unnecessary complexity.

Use Web Workers for expensive processing when supported.

Avoid duplicating full-resolution source images for every fragment.

Cache processed fragment data where useful.

Invalidate cached results only when their dependencies change.

Maintain a responsive preview during interaction and reconstruct a higher-quality result when interaction ends if required.

The composition must be reproducible from its saved document data.

### 16. History

Integrate with the established BASEMENT history conventions.

Undo/Redo must support:

- Grid changes.
- Treatment changes.
- Brush strokes.
- Multiple selection edits.
- Fragment transformations.
- Jitter changes.
- Seed changes.
- Distribution operations.
- Fragment deletion.
- Reset actions.

Continuous gestures must produce atomic history entries.

New edits after Undo should invalidate the appropriate Redo branch.

Avoid excessive memory use when storing histories of dense fragment grids.

### 17. Project Persistence

DISTORTION must integrate with the existing Main Hub and project library.

Support:

- Automatic local project persistence through the existing IndexedDB infrastructure.
- Reopening editable projects.
- Manual `.ment` export.
- `.ment` import through the established Hub workflow.
- Correct Studio identification.
- Preserved source image data.
- Preserved fragment parameters.
- Preserved grid configuration.
- Preserved selection-independent artwork state.

Use the existing `.ment` format and versioning strategy.

Do not create a competing document format.

Maintain compatibility with existing BASEMENT project files.

Validate imported data before reconstructing fragments.

### 18. PNG Export

Implement high-resolution PNG export.

Requirements:

- Independent of viewport zoom.
- Independent of pan position.
- Reconstruct all visible document fragments.
- Preserve transparency where applicable.
- Preserve treatments and transformations.
- Exclude grid guides and selection overlays.
- Respect established maximum export dimensions and memory limits.
- Report export errors clearly.

Export must use the saved document model rather than capturing the visible UI canvas.

GIF, WebM and other animated formats are excluded from V0.1.

### 19. Performance Requirements

The prototype must remain usable with moderately dense grids and high-resolution photographs.

Implement safeguards against:

- Excessive GPU memory allocation.
- Blocking main-thread rendering.
- Unbounded processing loops.
- Unnecessary recomputation of unchanged fragments.
- History memory exhaustion.
- Browser crashes during export.

Test at several grid densities and report observed performance.

Do not claim guaranteed FPS without measurements.

### 20. Testing and Acceptance Criteria

Create automated tests for:

- Uniform grid subdivision.
- Affine skew geometry.
- Source/display geometry independence.
- Fragment identity.
- Selection and multiselection.
- Overlapping fragment picking.
- Transform/reset equivalence.
- Deterministic weighted distribution.
- Deterministic jitter.
- Brush operation atomicity.
- Undo/Redo.
- Treatment isolation between fragments.
- `.ment` serialization and deserialization.
- Local project reopening.
- Export dimensions and transparency.

Perform actual browser QA.

**The prototype is accepted when:**

1. A user can import a photograph.
2. The photograph can be divided into a configurable grid.
3. The grid initially reconstructs the original image without unintended seams.
4. The user can independently assign Original, ASCII, Pixel and Dither treatments.
5. Several different treatments can coexist on the same image.
6. The Brush can quickly apply treatments across multiple cells.
7. Shuffle generates reproducible mixed-treatment compositions.
8. Individual fragments can move, rotate and scale independently.
9. Reset Transform accurately restores their original geometry.
10. Selection and editing remain reliable under zoom and pan.
11. Undo/Redo restores previous states correctly.
12. Saving and reopening the project preserves editable content.
13. PNG export reproduces the complete intended composition.
14. The new Studio appears in the Main Hub.
15. Existing Studios continue functioning without regressions.

### 21. Out of Scope

Do not implement in this prototype:

- Motion effects.
- Animated jitter.
- GIF or video export.
- Timeline.
- Masks.
- Multiple source images.
- Perspective mesh deformation.
- Variable-sized cells.
- Smart Distribution.
- AI-generated treatments.
- Recipe Library.
- Advanced compositing layers.
- Cross-Studio artboard transformation.

These belong to future development phases.

Design the internal architecture to accommodate them when reasonable, without prematurely implementing their functionality.

### 22. Development Workflow

Work incrementally.

**Phase 1 — Architecture**

Inspect the repository, identify reusable infrastructure and propose the implementation structure.

**Phase 2 — Fragment Engine**

Implement source image handling, grid geometry, fragment data and rendering.

**Phase 3 — Interactions**

Implement selection, multiselection, transforms and reset behavior.

**Phase 4 — Treatments**

Implement the four initial graphical treatments and Treatment Browser.

**Phase 5 — Creative Tools**

Implement Brush, Eraser, Shuffle and static Jitter.

**Phase 6 — Integration**

Connect history, IndexedDB, `.ment`, PNG export and Main Hub navigation.

**Phase 7 — QA**

Run automated tests and browser-based visual and functional verification.

Do not proceed blindly through architectural uncertainty. Identify important decisions before introducing irreversible structural changes.

### 23. Deliverables

Provide:

- Functional DISTORTION V0.1 prototype.
- Modular fragment rendering engine.
- Main Hub integration.
- Editable project persistence.
- `.ment` support.
- PNG export.
- Automated tests.
- Browser QA results.
- Technical README for DISTORTION.
- Updated `STATUS.md` with verified features, limitations and future work.

Do not declare the Studio complete merely because it renders successfully.

**Final objective:** Create a fast, intuitive, non-destructive creative instrument where users can fragment, reinterpret and reconstruct images using different visual languages within a single composition.

The underlying system must be precise. The creative possibilities should feel open-ended.

---

OTROS STUDIOS - IDEAS
01. DISTORTION
#D7F15A
Fragmentación y reconstrucción de imágenes.
Divide una imagen en una grilla ajustable de rectángulos o paralelogramos. Cada fragmento puede recibir un tratamiento visual diferente, como ASCII, pixelación, dithering, glitch o distorsiones de color. Los fragmentos pueden moverse, rotarse, superponerse y animarse independientemente. Permite aplicar efectos con pinceles y generar composiciones aleatorias mediante seeds.
02. CHRONO
#8195F2
Manipulación temporal de fotografías y videos.
Combina distintos momentos de un video en una sola composición. Mediante técnicas como slit-scan, ecos temporales y desplazamientos, permite estirar movimientos, congelar regiones y producir imágenes imposibles. Cada parte de la composición puede representar un instante diferente.
03. PRESS
#F1785C
Laboratorio de impresión experimental.
Transforma fotografías, tipografías y composiciones mediante técnicas de risografía, serigrafía e impresión analógica. Permite trabajar con separaciones de tinta, tramas, sobreimpresiones, desregistro, texturas de papel y desgaste. Cada tinta puede configurarse individualmente para generar combinaciones y errores de impresión controlados.
04. THREAD
#E0BD82
Reconstrucción de imágenes mediante hilos.
Convierte fotografías, formas o dibujos en composiciones construidas a partir de hilos virtuales. El usuario puede establecer puntos de anclaje, densidad, dirección, tensión, grosor y color. Un algoritmo genera recorridos que interpretan las sombras y formas de la imagen original. También permite crear composiciones abstractas sin fotografía.
05. RESONANCE
#B49AFF
Visualización y creación gráfica reactiva al sonido.
Importa archivos de audio o utiliza el micrófono para generar composiciones visuales sincronizadas con música y sonidos. Las frecuencias, amplitudes y ritmos pueden controlar partículas, ondas, tipografía, geometrías, materiales y movimientos. El usuario diseña cómo reacciona cada elemento y puede exportar animaciones sincronizadas.
06. SCAN
#A9D78A
Escaneo experimental e interactivo.
Simula un escáner que captura una imagen progresivamente mediante una línea móvil. Durante el escaneo, el usuario puede mover, rotar, escalar y presionar la imagen, generando deformaciones y estiramientos. Incorpora materiales por encima o debajo de la imagen, como foil, acetato, papel semitransparente o plástico. La presión, velocidad y material modifican la intensidad, textura y calidad de la captura. Permite realizar múltiples pasadas y exportar el resultado como PNG.
07. STAMP
#F2A06B
Composición gráfica mediante sellos digitales.
Convierte imágenes, símbolos, letras y formas en sellos personalizables. El usuario puede estampar manualmente sobre un lienzo, modificando presión, rotación, escala, tinta, textura y desgaste. Las impresiones pueden superponerse y acumular pigmento, simulando sellos físicos. También permite distribuir sellos automáticamente para generar patrones y composiciones.
08. TOPO
#64C8AE
Transformación de imágenes en superficies topográficas.
Interpreta la luminosidad y el contraste de una fotografía como información de altura. A partir de ella genera curvas de nivel, mapas de elevación, líneas topográficas y superficies tridimensionales. Permite controlar separación entre curvas, altura, suavizado, perspectiva y colores para crear composiciones cartográficas o escultóricas.
09. PRISM
#88D9F0
Manipulación de imágenes mediante óptica y refracción.
Permite colocar lentes, prismas y materiales translúcidos sobre imágenes o composiciones. Cada objeto puede refractar, ampliar, comprimir, reflejar o separar cromáticamente las regiones que atraviesa. El usuario controla la geometría, transparencia, índice de refracción, iluminación y movimiento de los objetos ópticos.
10. POLKA
#EF81B7
Reconstrucción de imágenes mediante puntillismo generativo.
Convierte fotografías y composiciones en miles de puntos distribuidos según su información tonal. Permite controlar cantidad, tamaño, densidad, forma, color y distancia entre puntos. El usuario puede modificar los patrones de distribución para generar ilustraciones, retratos y composiciones abstractas similares al grabado o al puntillismo.
11. DRAPE
#BE9BEE
Simulación de telas y superficies flexibles.
Permite colocar imágenes, patrones, texturas o tipografías sobre una tela virtual. El usuario puede agarrarla, estirarla, doblarla, sujetarla y dejarla caer bajo gravedad. Se pueden modificar materiales, elasticidad, rigidez, peso y viento, generando pliegues y deformaciones. Permite crear composiciones estáticas o animaciones textiles.
12. POLOS
#A1D9DD
Manipulación de materia mediante campos magnéticos.
Simula partículas, limaduras metálicas y ferrofluidos que reaccionan a campos magnéticos. El usuario coloca imanes virtuales, modifica sus polos e intensidades y observa cómo la materia se organiza en estructuras y patrones. También puede utilizar fotografías y formas como mapas de fuerzas para generar composiciones abstractas.
13. ELASTIC
#F3B47B
Deformación de tipografía y formas mediante física elástica.
Convierte letras, palabras, imágenes recortadas y figuras en objetos flexibles. El usuario puede agarrar puntos, estirar, comprimir, retorcer y hacer colisionar los elementos. Se ajustan elasticidad, resistencia, gravedad, tensión y recuperación de forma. Ideal para tipografía experimental y animaciones de movimiento orgánico.
14. BLEED
#E8738D
Difusión de tinta sobre superficies absorbentes.
Simula cómo una tinta se expande, penetra y se mezcla con las fibras de un papel. El usuario puede pintar, depositar pigmento, modificar la humedad y controlar la absorción. Las manchas crecen, se fusionan y generan bordes irregulares según las características del material. También permite disolver fotografías y tipografías mediante difusión.
15. EROSION
#C7A18B
Deterioro físico y envejecimiento de imágenes.
Destruye progresivamente fotografías, ilustraciones y tipografías mediante procesos simulados de abrasión, oxidación, humedad, grietas, quemaduras y desprendimiento de material. El usuario controla la intensidad, dirección y extensión del deterioro, y puede aplicarlo selectivamente con pinceles o máscaras.
16. GRANULAR
#D2C080
Pintura y construcción mediante partículas físicas.
Un Studio cercano a Endo, pero especializado en materiales granulares como arena, polvo, pigmentos secos y pequeñas partículas. Permite depositar materia sobre el lienzo, acumularla en montículos, desplazarla mediante gravedad, generar avalanchas y modificar su comportamiento según peso, tamaño y fricción. Los materiales interactúan entre sí y permiten crear texturas y composiciones volumétricas.
17. ROOT
#87C68E
Generación de estructuras orgánicas mediante crecimiento procedural.
Permite crear raíces, ramas, nervaduras y redes que crecen desde puntos definidos por el usuario. Se pueden controlar bifurcaciones, dirección, velocidad, grosor, curvatura y reacción a obstáculos. Las estructuras pueden seguir siluetas, bordes o mapas tonales de una imagen y convertirse en ilustraciones estáticas o animadas.
18. EMBOSS
#D0D2D7
Creación de relieves mediante estampado y presión.
Transforma imágenes, tipografías y formas vectoriales en relieves físicos simulados sobre papel y otros soportes. Permite crear impresiones en alto o bajo relieve, configurar la profundidad, presión, textura del material y dirección de iluminación. El resultado imita técnicas de gofrado y estampado en seco.
19. CHROMA
#73D5C2
Creación de gradientes y composiciones cromáticas mediante fluidos.
Un laboratorio de pintura líquida que permite depositar y mezclar pigmentos sobre agua, papel mojado o superficies húmedas. Los colores se expanden, se repelen, se fusionan y generan gradientes orgánicos, halos y texturas.
El usuario controla viscosidad, humedad, difusión, tensión superficial, absorción y movimiento del líquido. También puede arrastrar los colores, crear corrientes y congelar el resultado para exportar fondos, texturas y composiciones abstractas.