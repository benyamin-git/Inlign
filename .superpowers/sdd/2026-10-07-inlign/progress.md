# SDD ledger — plan: docs/superpowers/plans/2026-10-07-inlign.md

Pre-flight scan (shared interfaces):
- T5↔T6: T5 consumes src/engine/cas/types.ts before T6 produces it.
  Ruling: T5 creates the pure interface file (types + CasParseError); T6 adds the Nerdamer implementation. Reason: classifyLine's contract needs the adapter type; stub adapter used in T5 tests. Cost if wrong: types move between commits, no code change.
- T3↔T10: Settings.theme referenced as ThemeId in T10, ThemeChoice in T3.
  Ruling: single canonical type ThemeChoice from src/theme/theme.ts; Settings imports it. Cost if wrong: one type alias rename.
- Other shared interfaces (engine types T9→T14→T15, Settings seeded T10→T12, dataActions T17→T21): consistent on inspection; no rows.
- Plan heading format fix (T1→Task 1) for task-brief extraction; content unchanged (ruling before Task 1).
- T1 toolchain ruling (environment): this machine is Android/Termux; the dynamic linker refuses all native .node addons from app data, so Vite 8's Rolldown and Tailwind's Oxide/Lightning CSS cannot use their native bindings. Mitigation (Vite/Vitest versions unchanged): WASI fallbacks @rolldown/binding-wasm32-wasi@1.2.12 and @tailwindcss/oxide-wasm32-wasi@4.3.3, npm override lightningcss -> npm:lightningcss-wasm@1.32.0, and scripts/env.mjs setting NAPI_RS_FORCE_WASI=true + NAPI_RS_ASYNC_WORK_POOL_SIZE=1 on android only. Cost if wrong: remove the two deps, the override and the wrapper; scripts revert to direct binaries.
- T1 toolchain follow-up: npm refuses cpu:wasm32 optional packages on android (oxide-wasm32-wasi) and ignores the lightningcss override against the existing lock, so scripts/wasm-fallbacks.mjs (postinstall) fetch+unpacks @tailwindcss/oxide-wasm32-wasi and lightningcss-wasm into node_modules and shims node_modules/lightningcss onto the wasm build. All Android-only; no-ops elsewhere. The npm "overrides" entry for lightningcss stays for fresh installs.
Task 1: complete (commits cc9e67d..ba43b2b, tests: npm test →  Duration  5.46s (environment 70%, setup 17%, transform 9%, import 2%, tests 1%, worker 1%)) [ledger line written manually: task-done stalled in a device-wide command hang after the test had passed]
Task 2: complete (commits ba43b2b..0b3cad0, tests: npm run format:check → All matched files use Prettier code style!) [ledger line written manually: task-done stalled at exit again]
Task 3: complete (commits 0b3cad0..076d79d, tests: npm test → Test Files 5 passed (5), Tests 26 passed (26)) [ledger line written manually: task-done stalled at exit again]
Task 4: complete (commits 076d79d..43c02ea, tests: npm test → Test Files 15 passed (15), Tests 62 passed (62)) [ledger line written manually: task-done cancelled by an opencode server restart; full suite + typecheck/lint/build/format ladder all exit 0]
Standing process ruling (2026-10-08): task-done is no longer run on this device. It reliably hangs at exit after its test passes (vitest/npm do not exit cleanly on the WASI fallback runtime), burning up to 7 min per task. Completion lines are written manually with the evidence from the actual gate run. Also: gate timeout lowered to 240s, retry cap 2.
Task 5: Ruling: Statement.node is the implicit form lhs - (rhs) for claim/definition/equation, the bare expression for expression — matches the T6 solveFor contract ("roots of lhs - rhs") and gives T7 one uniform path — cost if wrong: T7/T8 adjust node construction, one-line change.
Task 5: Ruling: classifyLine catches CasParseError → prose, all other errors propagate — parse problems quiet per D12, adapter defects stay loud in development; T9's worker boundary contains them — cost if wrong: adapter bugs render as silent prose.
Task 5: Ruling: full-suite gate timeout raised to 600s (scoped runs stay 240s) — the suite now takes ~280s on this device, dominated by jsdom environment setup (169s) — cost if wrong: slower failure detection in CI-equivalent runs.
Task 5: complete (commits 43c02ea..2c21d81, tests: node scripts/env.mjs vitest run --maxWorkers=1 --no-file-parallelism → Test Files 16 passed (16), Tests 81 passed (81)) [ledger line written manually: task-done retired by standing ruling; typecheck/lint/build/format all exit 0]
Task 6: Ruling: adapter factory is createCasAdapter(angleMode = 'radians') in src/engine/cas/nerdamer.ts (T9 consumer). Cost if wrong: one rename.
Task 6: Ruling: the brief's 'nerdamer/solve' 1.x idiom does not exist in Nerdamer 2.0 — solving is Expression.solveFor (SolutionSet.toArray) and nerdamer.solveSystem (Vector of Dictionaries); no subpath import. Cost if wrong: adapter internals only.
Task 6: Ruling: parse accepts only Expression entities and wraps every throw as CasParseError (equations, vectors, tuple collections, division-by-zero all classify as prose). Cost if wrong: inputs that could parse as excluded v1 structures stay prose.
Task 6: Ruling: degrees mode wraps trig calls in the input before parse, not before evaluate — Nerdamer collapses inverse trig at parse (asin(0.5) → π/6) so evaluation-time wrapping cannot recover it; canonical text shows wrappers in degrees mode. Cost if wrong: cosmetic toString wart; swap point is one function.
Task 6: Environment note: vitest startup deadlocked repeatedly on this device (WASI rolldown worker, no RUN banner, system otherwise idle); identical runs pass on retry — no code cause identified. Backgrounding the run did not change the outcome.
Task 6: complete (commits 2c21d81..f1fca54, tests: node scripts/env.mjs vitest run cas → 29/29; full suite node scripts/env.mjs vitest run → Test Files 17 passed (17), Tests 110 passed (110); typecheck/lint/build/format all exit 0)

