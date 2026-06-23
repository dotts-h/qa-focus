# OpenFin fixture — live-verify (#0002, #0024)

OpenFin's runtime is **Windows/macOS only — no Linux** (verified), so this is run by hand on the
Mac mini or a Windows VM, not on the Linux CI box. The *mechanism* (connectOverCDP + window-as-Page
+ multi-window selection) is proven deterministically against chromium-over-CDP in
`tests/openfin-cdp.spec.ts`; this fixture is for the real-RVM signal.

**No license key needed for this.** OpenFin (now "Here"/io.Connect) offers a free Community/Developer
license; the manifest `licenseKey` field and a commercial license are *production-deployment*
concerns — running your own `app.json` locally just needs the free `openfin-cli` (public npm).

**Apple-Silicon gotchas (verified 2026-06-24 on the M4 Mac mini):** the macOS OpenFin RVM binary is
**x86_64**, so the runtime spawn fails with `Unknown system error -86` (EBADARCH) until **Rosetta 2**
is installed (`softwareupdate --install-rosetta --agree-to-license`). Launching the RVM over SSH also
needs the active GUI/Aqua session: `sudo launchctl asuser <console-uid> sudo -u <user> openfin -l -c …`
(a plain SSH spawn dies with "Could not switch to audit session: Operation not permitted").
Live-verified end-to-end on the mini: OpenFin runtime 44.146.101.4, all `live-openfin` tests green.

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
