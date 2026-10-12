# AGENTS.md — BASEMENT

Este es el único archivo de instrucciones del proyecto. Leelo completo antes de hacer cualquier cosa. Después leé `STATUS.md` (dónde quedamos).

> **FOCO ACTUAL: solo los Studios ENDO y PRISM.** No audites, no hagas fork y no construyas ningún otro Studio hasta que Santi lo pida. Los demás se suman después, **uno por vez**, siguiendo la plantilla de la sección 7.1.

---

## 1. Qué estamos construyendo

**BASEMENT** es una app de diseño **personal** para la Mac de Santi (no se vende). Replica lo que hace la suite de Adobe, con la lógica de Affinity: **studios separados**, uno por tipo de trabajo, todo dentro de la misma app.

### Vocabulario (usalo en la UI, el código y los mensajes)

| Término | Significa | Ejemplo |
|---|---|---|
| **BASEMENT** | La suite / app contenedora | "Abrí BASEMENT" |
| **Studio** | Cada una de las 7 herramientas | "el Studio Prism" |
| **Artboard** | Cada proyecto/documento creado dentro de un Studio | "Nuevo artboard en Endo" |

### Flujo

1. Santi abre BASEMENT.
2. En la home elige un Studio (pastilla con "+") → se crea un artboard nuevo y se abre ese Studio.
3. O retoma un artboard existente desde la lista **All**.

### Los 7 Studios (estado)

| Studio | Equivale a | Base técnica | Subtítulo en la home | Estado |
|---|---|---|---|---|
| **ENDO** | Brushes / pintura | `studios/endo` (repo `endo_testing`, github.com/santiagobarbieri/endo_testing) | Brushes | **EN CURSO** |
| **PRISM** | Photoshop | `vendor/photocraft` | Image Editing | **EN CURSO** |
| QUILL | Illustrator | `vendor/vectorcraft` | Vectors & Illustrations | pendiente |
| REEL | Premiere Pro | `vendor/filmcraft` | Video Editing | pendiente |
| FOLIO | InDesign | `vendor/designcraft` | Page Layout | pendiente |
| LUX | Lightroom | `vendor/lightcraft` | Photo Development | pendiente |
| MIRAGE | After Effects | `vendor/effectcraft` | Motion & Effects | pendiente |

> Los subtítulos son los del Figma de Santi, que manda. Si algo difiere de esta tabla, gana el Figma.

Los nombres de arriba son solo de interfaz. Los repos y carpetas internas (`photocraft`, `filmcraft`, etc.) mantienen su nombre original para poder traer actualizaciones de upstream.

Los repos de `vendor/` son de ArtCraft (github.com/storytold): reimplementaciones clean-room, 100 % Rust, licencia Apache-2.0/MIT, **en alpha temprana**. Según el README de PhotoCraft: UI con egui, compositor en wgpu, build WebAssembly y un registro de comandos manejable por CLI, canal de control JSON y servidor MCP. **No des nada de esto por sentado: verificalo (Fase 2).** El repo `storytold/artcraft` (estudio de IA) no es parte de la suite; ignoralo salvo que Santi lo pida.

---

## 2. Quién es Santi y cómo trabajar con él

- Santi es diseñador/developer (Buenos Aires), pero **en este proyecto no escribe código**. Vos escribís, corrés, testeás y commiteás todo.
- Santi **diseña los prototipos en Figma** de cada Studio. Eso es la fuente de verdad visual (ver 6 y 7).
- Lo único que hace Santi (marcado con 👤 en el plan): autorizar logins y permisos que vos no podés dar, pasarte assets y prototipos, probar la app y dar feedback visual, y aprobar decisiones en los checkpoints.
- Si necesitás algo de Santi, pedíselo **una sola vez, con pasos numerados y botones/links exactos**, sin jerga. Si hay que correr un comando, dáselo listo para copiar y pegar.
- Santi da feedback corto y directo y prefiere refinar de a poco. No le pidas especificaciones largas: proponé algo concreto, mostralo y ajustá.
- Hablale en español rioplatense, claro y sin relleno. Código, commits, nombres de archivos y comentarios técnicos: en inglés.

---

## 3. Reglas de trabajo

