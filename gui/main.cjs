const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
    titleBarStyle: "hiddenInset", // macOS style
    icon: app.isPackaged
      ? path.join(process.resourcesPath, "app.asar", "docs/public/logo.png")
      : path.join(__dirname, "../docs/public/logo.png"),
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));

  // 開発モードでは DevTools を開く
  if (process.argv.includes("--dev")) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers for CLI commands
ipcMain.handle("run-daily", async (event, options = {}) => {
  return runCommand("daily", options);
});

ipcMain.handle("run-monthly", async (event, options = {}) => {
  return runCommand("monthly", options);
});

ipcMain.handle("run-session", async (event, options = {}) => {
  return runCommand("session", options);
});

ipcMain.handle("run-blocks", async (event, options = {}) => {
  return runCommand("blocks", options);
});

ipcMain.handle("run-blocks-live", async (event, options = {}) => {
  return runCommand("blocks", { ...options, active: true });
});

function runCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    // アプリケーションがパッケージングされているかチェック
    const isPackaged = app.isPackaged;
    const basePath = isPackaged
      ? path.join(process.resourcesPath, "app.asar")
      : path.join(__dirname, "..");

    const args = [path.join(basePath, "dist/index.js"), command];

    // オプションを引数に変換
    if (options.since) args.push("--since", options.since);
    if (options.until) args.push("--until", options.until);
    if (options.json) args.push("--json");
    if (options.breakdown) args.push("--breakdown");
    if (options.active) args.push("--active");

    const child = spawn("node", args, {
      cwd: isPackaged ? process.resourcesPath : path.join(__dirname, ".."),
      stdio: "pipe",
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true, output: stdout });
      } else {
        reject({ success: false, error: stderr || stdout });
      }
    });

    child.on("error", (error) => {
      reject({ success: false, error: error.message });
    });
  });
}
