# src/ui: the oc3 design system in om3-webapp

The look of oc3-frontend (the OpenSVC collector UI), kept here until it moves to a
package shared by both apps. Nothing in `src/ui` imports app code: it must stay
liftable as a whole.

Source: `opensvc/oc3-frontend`, branch `first-draft`, commit `330f423`. Files marked
"copied" below are verbatim apart from their import paths; "adapted" ones say what
changed. To pick up oc3 changes, diff the copied files against that repository. Three copied
files carry fixes oc3 does not have yet (marked "fixed" below): they are worth
sending upstream.

Type check (strict, apart from the JavaScript app): `npx tsc -p tsconfig.ui.json`.
Tests: `npx vitest run src/ui`.

## Foundation

| File | Origin | Role |
|---|---|---|
| `styles/tokens.css` | copied (`src/styles/tokens.css`) | colours, type, density; light, dark, high contrast |
| `styles/index.css` | copied, plus the font import | Tailwind v4 entry, tokens as utilities (`bg-surface`, `text-state-down`…) |
| `styles/fonts.css` | om3 | IBM Plex Sans, latin subsets only (the single-file build inlines fonts) |
| `theme.ts` | adapted (`src/lib/theme.ts`) | system / light / dark mode and palette, `om3.*` storage keys |
| `cn.ts` | copied (`src/lib/utils.ts`) | class merging |
| `icons.tsx` | copied, plus `MoreIcon`, `MoonIcon`, `SunIcon` drawn in the same register | the oc3 icon set, `currentColor` |
| `assets/` | copied | OpenSVC logo |

## Components

| Component | Origin | Replaced (MUI, removed) |
|---|---|---|
| `Button`, `IconButton` | om3, from the oc3 inline classes | Button, IconButton |
| `Input`, `Textarea`, `Select`, `Checkbox`, `Field` | om3, from the oc3 inline classes | TextField, Select, Checkbox, FormControlLabel |
| `Dialog` | om3, from the oc3 `ImpersonateDialog` pattern | Dialog, DialogTitle, DialogContent, DialogActions |
| `ConfirmButton` | copied | confirmation dialogs of a single destructive action |
| `MenuButton` | copied, fixed: the arrows skip disabled entries; om3 additions: `icon`, `compact`, `align`, menu placed against the window | Menu, MenuItem |
| `Combobox` | copied | Autocomplete |
| `Switch` | copied | Switch |
| `Tabs` (`TabList`, `tabs-ids`), `CategoryTabs` | copied; `CategoryTabs` fixed: focus selector escaped, as in `Tabs` | Tabs, Tab |
| `SlideOver` (+ `slide-over-*`) | copied | Drawer |
| `StatusBadge`, `status` | adapted: English labels instead of i18n | status Chips |
| `FrozenMark` | adapted: English label | frozen icons |
| `ObjectIcon` | adapted: om3 kinds added (namespace, kind, pool, heartbeat) | menu and kind icons |
| `Alert` | om3, in the state colours | Alert, Snackbar content |
| `Spinner` | om3 | CircularProgress |
| `Table` (`HeaderRow`, `HeaderCell`, `SortHeaderCell`, `Row`, `Cell`, `EmptyRow`) | om3, from the oc3 `CollectorList` markup | Table* |
| `StatusMark`, `StatusCount`, `StateGlyph` | om3, from the `StatusBadge` glyphs, drawn in SVG | status dots and status counts |
| `UsageBar` | om3 | determinate LinearProgress |
| `StoppedMark`, `RpoBreachedMark` (`StateMarks`) | om3 | stopped and RPO breached icons |
| `lib/media` (`useMediaQuery`) | om3 | MUI useMediaQuery |
| `DateTime`, `RelativeTime`, `lib/format` | copied | date formatting |
| `YamlCode`, `lib/yaml-tokens` | copied | config viewers |
| `UnifiedDiff` | copied, fixed: a final newline adds no empty line | config diffs |
| `lib/shortcuts` | copied | keyboard shortcuts (`useShortcut`) |

Not ported yet: `TextFilter`, `EnumFilter` (column filters of `CollectorList`),
`Timeline`, `TimeChart`, `TrailBar`, `Flash` (needs the oc3 realtime layer). They
come with the views that need them.

## Rules

- Colours only through the tokens (`bg-surface-raised`, `text-ink-muted`,
  `border-line`, `text-state-*`): never a hard-coded colour. Dark mode and high
  contrast then come for free.
- State is never told by colour alone: a glyph, an icon or a label goes with it
  (`StatusMark`, `StatusBadge`, `FrozenMark`).
- Tailwind sees only class names written out in full: no names built at runtime.
- Icons from `icons.tsx` only (`currentColor`, sized by class); a missing one is
  drawn there, in the same register (filled shapes on a 24 grid).

## Writing a view

- Page: `p-4 space-y-3`, or `flex h-full flex-col gap-3 p-4` when a table scrolls
  in its own container. Title `h1 className="text-title font-semibold"`.
- List toolbar above the table: `flex flex-wrap items-center gap-3`, each filter a
  `label className="flex items-center gap-1 text-ink-muted"` with a compact control
  (`Select className="h-7"`), actions at the end (`ml-auto`, `MenuButton align="end"`).
- Tables: `Table` (`sticky` with a bounded height: `min-h-0 flex-1` or `max-h-*`;
  `ref` is the scrolling container, `aria-label` names the table). Rows are 30px:
  what a cell holds fits one line (`UsageBar` beside its value, `IconButton
  size="sm"`, `MenuButton icon={<MoreIcon/>} compact`, no wrapping dates).
- Sections: a raised panel (`rounded-(--radius-panel) border border-line
  bg-surface-raised`) with an `h2` header strip (`border-b border-line px-3 py-2`).
- Side panels: `SlideOver`; modals: `Dialog` (actions in `footer`); a single
  destructive confirmation: `ConfirmButton`; feedback: `Alert` in place.
- Tests query by role and accessible name; `Dialog` renders into `document.body`.