1. **Foco.** Solo ENDO y PRISM hasta nuevo aviso. Un Studio nuevo se empieza únicamente cuando Santi lo pide **y** sube su prototipo de Figma.
2. **Una fase a la vez.** Seguí el plan (sección 10). No empieces la fase siguiente sin que Santi apruebe el checkpoint.
3. **Verificá antes de afirmar.** No digas "funciona" sin haberlo corrido. Si algo es una suposición, decilo.
4. **Probá siempre.** Cada cambio se compila y se corre. Cuando haya UI, sacá capturas para mostrarle a Santi.
5. **Commits chicos y descriptivos**, en ramas. `main` siempre tiene que abrir.
6. **`vendor/` es sagrado.** El `main` de cada fork queda igual al upstream. Tus cambios van en la rama `endo-integration` de cada fork, lo más mínimos posible, para poder traer actualizaciones sin conflictos (`git fetch upstream`). Preferí integrar por afuera (CLI, MCP, WASM, wrappers en `shell/`) antes que editar el código de ArtCraft.
7. **Licencias.** Respetá Apache-2.0/MIT y mantené los `LICENSE`/`NOTICE` de cada repo. Los logos y la marca de ArtCraft no pueden aparecer en versiones modificadas.
8. **Sin secretos en el repo** (tokens, claves). Si hace falta uno, pedíselo a Santi y usá variables de entorno o el keychain.
9. **Nada destructivo sin preguntar:** borrar carpetas, reescribir historia de git, force-push, instalar cosas de sistema.
10. **Mantené `STATUS.md`** al terminar cada sesión: qué se hizo, qué funciona, qué falló, qué sigue y qué necesitás de Santi.
11. **Decisiones grandes** (arquitectura, cambiar de enfoque) van en `docs/decisions/NNNN-titulo.md`: contexto, opciones, recomendación, en lenguaje simple. Santi aprueba antes de ejecutar.

---

## 4. Estructura del repo

```
basement/
├── AGENTS.md          # este archivo (única fuente de instrucciones)
├── STATUS.md          # bitácora viva, la mantenés vos
├── shell/             # la app BASEMENT: home, artboards, chrome común de los Studios
├── studios/
│   └── endo/          # Studio ENDO (de endo_testing)
├── vendor/            # forks de ArtCraft como submodules (se agregan de a uno)
│   └── photocraft/    # PRISM  (los demás se suman cuando les toque)
├── assets/
│   ├── brand/         # logo BASEMENT y tipografías que pasa Santi
│   ├── icons/         # SVG de cada Studio (quill.svg, endo.svg, ...)
│   │   └── tools/     # iconos de herramientas: endo/, prism/, panels/ (ver 6.6)
│   └── design/        # exports de los prototipos de Figma, una carpeta por Studio
│       ├── home/
│       ├── endo/
│       └── prism/
├── docs/
│   ├── audit/         # un informe por app (Fase 2)
│   └── decisions/     # decisiones de arquitectura
└── scripts/           # setup, build y run
```

---

## 5. Arquitectura y artboards en disco

### Decisión de arquitectura (pendiente de validar en Fase 3)

Hipótesis de partida, **a confirmar con un spike, no a asumir**:

- **Shell:** app web (HTML/CSS/JS, el stack de Santi) empaquetada con **Tauri** para que corra como app de Mac con acceso normal al disco.
- **ENDO:** corre directo en el shell porque ya es web.
- **PRISM:** build **WebAssembly** de PhotoCraft cargado dentro del shell.
- Alternativas descartadas por ahora: monorepo Rust único (demasiado mantenimiento) y launcher puro (no es "una sola app").
- Dudas que el spike tiene que resolver: WebGPU dentro del WebView de macOS en la versión de Santi, rendimiento de WASM vs nativo, apertura y guardado de archivos desde el WebView, y tamaño de la app.

**Quién dibuja la interfaz de PRISM.** PhotoCraft trae su propia UI (egui). Hay dos caminos y el spike tiene que informar el costo de cada uno:

1. **Embeber la UI de PhotoCraft tal cual** y que BASEMENT ponga solo la barra superior y el "volver". Rápido, pero se ve distinto al diseño de Santi.
2. **BASEMENT dibuja los paneles** (HTML) y le manda órdenes al motor por su registro de comandos y canal de control. Uniforme y fiel al Figma, pero más trabajo.

