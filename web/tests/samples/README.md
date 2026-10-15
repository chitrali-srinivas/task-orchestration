# Samples verification suites

Checks for `/layouts/samples` (mock backend) and a Deployment V2 regression pass. They drive the running app with
`puppeteer-core` (already a dev dependency) and a locally installed Google Chrome — nothing is downloaded.

| Suite | What it checks |
|---|---|
| `check-mock.mjs` | The mock API without a browser: CSV + demo provenance, one row per sample, counts, farmer detail across AZs, rules, report / boundary / approve mutations |
| `e2e.cjs` | The 26-point acceptance audit (A1–A26) and the demo-dataset scenarios |
| `e2e-edge.cjs` | Error / retry, view-only, `?mockNames=off`, boundary failures, CSV rows, 390 px, **Deployment V2 regression** |
| `fixes5.cjs` | The five card corrections (history on the card, no verification rows, Picture — View, header thumbnail, report reason) |
| `inspector.cjs` | The Data / API Inspector: sections, diagrams, collapsed details, labels, width, no overflow from 820 to 2557 px |

## Run

From `mati-demo/`, with the app running (`npm run dev`, default http://localhost:3000):

```bash
# mock API (no browser): compile it, then run
npx tsc --outDir tests/samples/out --rootDir src/app/layouts/samples --module commonjs --target es2022 --strict \
  --skipLibCheck --resolveJsonModule --esModuleInterop src/app/layouts/samples/data/mock/mock-samples-api.ts
echo '{"type":"commonjs"}' > tests/samples/out/package.json
node tests/samples/check-mock.mjs

# browser suites (each prints PASS / FAIL lines and exits non-zero on a failure)
node tests/samples/e2e.cjs
node tests/samples/e2e-edge.cjs
node tests/samples/fixes5.cjs
node tests/samples/inspector.cjs
```

Settings: `BASE` (app URL, default `http://127.0.0.1:3000`), `CHROME_PATH` (Chrome binary; defaults per OS),
`PROFILE` (scratch profile name — use different names to run suites in parallel). Screenshots land in
`tests/samples/shots/`. Don't run the suites while `npm run build` is running (page loads time out).

The map checks need `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env.local`, as the app does.
