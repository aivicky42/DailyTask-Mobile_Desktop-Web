const { app, BrowserWindow, shell } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DEV_URL = process.env.ELECTRON_START_URL || 'http://localhost:5173';

const MIME = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

let mainWindow = null;
let staticServer = null;

function getWebDistDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'web-dist');
  }
  return path.join(__dirname, '..', 'web', 'dist');
}

function createStaticServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url || '/', 'http://127.0.0.1');
        let pathname = decodeURIComponent(url.pathname);
        if (pathname === '/') pathname = '/index.html';

        const candidate = path.normalize(path.join(rootDir, pathname));
        if (!candidate.startsWith(rootDir)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

        const sendFile = (filePath) => {
          fs.readFile(filePath, (err, data) => {
            if (err) {
              // SPA fallback for client-side routes
              fs.readFile(path.join(rootDir, 'index.html'), (fallbackErr, html) => {
                if (fallbackErr) {
                  res.writeHead(404);
                  res.end('Not found');
                  return;
                }
                res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
                res.end(html);
              });
              return;
            }
            res.writeHead(200, {
              'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
            });
            res.end(data);
          });
        };

        sendFile(candidate);
      } catch {
        res.writeHead(500);
        res.end('Server error');
      }
    });

    server.listen(0, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}

async function waitForUrl(url, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          res.resume();
          resolve(undefined);
        });
        req.on('error', reject);
        req.setTimeout(1000, () => {
          req.destroy(new Error('timeout'));
        });
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`Timed out waiting for ${url}. Start the web app first (npm run web).`);
}

async function resolveStartUrl() {
  const useDevServer = !app.isPackaged && process.env.ELECTRON_PROD !== '1';
  if (useDevServer) {
    await waitForUrl(DEV_URL);
    return DEV_URL;
  }

  const distDir = getWebDistDir();
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    throw new Error(
      `Web build not found at ${distDir}. Run: npm run build --workspace=@dailytask/web`,
    );
  }

  staticServer = await createStaticServer(distDir);
  const { port } = staticServer.address();
  return `http://127.0.0.1:${port}`;
}

async function createWindow() {
  const startUrl = await resolveStartUrl();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: 'DailyTask',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  await mainWindow.loadURL(startUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    await createWindow();
  } catch (error) {
    console.error(error);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch((error) => {
        console.error(error);
        app.quit();
      });
    }
  });
});

app.on('window-all-closed', () => {
  if (staticServer) {
    staticServer.close();
    staticServer = null;
  }
  if (process.platform !== 'darwin') app.quit();
});