Plan por defecto: arrancar con el camino 1 para tener PRISM funcionando y **reemplazar paneles de a uno** por los del Figma (primero Layers), con aprobación de Santi en cada paso.

Compará con evidencia (tiempos, capturas, tamaños) y recomendá. Santi decide.

### Artboards como carpetas reales en el Mac

- Carpeta raíz por defecto: **`~/Basement/`**, configurable en las preferencias de la app (Santi puede ponerla en iCloud Drive o Dropbox para tener sync y respaldo; Time Machine la incluye).
- Cada artboard es una carpeta visible en Finder, **plana** (sin subcarpetas por Studio por ahora):

```
~/Basement/
├── Brush testing.artboard/
│   ├── project.json       # studio, nombre, fechas, versión
│   ├── thumbnail.png      # miniatura
│   ├── main.<ext>         # archivo de trabajo en formato real (PSD, PNG, ...)
│   └── assets/            # imágenes y recursos que usa
└── ...
```

- Doble clic en un `.artboard` abre BASEMENT en el Studio correcto (registrar la extensión con Tauri).
- **La home lee la carpeta**: la lista All sale de ahí, sin base de datos aparte, así que siempre coincide con el disco.
- Los archivos de trabajo usan **formatos nativos estándar** para mover material entre Studios sin pérdida.
- Si la carpeta raíz está en Documentos/Escritorio/Descargas, macOS pide permiso la primera vez: avisale a Santi qué va a ver y que acepte.

---

## 6. Marca y diseño de la UI

**El Figma de Santi (archivo "ENDO", página "Main Page") es la fuente de verdad visual.** Esta sección describe lo diseñado hasta hoy; si el Figma cambia, gana el Figma. Los hex de abajo son de referencia, estimados desde capturas: tomá los valores reales del Figma, no los inventes.

### 6.1 Identidad

- **Logo/wordmark BASEMENT:** mayúsculas condensadas y muy pesadas, gris claro sobre fondo oscuro. Vive en `assets/brand/`; si falta el archivo, pedíselo a Santi.
- **Tipografías (según el Figma):** display condensada pesada para BASEMENT; serif cursiva de display para los títulos ("Start Creating", "All"); sans simple para etiquetas y filas. Pedile a Santi los nombres y archivos exactos.
- **Paleta base (aprox.):** columna izquierda oscura `#161616`; panel derecho gris claro `#C4C4C4`; texto sobre pastillas siempre en tinta oscura.
- **Estilo:** esquinas **cuadradas** (sin border-radius), líneas finas de 1 px, sin sombras ni degradés.

### 6.2 Home (diseño final, ya cerrado)

Dos columnas. **No hay buscador y no hay sección "Recent"**: no los agregues.

**Columna izquierda (oscura)**
1. Logo **BASEMENT**.
2. Tagline, texto exacto (es la copia de Santi, no la corrijas): *"Click A Studio & Create A New Artboard To Start Creating New Things!!"*
3. Estadísticas: **"7 Studios"** y **"N Artboards"** (N = cantidad real de artboards en `~/Basement/`).
4. Dos líneas chicas: *"Founded 2026"* y *"Buenos Aires, Argentina"*.
5. Título **"Start Creating Something New"** (serif cursiva, dos líneas).
6. Las **7 pastillas** (ver 6.3), de ancho completo, con **"+"** a la derecha.
7. No hay configuración visible en la home. Los ajustes (carpeta raíz, modo claro/oscuro) van en las preferencias de la app (`⌘,`).

**Columna derecha (clara)**
1. Título **"All"** y, a su lado, los **filtros**: 7 puntos de color (uno por Studio) y un primer punto vacío que significa "todos". Estado activo visible. Tooltip con el nombre del Studio.
2. A la derecha del mismo renglón: **fecha y hora actuales** en vivo, formato `12 Oct / 2026 | Mon. 18:06`.
3. **Lista de artboards**, más reciente primero. Cada fila: **barra vertical de color del Studio** a la izquierda | **icono del Studio** | **nombre del artboard** | fecha | flecha ↗ (abrir). Fechas: "Today", "Yesterday" y luego "10 Oct. 2026". Una línea fina separa las filas.
4. Hover y fila seleccionada: hay que diseñarlos; proponé algo mínimo y mostralo.
5. Con la lista vacía, mostrar una invitación a crear el primer artboard (a diseñar).
6. Si hay muchos artboards, la lista scrollea.

