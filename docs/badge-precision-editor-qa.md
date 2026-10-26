# Badge precision editor — local verification

This follow-up is based on `a08bb49ba82f91e4b97671fcf86c3f6e961d42a1` (the already deployed logo/design PR #29). Work is isolated on `feat/badge-precision-editor`. The user approved commit, push, merge, and production deployment on 2026-10-26. Production release remains gated on verified feedback support for MACH IDs 30 and 31.

## Scope

Both badge tools share a per-template editor for name, affiliation, title, event, date, Hanyang logo, and ERICA logo. Text supports millimeter position/box size, installed-font stacks, point size, color, alignment, line height, letter spacing, and visibility. Logos preserve source aspect ratios. Existing logo visibility remains controlled by the four logo choices.

Preview dragging and keyboard nudging use badge millimeters. Numeric controls show the saved values. Automatic fitting treats the requested point size multiplied by the global size ratio as a maximum; manual typography preserves the exact requested point size and ignores that ratio. Overflow remains visible as a warning and blocks unsafe print output. The same rendering path produces the single preview, A4 preview, and print/PDF sheets.

Resetting a selected element clears its overrides. Resetting the current design clears all overrides for that template. Neither reset removes names, roster entries, common event/date, logo choice, millimeter dimensions, print settings, or another template's overrides.

## Compatibility and privacy

- Version 1 project files migrate to version 2 without losing the original fields. Sparse design overrides and optional dates round-trip in version 2.
- CSV/TSV retain the first four columns and add an optional fifth date column. Formula-safe export and literal text rendering remain in use.
- No automatic browser persistence, analytics, remote font download, or roster transmission was added. Explicit JSON files contain the user's roster.
- The feedback control is deliberately disabled pending live verification that the production backend permits the existing MACH IDs `30` and `31`. No alternate tool ID is used. When enabled after verification, its URL contains only the fixed tool ID and suppresses the referrer.

## Verification record

The repeatable checks are `tests/badge-core.cjs`, `tests/badge-browser.cjs`, `tests/badge-logo-browser.cjs`, and `tests/badge-editor-browser.cjs`. Browser checks use a separate headless Edge profile and synthetic names. They do not operate the user's existing browser tabs.

Final local results on 2026-10-26: 30 core checks, 382 precision-editor checks, 106 general browser/print checks, and 2,068 logo/design checks across 384 combinations. The new editor suite produced six PDFs totaling 14 A4 pages. Separate default-design regression PDFs are retained with their own reports.

The editor suite covers actual pointer movement at desktop and narrow widths, keyboard nudging, pointer cancellation before mouseup, numeric validation, five font choices, manual size stability, automatic size re-entry, empty and hidden elements, reset/template isolation, selected-record measurement, date CSV/JSON restoration, all eight templates, print-media geometry and typography, batch PDF name order, selected printing, crop marks, and privacy.

Generated PDFs are measured as A4 and text is extracted to verify roster order. Screenshots include the expanded desktop controls, narrow editing layout, manual badge examples, and print sheets. Physical printer output remains unverified; the on-screen instructions require actual-size printing and a ruler check.

The first concurrent general-regression run timed out while capturing a screenshot; its serial rerun passed. A logo restoration check also exposed a test timing race: it waited for animation frames rather than asynchronous file reading. A focused reproduction passed 20 natural reads and reproduced the early assertion in three delayed reads, with all three restoring correctly once reading completed. Both older browser suites now explicitly wait for the exact restored state before keeping their original assertions. No product change was needed for this test race.

The manual-print fixtures intentionally assign identical custom coordinates/colors across templates. This demonstrates exact override behavior but produces low contrast in a dark ribbon and places a logo on the side decoration in one fixture. Those user-selected combinations are recorded in `pdf-render-review.json`; they are not the default designs. The frame screenshots provide a clearer visual example of the new editor.

Final machine-readable results and generated artifacts are retained outside the deployable repository in `../evidence/editor-patch/`. Until the production feedback backend has been confirmed and the exact tool links verified, this patch remains a draft and must not be merged or deployed with the feedback feature described as complete. Existing published logo/design and private personal-MACH releases are separate completed operations.
