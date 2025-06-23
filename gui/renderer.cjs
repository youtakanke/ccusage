const { ipcRenderer } = require("electron");

// View configurations
const viewConfigs = {
  daily: {
    title: "日次レポート",
    description: "Claude Codeの日次トークン使用量とコストを表示します",
    command: "run-daily",
  },
  monthly: {
    title: "月次レポート",
    description: "月次集計レポートを表示します",
    command: "run-monthly",
  },
  session: {
    title: "セッション別レポート",
    description: "会話セッション別の使用量を表示します",
    command: "run-session",
  },
  blocks: {
    title: "ブロック別レポート",
    description: "5時間の請求ウィンドウ別の使用量を表示します",
    command: "run-blocks",
  },
  live: {
    title: "ライブモニタリング",
    description: "リアルタイム使用量ダッシュボード",
    command: "run-blocks-live",
  },
};

let currentView = "daily";
let isRunning = false;
let liveInterval = null;
let currentZoom = 100;

// DOM elements
const navButtons = document.querySelectorAll(".nav-button");
const viewTitle = document.getElementById("view-title");
const viewDescription = document.getElementById("view-description");
const runButton = document.getElementById("run-command");
const outputPanel = document.getElementById("output");
const sinceDate = document.getElementById("since-date");
const untilDate = document.getElementById("until-date");
const jsonOutput = document.getElementById("json-output");
const breakdown = document.getElementById("breakdown");

// Zoom controls
let zoomInBtn, zoomOutBtn, zoomResetBtn, zoomLevelSpan;

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  setupZoomControls();
  updateView("daily");
});

function setupEventListeners() {
  // Navigation buttons
  navButtons.forEach((button) => {
    button.addEventListener("click", (e) => {
      const view = e.currentTarget.dataset.view;
      updateView(view);
    });
  });

  // Run button
  runButton.addEventListener("click", runCurrentCommand);

  // Enter key in input fields
  [sinceDate, untilDate].forEach((input) => {
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        runCurrentCommand();
      }
    });
  });
}

function updateView(view) {
  if (isRunning) return;

  currentView = view;
  const config = viewConfigs[view];

  // Update navigation
  navButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });

  // Update header
  viewTitle.textContent = config.title;
  viewDescription.textContent = config.description;

  // Update button text and behavior
  if (view === "live") {
    runButton.textContent = "ライブ開始";
    outputPanel.innerHTML =
      "<pre>ライブモニタリングを開始するには「ライブ開始」ボタンを押してください</pre>";
  } else {
    runButton.textContent = "実行";
    outputPanel.innerHTML = "<pre>出力がここに表示されます...</pre>";
  }

  // Clear any running live monitoring
  if (liveInterval) {
    clearInterval(liveInterval);
    liveInterval = null;
  }
}

async function runCurrentCommand() {
  if (isRunning) {
    // Stop live monitoring
    if (currentView === "live" && liveInterval) {
      stopLiveMonitoring();
      return;
    }
    return;
  }

  const config = viewConfigs[currentView];
  const options = getOptions();

  if (currentView === "live") {
    startLiveMonitoring();
    return;
  }

  setRunning(true);
  showLoading();

  try {
    const result = await ipcRenderer.invoke(config.command, options);
    displayOutput(result.output);
  } catch (error) {
    displayError(error.error || error.message);
  } finally {
    setRunning(false);
  }
}

function startLiveMonitoring() {
  setRunning(true);
  runButton.textContent = "停止";

  const runLiveCommand = async () => {
    try {
      const options = getOptions();
      const result = await ipcRenderer.invoke("run-blocks-live", options);
      displayOutput(result.output, true);
    } catch (error) {
      displayError(error.error || error.message);
    }
  };

  // Initial run
  runLiveCommand();

  // Set up interval for live updates
  liveInterval = setInterval(runLiveCommand, 5000); // Update every 5 seconds

  displayOutput("🔴 ライブモニタリング開始\n", true);
}

function stopLiveMonitoring() {
  if (liveInterval) {
    clearInterval(liveInterval);
    liveInterval = null;
  }

  setRunning(false);
  runButton.textContent = "ライブ開始";

  const currentOutput = outputPanel.querySelector("pre").textContent;
  displayOutput(currentOutput + "\n⏹️ ライブモニタリング停止");
}