**Studios todavía no construidos:** las pastillas se muestran, pero deshabilitadas, con una marca discreta tipo "Soon". *(Propuesta por defecto; Santi confirma o cambia.)*

### 6.3 Pastillas, colores e iconos

Cada pastilla: **icono + nombre + subtítulo en cursiva serif + "+"**. Los iconos son **Tabler Icons, estilo outline** (MIT), trazo 2 px, grilla 24 × 24; los SVG están listos en `assets/icons/`.

| Studio | Color (ref., del Figma) | Icono Tabler | Archivo |
|---|---|---|---|
| QUILL | `#2F5AF5` azul | `vector-bezier-2` | `quill.svg` |
| ENDO | `#86AA2E` verde oliva | `brush` | `endo.svg` |
| REEL | `#EA5530` naranja rojizo | `movie` | `reel.svg` |
| FOLIO | `#DE3A87` rosa | `book` | `folio.svg` |
| LUX | `#F5B13E` ámbar | `sun` | `lux.svg` |
| MIRAGE | `#6A33F5` violeta | `sparkles` | `mirage.svg` |
| PRISM | `#6AF0FF` cian | `stack-2` | `prism.svg` |

Reglas:

- **"+" = crear.** La flecha ↗ es solo **abrir**. Cada símbolo significa una sola cosa.
- El color de cada Studio es también su **acento dentro del Studio**. Definilo como variable CSS (`--studio-accent`) y no lo hardcodees en otros lados.
- Interfaz en español por defecto, salvo los textos de marca de la home (en inglés, tal cual el Figma).
- Inspiración de UX: Affinity (studios separados, home limpia) y Photopea. Sobria y rápida, sin ruido.

### 6.4 Chrome común de todos los Studios

Todos los Studios comparten este esqueleto, para que BASEMENT se sienta una sola suite:

- **Barra superior fina (~44 px):** `← BASEMENT` (vuelve a la home) | nombre del artboard (editable) | **modos** del Studio como pestañas rectangulares | deshacer, rehacer | **Export**.
- **Línea de 3 px con el color del Studio** justo debajo de la barra superior.
- **Riel de herramientas** a la izquierda (~48 px), si el Studio lo necesita.
- **Columna de paneles** a la derecha.
- **Barra de estado** abajo (~24 px): zoom, unidades, dónde se guardó.
- **Lienzo gris claro** (`#C4C4C4` ref.) rodeado de paneles oscuros.
- El color del Studio aparece **solo** en: la línea superior, la herramienta activa, el modo activo y las selecciones. Todo lo demás es neutro.

### 6.5 Nuevo artboard (pendiente de diseño)

Al tocar una pastilla se abre un paso corto antes del lienzo: nombre, tamaño (presets y personalizado), resolución, fondo (transparente o color). **Santi todavía no lo diseñó:** proponé algo mínimo y mostralo antes de construirlo.

### 6.6 Iconos de herramientas (riel de ENDO y PRISM)

Los iconos del riel de herramientas siguen el estilo del riel actual de ENDO: **outline fino**, trazo 1.5 px, grilla 24 × 24, esquinas redondeadas, gris neutro (`#A8A8B0`) sobre riel oscuro (`#232329`). Son Tabler Icons (MIT). Están en `assets/icons/tools/`:

- `endo/` (13 iconos), `prism/` (18 iconos) y `panels/` (layers, adjustments, history, color, effects, filters, settings).
- `rails/rail-endo.svg` y `rails/rail-prism.svg` son **muestras de referencia** del riel armado. No son parte de la app.

Reglas del riel:
- Ancho ~64 px, una celda de ~56 px por herramienta, icono centrado.
- **Herramienta activa:** fondo un paso más claro (`#2E2E35` ref.), icono más claro (`#E6E6EA` ref.) y una barra vertical de 3 px a la izquierda con el **color del Studio** (verde para ENDO, cian para PRISM). Es el único lugar del riel donde aparece el color.
- Tooltip al pasar el mouse con el formato **"Nombre · Atajo"** (por ejemplo "Text · T"), como ya hace ENDO.
- Los atajos de la tabla son una propuesta de partida (convención tipo Photoshop). En ENDO, **respetá los atajos que ya existen** en `endo_testing`.
- Los nombres de ENDO marcados con (?) son **suposiciones por el aspecto del icono**, no confirmadas: verificá contra lo que hace cada herramienta hoy y pedile a Santi que confirme el nombre.

