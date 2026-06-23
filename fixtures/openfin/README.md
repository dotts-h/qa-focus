# OpenFin fixture — live-verify (#0002)

OpenFin's runtime is **Windows/macOS only — no Linux** (verified), so this is run by hand on the
Mac mini or a Windows VM, not on the Linux CI box. The *mechanism* (connectOverCDP + window-as-Page
+ multi-window selection) is proven deterministically against chromium-over-CDP in
`tests/openfin-cdp.spec.ts`; this fixture is for the real-RVM signal.

## Run it

```bash
# 1. serve the fixture page the manifest points at
cd fixtures/openfin && python3 -m http.server 5555 &

# 2. launch the OpenFin RVM with the manifest (it sets --remote-debugging-port=9222)
openfin-cli --launch --config fixtures/openfin/app.json     # or: fin://… deep link

# 3. run the opt-in live test against the RVM's CDP endpoint
OPENFIN_LIVE=1 OPENFIN_CDP=http://localhost:9222 npx playwright test live-openfin
```

`app.json` carries `runtime.arguments: "--remote-debugging-port=9222"` so the provider's
`connectOverCDP` can attach; the page exposes an accessible `heading "Todo"` for the gate to grade.
