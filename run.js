const net = require('net');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, exec } = require('child_process');

const { loadSettings } = require('./server/config');
const { startServer } = require('./server/index');

function findAvailablePort(preferredPort, maxTries = 10) {
  return new Promise((resolve) => {
    let offset = 0;

    function tryNext() {
      if (offset >= maxTries) {
        return resolve(null);
      }
      const port = preferredPort + offset;
      const tester = net.createServer();

      tester.once('error', (err) => {
        if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
          offset++;
          tryNext();
        } else {
          offset++;
          tryNext();
        }
      });

      tester.once('listening', () => {
        tester.close(() => {
          resolve(port);
        });
      });

      tester.listen(port, '127.0.0.1');
    }

    tryNext();
  });
}

function findEdgeBinary() {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    // Fallback candidates: Chrome
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ];

  for (const p of candidates) {
    if (p && fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

async function main() {
  const settings = loadSettings();
  const preferredPort = settings.port || 8765;

  const port = await findAvailablePort(preferredPort);
  if (!port) {
    console.error(`[SoundScope] ERROR: Could not find an available port near ${preferredPort}.`);
    process.exit(1);
  }

  if (port !== preferredPort) {
    console.log(`[SoundScope] Port ${preferredPort} is busy, using port ${port} instead.`);
  }

  console.log("=".repeat(60));
  console.log("  SoundScope — Lightweight Native Desktop App (Node.js)");
  console.log(`  Starting server on: http://127.0.0.1:${port}`);
  console.log("=".repeat(60));

  const { server } = await startServer(port);

  const url = `http://127.0.0.1:${port}`;
  const browserExe = findEdgeBinary();

  if (browserExe) {
    // Isolated user data directory for native app mode
    const userDataDir = path.join(os.tmpdir(), 'soundscope-app-profile');
    const args = [
      `--app=${url}`,
      `--window-size=1200,800`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-mode'
    ];

    console.log(`[SoundScope] Launching native window via ${path.basename(browserExe)}...`);
    const appProcess = spawn(browserExe, args, {
      detached: false,
      stdio: 'ignore'
    });

    appProcess.on('close', (code) => {
      console.log("\n[SoundScope] Desktop window closed. Shutting down...");
      server.close(() => {
        process.exit(0);
      });
      setTimeout(() => process.exit(0), 1000);
    });

    appProcess.on('error', (err) => {
      console.error("[SoundScope] Failed to launch window:", err.message);
      // Fallback: open default browser
      openDefaultBrowser(url);
    });
  } else {
    // Fallback: open default browser
    openDefaultBrowser(url);
  }

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log("\n[SoundScope] Exiting...");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000);
  });
}

function openDefaultBrowser(url) {
  console.log(`[SoundScope] Opening default browser at ${url}...`);
  if (process.platform === 'win32') {
    exec(`start "" "${url}"`);
  } else if (process.platform === 'darwin') {
    exec(`open "${url}"`);
  } else {
    exec(`xdg-open "${url}"`);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error("[SoundScope] Startup error:", err);
    process.exit(1);
  });
}

module.exports = { main, findAvailablePort };