Task 7: Ruling: duplicates compare exact trimmed RHS text; first definition (else first claim) is the model; a claim sharing a symbol with a definition is never flagged as duplicate (claim checking owns it, T8); flagged later statements are excluded from resolution by line. Cost if wrong: swap text equality for a CAS-normalized comparison in buildSystem.
Task 7: Ruling: multi-valued (`multiple`) symbols do not propagate into dependents; dependents stay symbolic rather than guessing a branch. Cost if wrong: branch enumeration in a later task.
Task 7: Ruling: coupled solving clusters unresolved statements into connected components over shared unknowns and calls solveSystem per component; a failed component leaves its symbols symbolic. Cost if wrong: clustering internals only.
Task 7: Ruling: resolveSystem keeps the planned settings parameter but reads it only as a placeholder; angle mode is carried by the adapter and precision/tolerance first matter in T8. Cost if wrong: one-line removal or a real use.
Task 7: Ruling: symbolic text is the substituted RHS for bound symbols; for equation/expression unknowns it is the substituted implicit node of the first mentioning statement. Cost if wrong: T8 owns display formatting anyway.
Task 7: complete (commits 4bdd02f..09de471, tests: npm test → Test Files 18 passed (18), Tests 124 passed (124); typecheck/lint/build/format all exit 0)

Task 8: Ruling: conflicts format expected (and the fix insert) with two decimal places more than the claim wrote, so the mismatch is visible and the inserted fix re-checks clean — matches the spec mock and T15 manual (`t = 2.1` → `2.019`); results use settings.precision (D17). Cost if wrong: one formatExpected call site.
Task 8: Ruling: buildAnnotations takes cas (the plan signature omitted it) for expression results, constant-equation checks and substituted unresolved text. Cost if wrong: parameter reshuffle.
Task 8: Ruling: annotation.text is a display payload only (formatted value, solution list or symbolic text); the UI composes words around it via i18n. Claims show the model value as their result; equations prefix the unknown (`x = 2 or -2`). Cost if wrong: UI strips the prefix; one string change.
Task 8: Ruling: constant equations emit nothing when satisfied and an error (empty text) when contradicted; unsolvable equations are errors; unresolved/unsolvable claims and definitions are unresolved (empty text when no symbolic form). Cost if wrong: kind remap in annotate.ts.
Task 8: Ruling: unresolved symbolic text uses CAS canonical form (`1+x`), consistent with T7 equation text, not the written text. Cost if wrong: swap to statement.text for fully unsubstituted expressions.
Task 8: complete (commits 09de471..b5e959c, tests: npm test → Test Files 19 passed (19), Tests 145 passed (145); typecheck/lint/build/format all exit 0)

