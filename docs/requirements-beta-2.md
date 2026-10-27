# Basement Beta 2.0 — agreed product requirements

Confirmed by Santiago on 26 October 2026. The nine supplied hub references define the visual direction; their example names, dates, storage totals and old Studio lists are illustrative. The implementation should resolve remaining UI choices against those references.

## Scope and delivery

1. First remove the desktop/installable PWA behavior, retaining folder saving. Then replace the entire hub. Existing Studio visual designs remain intact; their common Home navigation and persistence may be integrated.
2. Basement is a public website entered by URL. Retain `Abrir BASEMENT.command` only for local development at `http://127.0.0.1:8000`. Remove the installed Basement wrapper from this computer without deleting browser or library data.
3. Complete and refine the local redesign before publication. On 27 October 2026 Santiago approved publishing and updating the existing public `santiagobarbieri/basement` repository while preserving its history. Production is https://basement-two-gamma.vercel.app/, automatically deployed from main to the Vercel basement project.
4. The release label is **Beta 2.0**. No legacy project migration or format compatibility work is required, but do not delete the user's data.
5. A connection is required to load the website; no offline PWA. If connection drops with an Artboard already open, editing and saving to the chosen folder remain available with a connection notice.
6. Updates are detected and applied from the hub. Apply only with no Studio open, no pending save and no other Basement window. Never force a Studio reload.

## Hub layout and visual direction

- Reproduce the references as faithfully as possible: left sidebar, large Basement wordmark, local profile button, Projects/Studios/About/Contact navigation, folder section, version/update section, mode/security/storage at the bottom, top title and search/new/filter/view controls, bordered Artboard grid/list area and bottom Export/Import/Trash controls.
- Use the Basement logo and Studio/UI symbols served from `dist/hub/assets/`. Studio colors should have coordinated dark and light variants.
- English UI; use **Artboard** throughout, including **All Artboards** and **All Endo Artboards**. No Project/File/Artwork terms for editable works in product labels.
- Desktop first. On narrower screens, expose the sidebar as a menu. Dark is the first-visit default; remember the last theme. Shared Studio theme adaptation comes later.
- Add simple hover treatments and modest transitions. Support reduced motion.
- Clicking the logo returns to Projects. Studios, About and Contact each show only a small **Coming soon** text for now. A future Studios carousel will also include downloadable Basement apps such as Margin and Sandbox (provisional name).
- Include only the working Studios in creation and filters. Hide future Studios rather than showing Soon tiles. Existing available editors: Kiln, Endo, Tremor, Foundry, Contour, Marble and Distortion.
- All navigation and Studio opening uses the same tab. Only one Basement tab may be active at a time. Studios receive a simple matching Home button and otherwise keep their current styles.

## Local profile and settings

- One local profile per browser; no account or login. Default name **Local profile** and a user icon. Name, photo and preferences remain in the browser, not in the chosen folder.
- The profile control is an action button opening Settings, without a misleading account selector.
- Settings sections: Account, Folder, Storage and Trash; Updates if useful. Match the supplied split sidebar/content modal.
- Name and photo changes apply only on **Save Changes**. Closing with unsaved changes asks for confirmation.
- Modals close with Escape or an outside click. No visible close buttons. A new-Artboard second step includes a small back arrow with text explaining the return to Studio choice.

## Folder and saving

- Choosing a folder is mandatory before creating an Artboard. Use File System Access in Chrome. One active library folder at a time.
- Disk is the main save destination. IndexedDB retains the permission/recovery cache; keep the stable `basement-projects` database. Never silently switch primary saving to IndexedDB after a disk failure.
- One portable `.ment` file per Artboard, including its required source image and resources. A `.ment` belongs to one Studio and can only be edited in that Studio. Renaming keeps the Artboard's stable identifier.
- Folder changes offer opening another library, copying the current library there, or moving it there. Moving removes originals only after verifying the copies.
- An individual Artboard can be moved to any chosen computer folder, after which it leaves the active library.
- Autosave occurs five seconds after editing pauses, and manual save remains available. Display Saving, Saved and Save error states.
- Lost permission or failed disk write blocks further editing. Preserve the current work in memory and allow reconnection/retry or an emergency `.ment` download.
- Refresh for filesystem changes when the tab regains focus and periodically while the hub is visible. For external changes to the open Artboard, ask whether to load the disk version or preserve the current edit.
- Security reports actual saving/access health. Sidebar Storage reports the library's file size; Settings also reports browser storage usage. Do not label browser quota as free disk space. Show disk free space only if reliably available.

