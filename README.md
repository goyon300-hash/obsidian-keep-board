# Keep Board

A Google Keep-style, read-only notes board for [Obsidian](https://obsidian.md).
Open it with the grid ribbon icon or the **Open Keep Board** command.

## Features

- Lists Markdown notes from the whole vault, newest modification first.
- Filters by note title or vault-relative path, ignoring case.
- Plain-text previews (up to 200 characters plus an ellipsis) with basic Markdown cleanup.
- Responsive CSS-column layout and a scrollable board.
- Refreshes on note creation, modification, deletion, rename, and metadata changes.
- Opens a note's raw text in a pane-filling focus overlay; close with the close
  button, Escape, or the on-screen back button on narrow screens.
- Reads notes through Obsidian's vault API; no network requests, credentials,
  settings, or write-to-vault feature are implemented by this plugin.

See [CHANGELOG.md](CHANGELOG.md) for the feature inventory and preparation fixes.

## Build and test

Use Node.js 18 or newer and npm. Development dependencies are required even for
a production bundle:

```sh
npm ci --include=dev
npm test
npm run typecheck
npm run build
```

The lockfile records exact package versions and integrity hashes. Installation
normally needs the npm registry (or a populated npm cache); tests and builds
make no network requests once dependencies are available.

`npm run build` typechecks and generates the ignored `main.js` CommonJS bundle,
with Obsidian supplied by the host. `npm run dev` watches source changes and
rebuilds with inline source maps; it does **not** reload Obsidian automatically.
Do not distribute development bundles containing source maps.

For an existing dependency installation outside the checkout, set `NODE_PATH`
to its `node_modules` directory before running the same commands. Both the
build and typecheck scripts support this without adding dependencies or links
to the source tree. Tests bundle source in memory.

## Manual installation / update

Back up your vault and try a disposable test vault first. No automatic vault
deployment is performed by the build scripts.

1. Build as above.
2. Create `<vault>/.obsidian/plugins/keep-board/`.
3. Copy **only** `main.js`, `manifest.json`, and `styles.css` into that folder.
4. Enable community plugins if appropriate for your trust policy, then enable
   **Keep Board** in Obsidian's settings.
5. On updates, disable/re-enable the plugin (or restart Obsidian).

The manifest retains plugin ID `keep-board`, author `Mateusz`, version
`1.0.0`, and minimum app version `1.0.0` from the source. These metadata
values are not a claim that every Obsidian version or mobile platform has
been tested. Keep the directory name equal to the plugin ID.

## Example

[examples/Welcome.md](examples/Welcome.md) is a synthetic note, not a real vault
export. Copy it into a disposable vault, open the board, search for
`Welcome`, and open the card to inspect the raw-text focus view.

## Tests and limits

Offline Node tests use small Obsidian and DOM doubles. They cover sorting and
search, overlapping reads, close-time cancellation, resize without rereads,
focus-overlay cleanup, and preview regressions. They do **not** validate actual
browser layout, touch event synthesis, Obsidian integration, keyboard focus
trapping, screen-reader behavior, or mobile navigation.

Before deploying, manually check those areas in a test vault, including
rapid searches, repeated focus open/close, pane resizing, note renames, and
closing a board while notes are loading.

- This is not a Markdown renderer: previews use basic regex cleanup; focus
  shows raw text, including frontmatter.
- No editing, note creation, pinning, tags, folder filters, or settings UI.
- All matching notes are read sequentially on refresh; very large vaults may
  be slow. There is no pagination or virtualization.
- Cards remain pointer-operated; comprehensive keyboard navigation is not implemented.
- CSS columns flow vertically and are not a shortest-column packing algorithm.
- Unreadable notes retain title/date but no preview; focus displays a load error.
- Focus content is a snapshot, not a live editor. The on-screen back button is
  not OS/browser-history integration.

## Source and license

App source lives in `src/`; styles and the manifest are at the repository root.
No dependencies or generated bundle belong in the public source payload.

The original package metadata declares MIT. No standalone license text
accompanied this source, and no new license grant has been added here.
