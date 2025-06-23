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
  return new Promise(async (resolve, reject) => {
    try {
      // アプリケーションがパッケージングされているかチェック
      const isPackaged = app.isPackaged;
      const basePath = isPackaged
        ? path.join(process.resourcesPath, "app.asar.unpacked")
        : path.join(__dirname, "..");

      // パッケージされたアプリの場合は、spawnを使用
      runCommandSpawn(command, options, basePath, isPackaged).then(resolve).catch(reject);
    } catch (err) {
      reject({ 
        success: false, 
        error: err.message,
        details: { command, error: err }
      });
    }
  });
}

function runCommandSpawn(command, options, basePath, isPackaged) {
  return new Promise((resolve, reject) => {
    const args = [path.join(basePath, "dist/index.js"), command];

    // オプションを引数に変換
    if (options.since) args.push("--since", options.since);
    if (options.until) args.push("--until", options.until);
    if (options.json) args.push("--json");
    if (options.breakdown) args.push("--breakdown");
    if (options.active) args.push("--active");

    // 環境変数を保持（特にHOMEディレクトリ）
    const env = { ...process.env };
    
    // パッケージされたアプリでもnodeを使用
    const nodePath = process.execPath;
    const isElectron = nodePath.includes("Electron");
    
    const child = spawn(isElectron ? "node" : nodePath, args, {
      cwd: isPackaged ? process.resourcesPath : path.join(__dirname, ".."),
      stdio: "pipe",
      env: env,
      shell: true, // シェルを使用してnodeコマンドを探す
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
        console.error("Command failed:", command);
        console.error("Exit code:", code);
        console.error("stderr:", stderr);
        console.error("stdout:", stdout);
        reject({ 
          success: false, 
          error: stderr || stdout || `Command failed with exit code ${code}`,
          details: {
            command,
            code,
            stderr,
            stdout,
            cwd: isPackaged ? process.resourcesPath : path.join(__dirname, ".."),
            args
          }
        });
      }
    });
    
    child.on("error", (err) => {
      console.error("Failed to start process:", err);
      reject({ 
        success: false, 
        error: err.message,
        details: {
          command,
          error: err,
          cwd: isPackaged ? process.resourcesPath : path.join(__dirname, ".."),
          args
        }
      });
    });
  });
}