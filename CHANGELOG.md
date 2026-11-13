# Changelog and feature inventory

## Unreleased — public-source preparation

### Fixed
- Ignore stale asynchronous render results after a newer search/refresh or close.
- Cancel pending debounced refreshes and disconnect the resize observer on close.
- Recalculate columns on resize without rereading every note or replacing cards.
- Keep only one focus overlay; remove Escape listeners on every close path.
- Use one click handler rather than competing touchend/click handlers.
- Give focus close/back controls native button semantics and accessible labels.
- Use the documented ItemView content element; contain overlays within the pane.
- Require whole-line frontmatter delimiters; do not swallow a link following a wiki image.
- Dispose the production build context rather than forcing process exit.
- Remove the broken version script referencing an absent file and staging Git changes.

### Added
- Offline mocked regression tests and a separate typecheck command.
- Exact development dependency versions matching the inherited lockfile.
- External dependency resolution via NODE_PATH for source-only checkouts.
- Build, manual deployment, safety, and test-limit documentation.
- A synthetic example note and expanded ignores for dependencies/generated/private files.

## Inherited source inventory (manifest 1.0.0)

This lists existing functionality, not a claim about a published release:

- Ribbon icon and command to open/reuse the board tab.
- Vault-wide Markdown note list, newest modification first.
- Case-insensitive title/path search.
- Basic plain-text previews, relative dates, responsive CSS columns.
- Vault/metadata event refreshes.
- Pane-filling raw-text focus overlay with close, Escape, and narrow-screen back controls.

No release date or earlier release history was supplied.
