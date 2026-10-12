# PRISM / PhotoCraft audit

Date: 2026-10-12. Source: `20cb95bc272feb9691537bccb46e84e583f5a04a`,
PhotoCraft 0.7.0. Original engine and interface unchanged.

## Result and measurements

PhotoCraft compiles and opens on this Mac with an Apple M2 Pro / Metal GPU adapter.
The native UI, authenticated JSON control channel, command CLI, and MCP handshake
were exercised. A small layered document survived PSD and `.pcraft` save/reopen:
both regenerated PNGs were byte-identical to the original export. This does not
establish compatibility with Photoshop or arbitrary PSDs.

| Measurement | Result |
| --- | --- |
| Native build | `cargo build --locked --release -p photocraft -p photocraft-cli`: 254.40 s wall time, including dependency downloads on this machine. |
| App executable | 59,935,872 bytes (57.16 MiB), unbundled unsigned release binary. |
| CLI executable | 39,028,784 bytes (37.22 MiB). |
| Web target check | `cargo check --locked -p photocraft-web --target wasm32-unknown-unknown`: passed in 294.32 s with a separate target/cache directory. |
| Registry | 884 engine commands enumerated at runtime. Existence alone does not mean mature behavior. |
| Native scenario | 33 successful calls for creation/editing/saving/reopening; 11 additional successful calls for fill, erase, sharpen, arrange and nested groups. |
| MCP | `initialize` and `tools/list` succeeded on the stdio server; 25 advertised tools. Actual tools were not all individually exercised. |

Build logs include a future-Rust compatibility warning for the external `block`
crate; it did not fail this build. No complete workspace suite or performance
benchmark was run: this phase audits integration capabilities, with bounded smoke
tests and explicit limits.

## Scope assessment

“Exists” means source/registry plus the stated local scenario passed. “Partial”
means a usable implementation exists with material upstream limitations or an
unverified target acceptance criterion. Nothing below is a claim of Photoshop parity.

| AGENTS v1 requirement | State | Evidence / limits |
| --- | --- | --- |
| Open/save PSD | Partial | A 480×480 RGB/8 PSD reopened with pixel, mask, adjustment, type and group layers; PNG match. External Photoshop acceptance and complex files unverified; upstream documents known fidelity gaps. |
| PNG/JPEG export | Exists | Saved both formats from the native app; flat-format loss-of-layers warnings are explicit and expected. |
| Create/reorder/hide/opacity/blending/groups | Exists | Created layers, toggled visibility, set 0.8 opacity and Multiply, moved a layer backward, created a nested group and reopened the extra PSD with its child intact. |
| Layer masks | Exists | Reveal-all mask persisted on the paint layer through PSD/native reopen; mask painting/refinement depth not tested. |
| Rectangle/lasso/wand selection | Exists | All three commands dispatched successfully on the audit document; precision/edge quality not measured. |
| Transform/crop | Exists | Affine translation and crop to 480×480 passed; advanced transform depth is partial upstream. |
| Curves/levels/hue-saturation | Exists | Applied Curves and Levels to pixels; created a Hue/Saturation adjustment layer with preserved parameters and mask. |
| Blur/sharpen | Exists | Gaussian blur and Unsharp Mask commands passed. |
| Brush/eraser/fill | Exists | Pressure-bearing stroke, erase-mode stroke, and color fill commands passed. Real pen hardware and brush feel untested. |
| Basic text | Partial | Editable Inter type layer reopened with text and size preserved. Upstream reports limitations in typography and transformations. |
| Undo/history | Exists | Undo/redo dispatched, history visible in runtime document inspection. Full history persistence across reopening is not promised. |
| BASEMENT artboard lifecycle | Missing | Home, `.artboard`, shared chrome, thumbnails and disk-root integration do not exist yet; they belong to later phases. |