## Device handoff (2026-10-08)

Ruling: the workspace is force-added to git (files below .superpowers/sdd/2026-10-07-inlign/), because the user asked for a cross-device resume and the ledger is the record; the skill's default is git-ignored scratch. Cost if wrong: scratch files in history; removed with the workspace at plan end. Future task commits should include `git add -f .superpowers/sdd/2026-10-07-inlign` so briefs and ledger travel with the push.

Resume state at handoff:
- Complete: T1–T6, HEAD f1fca54. Full suite green: 17 files / 110 tests; typecheck/lint/build/format green.
- T7 brief generated (base f1fca54, file task-7-brief.md). T7 NOT started: `src/engine/constraints.ts`, `src/engine/resolve.ts`, `src/engine/resolve.test.ts` do not exist yet.
- Next move: write resolve.test.ts first (RED), then constraints.ts + resolve.ts, per task-7-brief.md. Golden cases named in the brief: forward/backward references any order, spec's ball-drop example, quadratic multiple roots, cyclic well-posed pair (coupled system), nonlinear transcendental, unsolvable, duplicate exclusion. Then the usual gates and a single commit `feat(engine): resolve documents as constraint systems`.

T7 design notes (decided during planning, not yet implemented or ledgered as rulings):
- Statement.node is the implicit form lhs - (rhs) for claim/definition/equation (T5 ruling); cas.solveFor(node, symbol) returns roots of node = 0.
- A claim seeds a value only when it is the symbol's authoritative statement; when a definition (non-constant RHS) exists for the same symbol, the definition is the model and the claim is checked against it in T8 (order-independent).
- Duplicates (A3/D14): same symbol, first statement authoritative; different RHS → later statements excluded from resolution scope and flagged as `error` annotations (expected/fix from the first RHS); identical RHS deduped silently.
- Algorithm order per brief: seed claims → substitution propagation to fixpoint → single-unknown equations via solveFor (single numeric root → resolved; several real roots → `multiple`; no numeric root → `unsolvable`) → coupled equations via solveSystem → leftovers stay `symbolic` with substituted text, never guess.
- ResolvedSymbol statuses: `resolved` {value}, `multiple` {values}, `symbolic` {symbolic}, `unsolvable`.

Environment caveats (Android/Termux device used for T1–T6):
- task-done retired; completion lines written manually from real gate runs (standing ruling above).
- Gate timeouts: 600s full suite, 240–300s scoped runs; retry on stalls. Device-wide freezes hit vitest startup intermittently (no RUN banner, system otherwise idle, identical run passes on retry) — not a code cause.
- Preferred commands: `node scripts/env.mjs vitest run [filter] --maxWorkers=1 --no-file-parallelism`; `npm run typecheck|lint|build|format`.
- npm installs: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --prefer-offline ...` (update-notifier disabled in .npmrc). WASI fallbacks in scripts/env.mjs + scripts/wasm-fallbacks.mjs are no-ops off Android.
- Do not push tags: tag pushes deploy the PWA (release happens at T24). Plain `git push` of the branch is safe.

Device note (2026-10-08, Windows/x64):
- Node 24.20.0, npm 11.19.0; the WASI fallbacks and their scripts are no-ops here.
- Full suite ~3s warm, no stalls; the Android gate timeouts above are not needed on this machine.
- Playwright browsers are not downloaded yet: run `npx playwright install` before T19.