function getOptions() {
  const options = {};

  if (sinceDate.value.trim()) {
    options.since = sinceDate.value.trim();
  }

  if (untilDate.value.trim()) {
    options.until = untilDate.value.trim();
  }

  if (jsonOutput.checked) {
    options.json = true;
  }

  if (breakdown.checked) {
    options.breakdown = true;
  }

  return options;
}

function setRunning(running) {
  isRunning = running;
  runButton.disabled = running && currentView !== "live";

  if (running && currentView !== "live") {
    runButton.innerHTML = '<div class="spinner"></div> 実行中...';
  } else if (currentView === "live") {
    // Button text is handled in live monitoring functions
  } else {
    runButton.textContent = "実行";
  }
}

function showLoading() {
  outputPanel.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <span>処理中...</span>
        </div>
    `;
}

// Strip ANSI escape codes from text
function stripAnsi(text) {
  // Remove all ANSI escape sequences
  // This comprehensive regex handles:
  // - Color codes: \u001b[0m, \u001b[31m, etc.
  // - Cursor movement: \u001b[2J, \u001b[H, etc.
  // - Other control sequences
  // eslint-disable-next-line no-control-regex
  return text
    .replace(/\u001b\[[^m]*m/g, "") // Color codes
    .replace(/\u001b\[[0-9;]*[A-Za-z]/g, "") // Cursor movement and other commands
    .replace(/\u001b\[[0-9]*[GKJ]/g, "") // Clear line/screen commands
    .replace(/\u001b\[[0-9;]*[Hf]/g, "") // Cursor positioning
    .replace(/\u001b[()][B0UK]/g, "") // Character set selection
    .replace(/\u001b[>=78]/g, "") // Various other sequences
    .replace(/\u001b\[[?][0-9;]*[hl]/g, "") // Private mode sequences
    .replace(/\u001b\[[0-9;]*m/g, ""); // Any remaining color codes
}

// Convert markdown table to HTML table
function convertMarkdownTableToHtml(text) {
  const lines = text.split("\n");
  let inTable = false;
  let tableLines = [];
  let result = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this line looks like a markdown table row
    // More flexible detection: at least 2 pipes and some content
    if (line.includes("|")) {
      const parts = line.split("|");
      const nonEmptyParts = parts.filter((part) => part.trim().length > 0);

      if (nonEmptyParts.length >= 2) {
        if (!inTable) {
          inTable = true;
          tableLines = [];
        }
        tableLines.push(line);
      } else if (inTable) {
        // End of table, convert accumulated lines
        if (tableLines.length > 0) {
          result.push(convertTableLinesToHtml(tableLines));
          tableLines = [];
        }
        inTable = false;
        result.push(line);
      } else {
        result.push(line);
      }
    } else if (inTable) {
      // End of table, convert accumulated lines
      if (tableLines.length > 0) {
        result.push(convertTableLinesToHtml(tableLines));
        tableLines = [];
      }
      inTable = false;
      result.push(line);
    } else {
      result.push(line);
    }
  }

  // Handle table at end of text
  if (inTable && tableLines.length > 0) {
    result.push(convertTableLinesToHtml(tableLines));
  }

  return result.join("\n");
}

function convertTableLinesToHtml(tableLines) {
  if (tableLines.length < 1) return tableLines.join("\n");

  console.log("Converting table lines:", tableLines);

  // Process all lines as potential table rows
  let html = '<table class="markdown-table">\n';
  let hasHeader = false;

  tableLines.forEach((line, index) => {
    const cells = line
      .split("|")
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);

    // Skip separator lines (contains only -, :, |, and spaces)
    if (/^[\|\-\:\s]+$/.test(line)) {
      return;
    }

    if (cells.length > 0) {
      // First non-separator line is header
      if (!hasHeader) {
        html += "  <thead>\n    <tr>\n";
        cells.forEach((cell) => {
          html += `      <th>${escapeHtml(cell)}</th>\n`;
        });
        html += "    </tr>\n  </thead>\n  <tbody>\n";
        hasHeader = true;
      } else {
        // Data rows
        html += "    <tr>\n";
        cells.forEach((cell) => {
          html += `      <td>${escapeHtml(cell)}</td>\n`;
        });
        html += "    </tr>\n";
      }
    }
  });

  if (hasHeader) {
    html += "  </tbody>\n";
  }
  html += "</table>";

  console.log("Generated HTML:", html);
  return html;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function displayOutput(output, isLive = false) {
  // Strip ANSI codes from output
  const cleanOutput = stripAnsi(output);

  const timestamp = new Date().toLocaleTimeString("ja-JP");
  const prefix = isLive ? `[${timestamp}] ` : "";

  const controlsHtml = `
    <div class="output-controls">
      <button class="zoom-btn" id="zoom-out" title="縮小">－</button>
      <span class="zoom-level" id="zoom-level">${currentZoom}%</span>
      <button class="zoom-btn" id="zoom-in" title="拡大">＋</button>
      <button class="zoom-btn" id="zoom-reset" title="リセット">⌂</button>
    </div>
  `;

  // Check if output contains markdown tables - more aggressive detection
  const lines = cleanOutput.split("\n");
  const hasMarkdownTable = lines.some((line) => {
    if (!line.includes("|")) return false;
    const parts = line.split("|");
    const nonEmptyParts = parts.filter((part) => part.trim().length > 0);
    return nonEmptyParts.length >= 2;
  });

  // Debug log
  console.log("Clean output first 300 chars:", cleanOutput.substring(0, 300));
  console.log("Has markdown table:", hasMarkdownTable);
  console.log(
    "Sample lines with |:",
    lines.filter((line) => line.includes("|")).slice(0, 3),
  );

  if (isLive && currentView === "live") {
    const existingContent = outputPanel.querySelector("pre")?.textContent || "";
    const fullContent = `${existingContent}${prefix}${cleanOutput}\n`;

    if (hasMarkdownTable) {
      const htmlContent = convertMarkdownTableToHtml(fullContent);
      console.log(
        "Setting HTML content for live:",
        htmlContent.substring(0, 200),
      );
      outputPanel.innerHTML = `${controlsHtml}<div class="output-content" style="font-size: ${currentZoom}%">${htmlContent}</div>`;
    } else {
      outputPanel.innerHTML = `${controlsHtml}<pre style="font-size: ${currentZoom}%">${fullContent}</pre>`;
    }
  } else {
    if (hasMarkdownTable) {
      const htmlContent = convertMarkdownTableToHtml(cleanOutput);
      console.log(
        "Setting HTML content for normal:",
        htmlContent.substring(0, 200),
      );
      outputPanel.innerHTML = `${controlsHtml}<div class="output-content" style="font-size: ${currentZoom}%">${htmlContent}</div>`;
    } else {
      console.log("No markdown table detected, using pre tag");
      outputPanel.innerHTML = `${controlsHtml}<pre style="font-size: ${currentZoom}%">${cleanOutput}</pre>`;
    }
  }

  setupZoomControls();

  // Auto scroll to bottom
  outputPanel.scrollTop = outputPanel.scrollHeight;
}

function displayError(error) {
  outputPanel.innerHTML = `
        <div class="output-controls">
            <button class="zoom-btn" id="zoom-out" title="縮小">－</button>
            <span class="zoom-level" id="zoom-level">${currentZoom}%</span>
            <button class="zoom-btn" id="zoom-in" title="拡大">＋</button>
            <button class="zoom-btn" id="zoom-reset" title="リセット">⌂</button>
        </div>
        <div class="error">
            <strong>エラーが発生しました:</strong><br>
            ${error}
        </div>
    `;
  setupZoomControls();
}

function setupZoomControls() {
  zoomInBtn = document.getElementById("zoom-in");
  zoomOutBtn = document.getElementById("zoom-out");
  zoomResetBtn = document.getElementById("zoom-reset");
  zoomLevelSpan = document.getElementById("zoom-level");

  if (zoomInBtn) {
    zoomInBtn.addEventListener("click", () => changeZoom(10));
  }
  if (zoomOutBtn) {
    zoomOutBtn.addEventListener("click", () => changeZoom(-10));
  }
  if (zoomResetBtn) {
    zoomResetBtn.addEventListener("click", () => resetZoom());
  }
}

function changeZoom(delta) {
  currentZoom = Math.max(50, Math.min(200, currentZoom + delta));
  updateZoomDisplay();
}

function resetZoom() {
  currentZoom = 100;
  updateZoomDisplay();
}

function updateZoomDisplay() {
  const preElement = outputPanel.querySelector("pre");
  const contentElement = outputPanel.querySelector(".output-content");

  if (preElement) {
    preElement.style.fontSize = `${currentZoom}%`;
  }
  if (contentElement) {
    contentElement.style.fontSize = `${currentZoom}%`;
  }
  if (zoomLevelSpan) {
    zoomLevelSpan.textContent = `${currentZoom}%`;
  }
}
