const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

console.log("=== CCUsage GUI Enhanced starting ===");
console.log("App version:", app.getVersion());
console.log("Is packaged:", app.isPackaged);
console.log("Resources path:", process.resourcesPath);
console.log("Current working directory:", process.cwd());

let mainWindow;

function createWindow() {
  console.log("Creating main window...");
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
      ? path.join(process.resourcesPath, "app.asar.unpacked", "docs/public/logo.png")
      : path.join(__dirname, "../docs/public/logo.png"),
  });

  const htmlPath = path.join(__dirname, "index.html");
  console.log("Loading HTML file:", htmlPath);
  mainWindow.loadFile(htmlPath);

  // 開発モードでは DevTools を開く
  if (process.argv.includes("--dev")) {
    mainWindow.webContents.openDevTools();
  }
  
  // パッケージ化されたアプリでもF12で開発者ツールを開けるように
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) {
      mainWindow.webContents.openDevTools();
    }
  });
}

app.whenReady().then(() => {
  console.log("App is ready, creating window...");
  createWindow();
});

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
  console.log("IPC: run-daily called with options:", options);
  try {
    const result = await runCommand("daily", options);
    console.log("IPC: run-daily result:", result);
    return result;
  } catch (error) {
    console.error("IPC: run-daily error:", error);
    return {
      success: false,
      error: error.message || "Unknown error",
      details: error
    };
  }
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
    
    // nodeコマンドを見つける
    let nodeCommand;
    try {
      // 一般的なnodeのパスを試す
      const commonNodePaths = [
        '/usr/local/bin/node',
        '/opt/homebrew/bin/node',
        '/usr/bin/node',
        process.env.HOME + '/.nodenv/shims/node',
        process.env.HOME + '/.nvm/versions/node/*/bin/node'
      ];
      
      const fs = require('fs');
      nodeCommand = 'node'; // デフォルトはシステムPATHから探す
      
      // パッケージ化されたアプリの場合、明示的なパスを試す
      if (isPackaged) {
        for (const nodePath of commonNodePaths) {
          try {
            if (fs.existsSync(nodePath)) {
              nodeCommand = nodePath;
              break;
            }
          } catch (e) {
            // パスチェックでエラーが発生した場合は無視
          }
        }
      }
    } catch (e) {
      console.error("Error finding node:", e);
      nodeCommand = 'node';
    }
    
    const workingDir = isPackaged 
      ? path.join(process.resourcesPath, "app.asar.unpacked")
      : path.join(__dirname, "..");
    
    console.log("Using node command:", nodeCommand);
    console.log("Command args:", args);
    console.log("CWD:", workingDir);
    console.log("Is packaged:", isPackaged);
    
    const child = spawn(nodeCommand, args, {
      cwd: workingDir,
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
            cwd: workingDir,
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
          cwd: workingDir,
          args
        }
      });
    });
  });
}