**ENDO** (orden del riel): Select (V), Brush (B), Eraser (E), Restore (?), Symmetry (?), Frames (?), Effects (?), Grid (?), Images (?), Drops (?), Text (T), Shape (U), Eyedropper (I).

**PRISM** (orden del riel): Move (V), Marquee (M), Lasso (L), Magic wand (W), Crop (C), Eyedropper (I), Spot heal (J), Brush (B), Clone stamp (S), Eraser (E), Fill (G), Blur (R), Dodge and burn (O), Pen (P), Text (T), Shape (U), Hand (H), Zoom (Z). Que cada herramienta exista de verdad depende de la auditoría (7.3); no muestres en el riel herramientas que PhotoCraft todavía no tiene.


---

## 7. Especificación por Studio

### 7.1 Plantilla (así se agrega cada Studio nuevo)

Antes de empezar un Studio, tiene que existir su sección con estos puntos. Si falta alguno, pedíselo a Santi:

1. **Prototipo de Figma:** link y exports PNG en `assets/design/<studio>/` (👤 Santi). Si Santi conecta el MCP de Figma, usalo; si no, trabajá con los PNG.
2. **Layout:** zonas de la pantalla y qué panel va en cada una.
3. **Modos** del Studio.
4. **Alcance v1:** qué tiene que hacer sí o sí, y qué queda afuera.
5. **Base técnica e integración:** qué motor usa y cómo se conecta al shell.
6. **Formatos** de entrada y salida.
7. **Criterios de aceptación:** cómo sabemos que está terminado.

### 7.2 ENDO — EN CURSO

**Qué es:** el editor de brushes y pintura que Santi ya construyó (`endo_testing`), inspirado en Photopea/Photoshop/Affinity, con su propia librería de efectos. Es web, así que corre directo dentro del shell.

**Layout de partida** (hasta que Santi suba el Figma; después gana el Figma):
- Riel de herramientas a la izquierda.
- Barra rápida bajo la barra superior: tamaño, opacidad y flujo del pincel.
- Lienzo (~58 % del ancho).
- Columna derecha (~37 %): **vista previa del brush en 3D**, **Brush library**, **Effects library**, **Color + Layers**.

**Modos:** *Paint* (v1). *3D*: Codex audita qué hay hoy en `endo_testing` y propone; no inventes funciones.

**Alcance v1:**
- Todo lo que `endo_testing` ya hace hoy, sin regresiones.
- Adaptación al chrome común (6.4): barra superior, línea de color, barra de estado, colores y estilo de BASEMENT.
- Guardar y abrir artboards `.artboard` en `~/Basement/`, con miniatura.
- Exportar PNG (y JPG).
- Respetar su librería de efectos y la de brushes.

**Base técnica:** carpeta `studios/endo/` (traída de `endo_testing`, historial de git conservado). Sin dependencia de Rust ni WASM.

**Formatos:** entrada PNG/JPG/WebP; trabajo en formato propio guardado dentro del artboard; salida PNG/JPG. PSD de ida y vuelta queda para la Fase de interoperabilidad.

**Criterios de aceptación:**
1. Crear un artboard de ENDO desde la home, pintar, guardar, cerrar y reabrirlo desde All sin pérdida.
2. Aparece en la lista con barra de color verde y miniatura correcta.
3. Exporta PNG correcto.
4. No se pierde ninguna función que ya existía.

### 7.3 PRISM — EN CURSO

**Qué es:** el Studio tipo Photoshop de BASEMENT, basado en PhotoCraft (Rust, egui, wgpu, WASM).

**Layout de partida** (hasta que Santi suba el Figma; después gana el Figma):
- Riel de herramientas a la izquierda.
- Barra de opciones de la herramienta bajo la barra superior.
- Lienzo (~60 % del ancho).
- Columna derecha (~35 %): **Properties / Adjustments** (arriba), **Layers** (el panel más grande, al centro), **History / Channels** (abajo).

