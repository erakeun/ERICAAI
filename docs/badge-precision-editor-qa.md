# Badge precision editor — local verification

This follow-up is based on `a08bb49ba82f91e4b97671fcf86c3f6e961d42a1` (the already deployed logo/design PR #29). Work is isolated on `feat/badge-precision-editor`. The user approved commit, push, merge, and production deployment on 2026-10-26. The feedback release gate was resolved on Mac by read-only production GET verification of MACH IDs 30 and 31 on 2026-10-26. The latest main (`44404711ed666a1e8a58d1e22d4530d5a59f2a63`, public-game PR #31) was merged before final verification.

## Scope

Both badge tools share a per-template editor for name, affiliation, title, event, date, Hanyang logo, and ERICA logo. Text supports millimeter position/box size, installed-font stacks, point size, color, alignment, line height, letter spacing, and visibility. Logos preserve source aspect ratios. Existing logo visibility remains controlled by the four logo choices.

Preview dragging and keyboard nudging use badge millimeters. Numeric controls show the saved values. Automatic fitting treats the requested point size multiplied by the global size ratio as a maximum; manual typography preserves the exact requested point size and ignores that ratio. Overflow remains visible as a warning and blocks unsafe print output. The same rendering path produces the single preview, A4 preview, and print/PDF sheets.

Resetting a selected element clears its overrides. Resetting the current design clears all overrides for that template. Neither reset removes names, roster entries, common event/date, logo choice, millimeter dimensions, print settings, or another template's overrides.

## Compatibility and privacy

- Version 1 project files migrate to version 2 without losing the original fields. Sparse design overrides and optional dates round-trip in version 2.
- CSV/TSV retain the first four columns and add an optional fifth date column. Formula-safe export and literal text rendering remain in use.
- No automatic browser persistence, analytics, remote font download, or roster transmission was added. Explicit JSON files contain the user's roster.
- The feedback links are enabled after live GET verification: `30` displays **목걸이형 명찰 제작기** and `31` displays **집게·옷핀형 명찰 제작기**. Each URL contains only its fixed tool ID and opens a new tab with `noopener noreferrer` and `no-referrer`. No production feedback submission, Sheet change, or permission change was performed.

## Initial Windows verification record

The repeatable checks are `tests/badge-core.cjs`, `tests/badge-browser.cjs`, `tests/badge-logo-browser.cjs`, and `tests/badge-editor-browser.cjs`. Browser checks use a separate headless Edge profile and synthetic names. They do not operate the user's existing browser tabs.

Final local results on 2026-10-26: 30 core checks, 382 precision-editor checks, 106 general browser/print checks, and 2,068 logo/design checks across 384 combinations. The new editor suite produced six PDFs totaling 14 A4 pages. Separate default-design regression PDFs are retained with their own reports.

The editor suite covers actual pointer movement at desktop and narrow widths, keyboard nudging, pointer cancellation before mouseup, numeric validation, five font choices, manual size stability, automatic size re-entry, empty and hidden elements, reset/template isolation, selected-record measurement, date CSV/JSON restoration, all eight templates, print-media geometry and typography, batch PDF name order, selected printing, crop marks, and privacy.

Generated PDFs are measured as A4 and text is extracted to verify roster order. Screenshots include the expanded desktop controls, narrow editing layout, manual badge examples, and print sheets. Physical printer output remains unverified; the on-screen instructions require actual-size printing and a ruler check.

The first concurrent general-regression run timed out while capturing a screenshot; its serial rerun passed. A logo restoration check also exposed a test timing race: it waited for animation frames rather than asynchronous file reading. A focused reproduction passed 20 natural reads and reproduced the early assertion in three delayed reads, with all three restoring correctly once reading completed. Both older browser suites now explicitly wait for the exact restored state before keeping their original assertions. No product change was needed for this test race.

The manual-print fixtures intentionally assign identical custom coordinates/colors across templates. This demonstrates exact override behavior but produces low contrast in a dark ribbon and places a logo on the side decoration in one fixture. Those user-selected combinations are recorded in `pdf-render-review.json`; they are not the default designs. The frame screenshots provide a clearer visual example of the new editor.

Initial machine-readable results and generated artifacts were retained outside the deployable repository in `../evidence/editor-patch/` on Windows. Those local artifacts and additional unpushed Windows changes were not assumed available on Mac. Existing published logo/design and private personal-MACH releases remain separate operations.


## Mac release verification (2026-10-26)

- A fresh, isolated checkout started from remote PR #30 at `e08fe0ea40056019e9ae1d3cb367606a3f3722da`. No applicable `AGENTS.md` or `.agents/skills` instructions were found in the Mac checkout or its checked ancestors; the badge README and existing QA/test instructions were read.
- The final difference from latest main remains limited to the same 16 badge-related files. Main catalog, NOW, feedback 17, hidden 18, contact, the public game below NOW, guides, and original logo assets are byte-identical to main.
- Passed again on Mac: **30 core**, **106 general browser/print**, **382 editor**, **2,068 logo/design** checks (384 combinations), plus **15 catalog browser**, **11 public-game preservation**, and **14 live feedback** checks. Browser tests exercise actual pointer movement, exact millimeter and typography controls, JSON download/reopen and v1 migration, CSV, all eight designs, selected/batch printing, and narrow layouts.
- The editor produces **six PDFs / 14 A4 pages**, with extracted roster order verified. The general/logo suites produce another 14 PDFs / 34 A4 pages. All **20 PDFs / 48 pages** were rendered and visually reviewed. The intentional low-contrast/manual-logo placements described above remain fixture styling, with no new clipping or print divergence. Physical printing remains unverified.
- Live new-tab feedback checks pass for both IDs: exact title and URL, no opener, no incoming referrer, and no synthetic personal data in request URLs. A context-wide route allows only GET; Google framework CSP/warden POST attempts are blocked before network transmission. Neither feedback form is filled or submitted.
- Test-only dependencies are outside the repository. PDF.js is pinned to `5.4.296` because its newer API removed `PDFDocumentProxy.destroy`; the compatible rerun passed. The editor JSON tests now wait for exact asynchronous restore completion before asserting.
- Only test-owned Playwright browser processes with fresh temporary profiles were launched and closed. Process IDs, profile paths, and normal exits are recorded in `../evidence/`; no existing Chrome tab, browser process, Illustrator work, or user document was operated on.
- Mac reports/screenshots are in `../evidence/mac-editor/`, `../evidence/mac-regression/`, and `../evidence/feedback-local-verified/`, outside deployable files.
