// Minimal Electron main process for the desktop-surface live-verify. Loads a static
// window with accessible role+name elements so the in-process locator gate can grade
// them exactly as it does on web (Electron windows are Playwright Pages). Launched by
// the provider via _electron.launch({ args:[main.js] }) — see tests/live-electron.spec.ts.
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

function createWindow() {
  const win = new BrowserWindow({ width: 640, height: 480 });
  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