**Modos:** *Edit* (v1). *Retouch*: no implementar hasta que Santi lo defina en su prototipo.

**Alcance objetivo v1** (en la auditoría, marcá cada ítem como **existe / parcial / falta** en PhotoCraft):
- Abrir y guardar PSD; exportar PNG y JPG.
- Capas: crear, reordenar, visibilidad, opacidad, modos de fusión, grupos.
- Máscaras de capa.
- Selecciones (rectángulo, lazo, varita), transformar y recortar.
- Ajustes y filtros básicos (curvas, niveles, tono/saturación, desenfoque, nitidez).
- Pincel, borrador y relleno básicos. *(El trabajo de pintura profundo es de ENDO.)*
- Texto básico.
- Historial / deshacer.

Lo que "falte" no se inventa: se documenta y Santi decide si se prioriza.

**Base técnica:** fork de `storytold/photocraft` en `vendor/photocraft/`, rama `endo-integration`; integración según la decisión de arquitectura de la Fase 3 (sección 5).

**Formatos:** PSD, PNG, JPG.

**Criterios de aceptación:**
1. Crear un artboard de PRISM, abrir una imagen, trabajar con capas y un ajuste, guardar y reabrir desde All sin pérdida.
2. Aparece en la lista con barra de color cian y miniatura.
3. Exporta PNG/JPG correctos.
4. Abre y guarda un PSD simple sin romper las capas.

### 7.4 Studios pendientes (no empezar)

QUILL, REEL, FOLIO, LUX y MIRAGE. Cuando Santi pida uno, completar su sección con la plantilla 7.1, hacer fork del repo correspondiente, auditarlo y recién ahí construirlo. Orden a definir por Santi.

---

## 8. Cómo reportar

Al cerrar cada fase o sesión, escribí a Santi un mensaje con:

1. **Qué quedó andando** y cómo abrirlo (un comando o doble clic en un `.command`/`.app`).
2. **Qué probar**, en 3 pasos como máximo.
3. **Qué necesitás de él**, si algo.
4. **Qué sigue.**

Tono corto y concreto, sin pegarle logs enteros.

---

## 9. Definición de "terminado" (por fase)

Compila y abre en la Mac de Santi desde cero siguiendo `scripts/`, está documentada en `STATUS.md`, tiene captura o demo y Santi dio el OK.

---

## 10. Plan por fases

**Reparto:** Codex hace todo lo técnico. 👤 marca lo único que hace Santi.

### Fase 0 — Preparar la Mac

- 👤 Instalar Codex y abrirlo en una carpeta `basement` (por ejemplo `~/Developer/basement`).
- 👤 Dejarle permiso para ejecutar comandos en esa carpeta y **acceso a red**; aceptar los permisos que pida macOS.
- 👤 Si macOS pide las Command Line Tools, aceptar (`xcode-select --install`).
- 👤 Cuando Codex lo pida, hacer el login de GitHub CLI (`gh auth login`: abre el navegador, se pega un código, se autoriza).
- Codex: instalar Homebrew (avisar antes de pedir la contraseña), Rust (`rustup`), Node, Tauri CLI, `gh`, `git`; verificar versiones y anotarlas en `STATUS.md`.
- ✅ Checkpoint 0: todo instalado y `gh auth status` da OK.

### Fase 1 — Repo y forks (solo lo necesario)

- Codex: `git init`, crear el repo privado `basement` en la cuenta de Santi, hacer fork **solo de `photocraft`** (de `github.com/storytold`), agregarlo como submodule en `vendor/` con `upstream` apuntando al original y la rama `endo-integration`, traer `endo_testing` como `studios/endo/` conservando su historial, crear la estructura de la sección 4 y el primer commit.
- 👤 Nada, salvo avisar si GitHub pide un permiso extra.
- ✅ Checkpoint 1: el repo en GitHub muestra `photocraft` y `studios/endo`.

### Fase 2 — Auditoría (solo ENDO y PRISM)