## Artboard library

- Initial title **All Artboards**; a single Studio filter changes it to **All [Studio] Artboards**.
- Search by name only. Names are unique across the entire active library, without case sensitivity.
- Sort by last opening, newest first. Grid cards and list dates describe last opening. Returning to the hub resets search, filters and view rather than retaining them.
- Grid previews use the last saved state; if none exists, use a plain empty preview background. List contains Studio symbol, Artboard name, last opening and a three-dot menu.
- Menu: Open, Rename, Duplicate, Export, Move, Select, Move to Trash.
- Duplicate gets a new identifier and a generated `Name Copy` name (with numeric suffix as needed).
- Multiple selection supports ZIP download, Move and Move to Trash. No batch duplication.
- No collections, favorites, internal user-facing folders or tags in this release.
- Empty library and no-result states are small plain text, without decoration: **No Artboards yet** and **No results**.

## Creation

- New Artboard always shows all working Studios, regardless of the current filter.
- Two-step modal: choose Studio → enter mandatory unique name and, for image Studios, a mandatory initial image → Create Artboard → same-tab editor.
- Kiln, Contour and Distortion require an initial image; Endo, Tremor, Foundry and Marble require only the name.
- The second step combines a large colored Studio illustration and an accurate one-to-two-paragraph description with the creation form. Folder and security rows are informational, not folder-change controls.
- Embed the image in the `.ment`; do not depend on its original filesystem path.

## Import and export

- Import one or many `.ment` files, or a ZIP containing `.ment` files in nested folders. Libraries themselves are opened by choosing their folder.
- Report invalid and incompatible files. For an existing identity or name conflict offer Replace, Import as copy or Cancel, with an apply-to-all option for a batch.
- Hub Export downloads the entire active library as a ZIP containing only its `.ment` files. Multiple selection can download a custom ZIP. Each `.ment` includes what it needs internally.
- Final art formats such as PNG/GIF/font files remain Studio exports, not hub exports.

## Trash

- A Basement-owned trash lives inside the selected library folder. Settings Trash and the footer Trash open the same view.
- Support individual restore, permanent delete and Empty Trash. Always confirm permanent deletion and emptying.
- Retention is thirty days; show time remaining. When expired items are discovered on opening the library, present a final warning and delete only if the user explicitly confirms. The closed website cannot run cleanup.
- If restoration conflicts with an active Artboard name, ask for a new name.

## Validation constraints

- Regenerate `dist/precache.json` and the generated `BUILD` in `dist/sw.js` with `python3 scripts/build-precache.py` after dist edits; do not manually change the hash.
- Run storage unit tests and the isolated Chrome PWA/browser suite for storage/platform changes. Browser tests use a fresh profile and OPFS, never the real library. Local Chrome execution requires sandbox escalation.

## UX refinements — 27 October 2026

- Use neutral gray borders with reduced contrast in both themes; the tentative cream color for light mode was rejected.
- The desktop library has four equal, fluid-width columns with 16 px gutters; keep the shell fixed and scroll only Artboard collections.
- Navigation rows retain their height across selection; hide the preceding separator around a rounded active row.
- Active Studio-filter symbols use the button text color, and the menu appears above the library.
- Storage shows actual per-Studio/Trash/Other library bytes separately from browser usage/allowance.
- Approved navigation to a saved Artboard must not trigger a native leave-page prompt; genuine unsaved work remains protected.
- Periodic refresh preserves scroll and focused controls, including when relative dates change.

## Toolbar and source cleanup — 27 October 2026

- Export, Import and Trash sit before Search in the top toolbar. The New Artboard action is last, after the Studio filter and grid/list selector. The Artboard frame extends down to the small status strip.
- Keep only active source/assets, current development utilities, tests and useful Studio/product documentation. Historical releases, replaced launchers, desktop packaging, prototype ZIPs and unused asset packs have been removed.