The proposed 18-tool PRISM rail can map to real PhotoCraft tools: Move,
RectMarquee, Lasso, MagicWand, Crop, Eyedropper, SpotHealing, Brush, CloneStamp,
Eraser, PaintBucket, Blur, Dodge/Burn, Pen, Type, Rectangle/shape, Hand and Zoom.
Each selector was accepted by `ui.set` (Dodge tested as the representative for the
Dodge/Burn pair). This verifies tool selection, not every tool's editing result.

## Architecture and interfaces

- Native app: `apps/photocraft`, egui/eframe with wgpu. UI is in `crates/ui-egui`;
  engine/session/registry in `crates/engine`; lower crates implement document,
  raster, paint, vector, text, CPU/GPU composition, codecs, PSD and native storage.
- CLI: `apps/photocraft-cli` exposes convert, info, run, batch, commands, MCP and
  a persistent headless JSON server. `info` confirmed the layer trees in saved files.
- Native control: loopback TCP JSON lines with mandatory token authentication.
  Tested `engine.execute`, `ui.inspect`, `ui.set`, `ui.resize`, `ui.screenshot`,
  `app.open`, `app.save`. File operations are bounded by granted read/write roots.
- MCP: `crates/automation`, stdio headless or bridge to the live desktop app.
  Headless MCP advertises some UI tools but they require bridge mode to operate.
- Web: `apps/photocraft-web` exists and passed target compilation checks. Trunk
  provides wasm-bindgen glue and assets. wgpu supports WebGPU with WebGL2 fallback.
  Browser opens files asynchronously and saves by download; browser shell has no
  TCP listener or desktop recovery services.

The native control channel cannot simply be called inside a browser frame.
Replacing egui panels with HTML needs a deliberate engine/JS bridge or native
sidecar strategy; this audit does not choose one. Upstream's contributor rules
keep PhotoCraft Rust-only: BASEMENT's shell integration must live outside vendor
code unless a specifically approved minimal integration patch is needed.

The final web artifact, wasm size, web runtime, WebGPU in macOS WebView,
performance inside Tauri, and real disk I/O are **not yet verified**. Those are the
Phase 3 spike, not a consequence of a successful `cargo check`. No Trunk/system
package was installed during this audit; only Rust's wasm target was added.

## Risks and recommendation for the scope checkpoint

Upstream `ROADMAP.md` and `docs/gaps.md` identify alpha maturity, PSD fidelity and
Photoshop acceptance, interactive performance, brush feel and type depth as major
gaps. Their estimates and percentages are upstream claims, not measurements made
for BASEMENT. The local small-document success does not remove those risks.

Keep the v1 goal of image editing, layered saves and PNG/JPEG export, while treating
PSD interchange as limited until real files are tested. Preserve `.pcraft` as a
candidate lossless internal work format, with PSD for exchange; the architecture
checkpoint must decide this explicitly. Keep the supplied shared visual design as
the final target. Assess native UI embedding versus HTML-driven engine integration
with evidence during Phase 3. Do not start the Tauri spike before Santi approves
this scope checkpoint.

## Evidence and opening

- [Native interface](evidence/prism-native.png).
- [Reopened PSD interface](evidence/prism-psd-reopened.png.ui.png).
- [Test PSD](evidence/prism-test.psd), [native project](evidence/prism-test.pcraft),
  [PNG](evidence/prism-test.png), [JPEG](evidence/prism-test.jpg).
- [Operation log](evidence/prism-checks.json), [additional checks](evidence/prism-extra-checks.json),
  [MCP handshake](evidence/prism-mcp.json), [tool selection checks](evidence/prism-tools.json).

The original PNG and both reopened PNG exports have SHA-256
`9e56ced87b26a5b697f7baa6ef7827e2d2f4445bfeb3a7f09761da34bd1b7a9a`.
The round-trip layer metadata shows the 0.8-opacity Multiply paint layer and its
mask, Hue/Saturation adjustment and mask, editable type, group, and background.

Double-click `scripts/run-prism.command` to open the original native PhotoCraft
with the test PSD. This uses an isolated config folder; it is an audit launcher,
not the future BASEMENT app. On a fresh checkout the launcher builds the binary
first. Santi should open both original editors once and report what feels missing.