Codex escribe `docs/audit/endo.md` y `docs/audit/prism.md`:
- **PRISM:** ¿compila en esta Mac, cuánto tarda y pesa? ¿abre y se usa (capturas)? ¿tiene build WASM? ¿tiene CLI, canal de control y MCP? Madurez frente a la lista de alcance de 7.3 (existe / parcial / falta). Riesgos.
- **ENDO:** inventario de lo que `endo_testing` ya hace hoy, estructura del código, dependencias y qué hay que tocar para integrarlo al shell.

- 👤 Abrir ambas una vez y contar en una frase qué le parece y qué falta.
- ✅ Checkpoint 2: Santi confirma el alcance v1 de cada Studio.

### Fase 3 — Spike de arquitectura (solo PRISM)

Codex arma un shell mínimo en Tauri, carga el build WASM de PhotoCraft y mide (¿abre?, ¿WebGPU?, ¿fluidez?, ¿abrir y guardar archivos?), y estima el costo del camino 1 vs el camino 2 de la sección 5. Escribe `docs/decisions/0001-architecture.md` con recomendación.

- 👤 Ver la demo, leer la recomendación y aprobar o pedir ajustes.
- ✅ Checkpoint 3: arquitectura aprobada.

### Fase 4 — Shell y home

- 👤 Subir a `assets/brand/` el logo BASEMENT y las tipografías; exportar el frame de la home a `assets/design/home/` (o conectar el MCP de Figma).
- Codex: implementar la home de la sección 6.2 tal cual el Figma, el sistema de artboards en `~/Basement/` (sección 5), el chrome común de la sección 6.4, la navegación home ↔ Studio, el registro de la extensión `.artboard`, el diálogo mínimo de nuevo artboard y el empaquetado como `.app` (o `.command` mientras tanto).
- ✅ Checkpoint 4: Santi crea un artboard de ENDO y uno de PRISM (aunque PRISM sea provisorio), ve el Studio y los encuentra en All con su color.

### Fase 5 — ENDO dentro de BASEMENT

- 👤 Subir el prototipo de Figma de ENDO a `assets/design/endo/` y completar la sección 7.2 si algo cambia.
- Codex: integrar ENDO según 7.2, con guardado/carga en artboards, chrome común, exportación y miniaturas.
- 👤 Trabajar en una pieza propia de punta a punta y mandar feedback corto (captura + una frase).
- ✅ Checkpoint 5: se cumplen los criterios de aceptación de 7.2.

### Fase 6 — PRISM dentro de BASEMENT

- 👤 Subir el prototipo de Figma de PRISM a `assets/design/prism/` y completar la sección 7.3 si algo cambia.
- Codex: integrar PRISM según la decisión de la Fase 3 y los criterios de 7.3; reemplazar paneles por los del Figma de a uno, empezando por Layers.
- 👤 Probar con una pieza real y dar feedback.
- ✅ Checkpoint 6: se cumplen los criterios de aceptación de 7.3.

### Fase 7 — ENDO ↔ PRISM

Una acción **"Send to…"** en la barra superior que copia el artboard actual al otro Studio como artboard nuevo (v1: PNG aplanado; v2: capas vía PSD). Perfiles de color consistentes entre ambos. Pulido de rendimiento y arranque.

- ✅ Checkpoint 7: Santi pinta en ENDO, lo manda a PRISM, lo termina y exporta, sin salir de BASEMENT.

### Fase 8+ — Siguientes Studios, uno por vez

Orden a definir por Santi. Cada uno requiere: su prototipo de Figma, su sección completada con la plantilla 7.1, su fork y su auditoría. Cada Studio cierra con su propio checkpoint antes de pasar al siguiente.

### Mantenimiento continuo

Una vez por mes, traer las novedades de `upstream` de cada fork, probar y reportar en `STATUS.md`. Cada mejora nueva es un mini-ciclo: Santi dice qué quiere → Codex propone → muestra → Santi ajusta.

---

## 11. Prompt inicial (para pegarle a Codex la primera vez)

```
Leé AGENTS.md de esta carpeta. Vamos a construir BASEMENT paso a paso, y por ahora
solo con los Studios ENDO y PRISM. Arrancá por la Fase 0: revisá qué tengo instalado
en mi Mac, instalá lo que falte (avisame antes de pedirme la contraseña) y decime
exactamente qué tengo que hacer yo, con pasos numerados. Yo no escribo código:
cuando termines, actualizá STATUS.md y contame qué quedó listo y qué necesitás de mí.
```
