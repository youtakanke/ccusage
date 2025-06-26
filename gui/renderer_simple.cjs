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

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
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

  // Show/hide options panel based on view
  const optionsPanel = document.querySelector(".options-panel");
  if (view === "live") {
    // For live monitoring, hide all options except the run button
    const optionRows = optionsPanel.querySelectorAll(".option-row");
    const optionsTitle = optionsPanel.querySelector("h3");
    
    // Hide the "オプション" title
    if (optionsTitle) {
      optionsTitle.style.display = "none";
    }
    
    optionRows.forEach((row, index) => {
      if (index === optionRows.length - 1) {
        // Last row contains the run button - show only the button
        const checkboxGroup = row.querySelector(".checkbox-group");
        if (checkboxGroup) {
          checkboxGroup.style.display = "none";
        }
        // Center align the button row for live view
        row.style.alignItems = "center";
        row.style.marginBottom = "0";
      } else {
        // Hide all other option rows
        row.style.display = "none";
      }
    });
    
    // Reduce padding for live view
    optionsPanel.style.padding = "10px 20px";
    optionsPanel.style.marginBottom = "10px";
  } else {
    // For other views, show all options
    const optionRows = optionsPanel.querySelectorAll(".option-row");
    const optionsTitle = optionsPanel.querySelector("h3");
    
    // Show the "オプション" title
    if (optionsTitle) {
      optionsTitle.style.display = "block";
    }
    
    optionRows.forEach((row) => {
      row.style.display = "flex";
      row.style.alignItems = ""; // Reset alignment for other views
      row.style.marginBottom = ""; // Reset margin for other views
      const checkboxGroup = row.querySelector(".checkbox-group");
      if (checkboxGroup) {
        checkboxGroup.style.display = "flex";
      }
    });
    
    // Reset padding for other views
    optionsPanel.style.padding = "20px";
    optionsPanel.style.marginBottom = "20px";
  }

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
    console.log("Renderer: Calling IPC with command:", config.command, "options:", options);
    const result = await ipcRenderer.invoke(config.command, options);
    console.log("Renderer: IPC result:", result);
    
    if (result && result.success !== false) {
      displayOutput(result.output || result);
    } else {
      console.error("Renderer: Command failed:", result);
      displayError(result.error || "Command failed with unknown error");
    }
  } catch (error) {
    console.error("Renderer: IPC error:", error);
    displayError(`IPC Error: ${error.error || error.message || error}`);
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
    // Convert YYYY-MM-DD to YYYYMMDD format
    options.since = sinceDate.value.replace(/-/g, '');
  }

  if (untilDate.value.trim()) {
    // Convert YYYY-MM-DD to YYYYMMDD format
    options.until = untilDate.value.replace(/-/g, '');
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

// Convert ccusage ASCII table to HTML
function convertCcusageTableToHtml(text) {
  const lines = text.split("\n");
  let html = "";
  let inTable = false;
  let isHeaderProcessed = false;
  let tableLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this line is part of a table (contains │ or ┌┐└┘┼─)
    if (line.match(/[│┌┐└┘┼─├┤]/)) {
      if (!inTable) {
        inTable = true;
        tableLines = [];
      }
      tableLines.push(line);
    } else if (inTable && line.trim() === "") {
      // Empty line might be part of table formatting
      tableLines.push(line);
    } else {
      if (inTable) {
        // Process accumulated table lines
        html += processTableLines(tableLines);
        inTable = false;
        isHeaderProcessed = false;
        tableLines = [];
      }
      // Non-table line
      if (line.trim()) {
        html += escapeHtml(line) + "\n";
      } else {
        html += "\n";
      }
    }
  }

  // Process any remaining table lines
  if (inTable && tableLines.length > 0) {
    html += processTableLines(tableLines);
  }

  return html;
}

// Process table lines and convert to HTML table
function processTableLines(lines) {
  if (lines.length === 0) return "";

  // Find column positions by analyzing the border lines
  const borderLine = lines.find(line => line.includes('┌') || line.includes('├'));
  if (!borderLine) return "";

  // Extract column positions from border characters
  const columnPositions = [];
  for (let i = 0; i < borderLine.length; i++) {
    if (borderLine[i] === '┌' || borderLine[i] === '├' || borderLine[i] === '┼') {
      columnPositions.push(i);
    }
  }
  
  // Add end position
  const endPos = borderLine.lastIndexOf('┐') || borderLine.lastIndexOf('┤');
  if (endPos > 0) {
    columnPositions.push(endPos);
  }

  // Extract data rows
  const dataLines = lines.filter(line => 
    line.includes('│') && 
    !line.match(/^[┌┐└┘┼─├┤\s]*$/)
  );

  if (dataLines.length === 0) return "";

  const allRows = [];
  let currentRowGroup = [];

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    const cells = extractCellsFromLine(line, columnPositions);
    
    // Check if this line starts a new row group (first cell is not empty)
    if (cells[0].trim() !== "" && currentRowGroup.length > 0) {
      // Process current row group
      allRows.push(mergeRowGroup(currentRowGroup));
      currentRowGroup = [];
    }
    
    currentRowGroup.push(cells);
  }

  // Process last row group
  if (currentRowGroup.length > 0) {
    allRows.push(mergeRowGroup(currentRowGroup));
  }

  if (allRows.length === 0) return "";

  const headerRow = allRows[0];
  const dataRows = allRows.slice(1);

  let html = '<table class="ccusage-table">\n';
  
  // Header
  html += "  <thead>\n    <tr>\n";
  headerRow.forEach(cell => {
    html += `      <th>${escapeHtml(cell)}</th>\n`;
  });
  html += "    </tr>\n  </thead>\n";

  // Body
  if (dataRows.length > 0) {
    html += "  <tbody>\n";
    dataRows.forEach(row => {
      html += "    <tr>\n";
      for (let i = 0; i < headerRow.length; i++) {
        const cell = row[i] || "";
        html += `      <td>${escapeHtml(cell)}</td>\n`;
      }
      html += "    </tr>\n";
    });
    html += "  </tbody>\n";
  }

  html += "</table>\n";
  return html;
}

// Extract cells from a line based on column positions
function extractCellsFromLine(line, columnPositions) {
  const cells = [];
  
  for (let i = 0; i < columnPositions.length - 1; i++) {
    const start = columnPositions[i] + 1; // Skip the │ character
    const end = columnPositions[i + 1];
    const cellContent = line.substring(start, end).replace(/│$/, '').trim();
    cells.push(cellContent);
  }
  
  return cells;
}

// Merge multiple lines that belong to the same row
function mergeRowGroup(rowGroup) {
  if (rowGroup.length === 1) {
    return rowGroup[0];
  }

  const mergedRow = [];
  const maxCells = Math.max(...rowGroup.map(row => row.length));

  for (let i = 0; i < maxCells; i++) {
    const cellParts = rowGroup
      .map(row => row[i] || "")
      .filter(part => part.trim() !== "");
    
    mergedRow.push(cellParts.join(" "));
  }

  return mergedRow;
}

// Convert JSON data to HTML table
function convertJsonToHtml(jsonData) {
  try {
    const data = JSON.parse(jsonData);
    
    // Detect which type of report this is
    if (data.daily) {
      return createDailyTable(data.daily, data.totals);
    } else if (data.monthly) {
      return createMonthlyTable(data.monthly, data.totals);
    } else if (data.sessions) {
      return createSessionTable(data.sessions, data.totals);
    } else if (data.blocks) {
      return createBlocksTable(data.blocks, data.totals);
    } else {
      return `<div class="json-display"><pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre></div>`;
    }
  } catch (e) {
    return `<div class="error">JSON parsing error: ${escapeHtml(e.message)}</div>`;
  }
}

// Create daily report table
function createDailyTable(dailyData, totals) {
  // Check if breakdown option is enabled
  const breakdownEnabled = document.getElementById("breakdown")?.checked ?? false;

  let html = '<table class="ccusage-table">\n';
  html += '  <thead>\n    <tr>\n';
  html += '      <th>Date</th>\n';
  html += '      <th>Models</th>\n';
  html += '      <th>Input</th>\n';
  html += '      <th>Output</th>\n';
  html += '      <th>Cache Create</th>\n';
  html += '      <th>Cache Read</th>\n';
  html += '      <th>Total Tokens</th>\n';
  html += '      <th>Cost (USD)</th>\n';
  html += '    </tr>\n  </thead>\n  <tbody>\n';

  dailyData.forEach(day => {
    // Main row for the day
    html += '    <tr>\n';
    html += `      <td>${escapeHtml(day.date)}</td>\n`;
    html += `      <td>${formatModels(day.modelsUsed)}</td>\n`;
    html += `      <td>${formatNumber(day.inputTokens)}</td>\n`;
    html += `      <td>${formatNumber(day.outputTokens)}</td>\n`;
    html += `      <td>${formatNumber(day.cacheCreationTokens)}</td>\n`;
    html += `      <td>${formatNumber(day.cacheReadTokens)}</td>\n`;
    html += `      <td>${formatNumber(day.totalTokens)}</td>\n`;
    html += `      <td>$${formatCurrency(day.totalCost)}</td>\n`;
    html += '    </tr>\n';

    // Add model breakdown rows if enabled and data exists
    if (breakdownEnabled && day.modelBreakdowns && day.modelBreakdowns.length > 0) {
      day.modelBreakdowns.forEach(model => {
        html += '    <tr class="breakdown-row">\n';
        html += `      <td class="breakdown-indent">└─ ${formatModelName(model.modelName)}</td>\n`;
        html += '      <td></td>\n';
        html += `      <td>${formatNumber(model.inputTokens)}</td>\n`;
        html += `      <td>${formatNumber(model.outputTokens)}</td>\n`;
        html += `      <td>${formatNumber(model.cacheCreationTokens)}</td>\n`;
        html += `      <td>${formatNumber(model.cacheReadTokens)}</td>\n`;
        html += `      <td>${formatNumber(model.inputTokens + model.outputTokens + model.cacheCreationTokens + model.cacheReadTokens)}</td>\n`;
        html += `      <td>$${formatCurrency(model.cost)}</td>\n`;
        html += '    </tr>\n';
      });
    }
  });

  if (totals) {
    html += '    <tr class="total-row">\n';
    html += '      <td><strong>Total</strong></td>\n';
    html += '      <td></td>\n';
    html += `      <td><strong>${formatNumber(totals.inputTokens)}</strong></td>\n`;
    html += `      <td><strong>${formatNumber(totals.outputTokens)}</strong></td>\n`;
    html += `      <td><strong>${formatNumber(totals.cacheCreationTokens)}</strong></td>\n`;
    html += `      <td><strong>${formatNumber(totals.cacheReadTokens)}</strong></td>\n`;
    html += `      <td><strong>${formatNumber(totals.totalTokens)}</strong></td>\n`;
    html += `      <td><strong>$${formatCurrency(totals.totalCost)}</strong></td>\n`;
    html += '    </tr>\n';
  }

  html += '  </tbody>\n</table>\n';
  return html;
}

// Create monthly report table
function createMonthlyTable(monthlyData, totals) {
  // Check if breakdown option is enabled
  const breakdownEnabled = document.getElementById("breakdown")?.checked ?? false;

  let html = '<table class="ccusage-table">\n';
  html += '  <thead>\n    <tr>\n';
  html += '      <th>Month</th>\n';
  html += '      <th>Models</th>\n';
  html += '      <th>Input</th>\n';
  html += '      <th>Output</th>\n';
  html += '      <th>Cache Create</th>\n';
  html += '      <th>Cache Read</th>\n';
  html += '      <th>Total Tokens</th>\n';
  html += '      <th>Cost (USD)</th>\n';
  html += '    </tr>\n  </thead>\n  <tbody>\n';

  monthlyData.forEach(month => {
    // Main row for the month
    html += '    <tr>\n';
    html += `      <td>${escapeHtml(month.month)}</td>\n`;
    html += `      <td>${formatModels(month.modelsUsed)}</td>\n`;
    html += `      <td>${formatNumber(month.inputTokens)}</td>\n`;
    html += `      <td>${formatNumber(month.outputTokens)}</td>\n`;
    html += `      <td>${formatNumber(month.cacheCreationTokens)}</td>\n`;
    html += `      <td>${formatNumber(month.cacheReadTokens)}</td>\n`;
    html += `      <td>${formatNumber(month.totalTokens)}</td>\n`;
    html += `      <td>$${formatCurrency(month.totalCost)}</td>\n`;
    html += '    </tr>\n';

    // Add model breakdown rows if enabled and data exists
    if (breakdownEnabled && month.modelBreakdowns && month.modelBreakdowns.length > 0) {
      month.modelBreakdowns.forEach(model => {
        html += '    <tr class="breakdown-row">\n';
        html += `      <td class="breakdown-indent">└─ ${formatModelName(model.modelName)}</td>\n`;
        html += '      <td></td>\n';
        html += `      <td>${formatNumber(model.inputTokens)}</td>\n`;
        html += `      <td>${formatNumber(model.outputTokens)}</td>\n`;
        html += `      <td>${formatNumber(model.cacheCreationTokens)}</td>\n`;
        html += `      <td>${formatNumber(model.cacheReadTokens)}</td>\n`;
        html += `      <td>${formatNumber(model.inputTokens + model.outputTokens + model.cacheCreationTokens + model.cacheReadTokens)}</td>\n`;
        html += `      <td>$${formatCurrency(model.cost)}</td>\n`;
        html += '    </tr>\n';
      });
    }
  });

  html += '  </tbody>\n</table>\n';
  return html;
}

// Create session report table
function createSessionTable(sessionData, totals) {
  let html = '<table class="ccusage-table">\n';
  html += '  <thead>\n    <tr>\n';
  html += '      <th>Session</th>\n';
  html += '      <th>Last Activity</th>\n';
  html += '      <th>Input</th>\n';
  html += '      <th>Output</th>\n';
  html += '      <th>Cache Create</th>\n';
  html += '      <th>Cache Read</th>\n';
  html += '      <th>Total Tokens</th>\n';
  html += '      <th>Cost (USD)</th>\n';
  html += '    </tr>\n  </thead>\n  <tbody>\n';

  sessionData.forEach(session => {
    html += '    <tr>\n';
    html += `      <td>${formatSessionId(session.sessionId)}</td>\n`;
    html += `      <td>${escapeHtml(session.lastActivity)}</td>\n`;
    html += `      <td>${formatNumber(session.inputTokens)}</td>\n`;
    html += `      <td>${formatNumber(session.outputTokens)}</td>\n`;
    html += `      <td>${formatNumber(session.cacheCreationTokens)}</td>\n`;
    html += `      <td>${formatNumber(session.cacheReadTokens)}</td>\n`;
    html += `      <td>${formatNumber(session.totalTokens)}</td>\n`;
    html += `      <td>$${formatCurrency(session.totalCost)}</td>\n`;
    html += '    </tr>\n';
  });

  html += '  </tbody>\n</table>\n';
  return html;
}

// Create blocks report table
function createBlocksTable(blocksData, totals) {
  // Check if this is live monitoring (active blocks only)
  const isLiveMonitoring = currentView === "live";
  
  if (isLiveMonitoring && blocksData.length > 0) {
    return createLiveMonitoringView(blocksData[0]); // Show only the active block
  }

  let html = '<table class="ccusage-table">\n';
  html += '  <thead>\n    <tr>\n';
  html += '      <th>Block Period</th>\n';
  html += '      <th>Status</th>\n';
  html += '      <th>Input</th>\n';
  html += '      <th>Output</th>\n';
  html += '      <th>Cache Create</th>\n';
  html += '      <th>Cache Read</th>\n';
  html += '      <th>Total Tokens</th>\n';
  html += '      <th>Cost (USD)</th>\n';
  html += '    </tr>\n  </thead>\n  <tbody>\n';

  blocksData.forEach(block => {
    html += '    <tr>\n';
    html += `      <td>${formatBlockPeriod(block.startTime, block.endTime)}</td>\n`;
    html += `      <td>${formatBlockStatus(block.isActive, block.isGap)}</td>\n`;
    html += `      <td>${formatNumber(block.tokenCounts.inputTokens)}</td>\n`;
    html += `      <td>${formatNumber(block.tokenCounts.outputTokens)}</td>\n`;
    html += `      <td>${formatNumber(block.tokenCounts.cacheCreationInputTokens)}</td>\n`;
    html += `      <td>${formatNumber(block.tokenCounts.cacheReadInputTokens)}</td>\n`;
    html += `      <td>${formatNumber(block.totalTokens)}</td>\n`;
    html += `      <td>$${formatCurrency(block.costUSD)}</td>\n`;
    html += '    </tr>\n';
  });

  html += '  </tbody>\n</table>\n';
  return html;
}

// Create live monitoring dashboard view
function createLiveMonitoringView(activeBlock) {
  if (!activeBlock || !activeBlock.isActive) {
    return '<div class="live-status"><h3>🔴 アクティブなセッションがありません</h3><p>現在進行中のClaude Code使用セッションが見つかりませんでした。</p></div>';
  }

  const burnRate = activeBlock.burnRate || {};
  const projection = activeBlock.projection || {};
  
  // Calculate progress percentages for progress bars
  const sessionProgressPercent = calculateSessionProgress(activeBlock);
  const tokenUsagePercent = calculateTokenUsageProgress(activeBlock, projection);
  const costProgressPercent = calculateCostProgress(activeBlock, projection);
  
  let html = '<div class="live-dashboard-compact">\n';
  
  // Header with status
  html += '<div class="live-header-compact">\n';
  html += '<div class="header-left">\n';
  html += '<h3><span class="live-indicator-dot"></span> ライブセッション</h3>\n';
  html += `<p>${formatBlockPeriod(activeBlock.startTime, activeBlock.endTime)}</p>\n`;
  html += '</div>\n';
  
  if (activeBlock.models && activeBlock.models.length > 0) {
    html += '<div class="header-right">\n';
    activeBlock.models.forEach(model => {
      html += `<span class="model-tag-small">${formatModelName(model)}</span>\n`;
    });
    html += '</div>\n';
  }
  html += '</div>\n';

  // Main metrics with progress bars
  html += '<div class="live-metrics">\n';
  
  // Session Progress
  html += '<div class="metric-row">\n';
  html += '<div class="metric-info">\n';
  html += '<div class="metric-label">セッション進行</div>\n';
  if (projection.remainingMinutes) {
    const elapsed = 300 - projection.remainingMinutes; // Assuming 5-hour blocks = 300 minutes
    html += `<div class="metric-value">${Math.round(elapsed)}分 / 300分</div>\n`;
  } else {
    html += '<div class="metric-value">進行中</div>\n';
  }
  html += '</div>\n';
  html += `<div class="progress-bar"><div class="progress-fill" style="width: ${sessionProgressPercent}%"></div></div>\n`;
  html += '</div>\n';

  // Token Usage
  html += '<div class="metric-row">\n';
  html += '<div class="metric-info">\n';
  html += '<div class="metric-label">トークン使用量</div>\n';
  html += `<div class="metric-value">${formatNumber(activeBlock.totalTokens)}</div>\n`;
  html += '</div>\n';
  html += `<div class="progress-bar"><div class="progress-fill token-fill" style="width: ${tokenUsagePercent}%"></div></div>\n`;
  html += '</div>\n';

  // Current Cost
  html += '<div class="metric-row">\n';
  html += '<div class="metric-info">\n';
  html += '<div class="metric-label">現在のコスト</div>\n';
  html += `<div class="metric-value">$${formatCurrency(activeBlock.costUSD)}</div>\n`;
  html += '</div>\n';
  html += `<div class="progress-bar"><div class="progress-fill cost-fill" style="width: ${costProgressPercent}%"></div></div>\n`;
  html += '</div>\n';

  // Burn Rate
  if (burnRate.tokensPerMinute) {
    html += '<div class="metric-row">\n';
    html += '<div class="metric-info">\n';
    html += '<div class="metric-label">消費レート</div>\n';
    html += `<div class="metric-value">${formatNumber(burnRate.tokensPerMinute)} トークン/分</div>\n`;
    html += '</div>\n';
    const burnRateLevel = getBurnRateLevel(burnRate.tokensPerMinute);
    html += `<div class="burn-rate-indicator ${burnRateLevel}">${getBurnRateText(burnRateLevel)}</div>\n`;
    html += '</div>\n';
  }

  html += '</div>\n';

  // Projections section
  if (projection.totalTokens || projection.totalCost) {
    html += '<div class="live-projections">\n';
    html += '<h4>予測（セッション終了時）</h4>\n';
    html += '<div class="projection-grid">\n';
    
    if (projection.totalTokens) {
      html += '<div class="projection-card">\n';
      html += '<div class="projection-number">' + formatNumber(projection.totalTokens) + '</div>\n';
      html += '<div class="projection-label">総トークン</div>\n';
      html += '</div>\n';
    }
    
    if (projection.totalCost) {
      html += '<div class="projection-card">\n';
      html += '<div class="projection-number">$' + formatCurrency(projection.totalCost) + '</div>\n';
      html += '<div class="projection-label">総コスト</div>\n';
      html += '</div>\n';
    }
    
    if (projection.remainingMinutes) {
      html += '<div class="projection-card">\n';
      html += '<div class="projection-number">' + Math.round(projection.remainingMinutes) + '</div>\n';
      html += '<div class="projection-label">残り時間（分）</div>\n';
      html += '</div>\n';
    }
    
    html += '</div>\n';
    html += '</div>\n';
  }

  html += '</div>\n';
  return html;
}

// Helper functions for progress calculations
function calculateSessionProgress(activeBlock) {
  // Assume 5-hour session = 300 minutes
  const sessionStart = new Date(activeBlock.startTime);
  const now = new Date();
  const elapsed = (now - sessionStart) / (1000 * 60); // minutes
  return Math.min((elapsed / 300) * 100, 100);
}

function calculateTokenUsageProgress(activeBlock, projection) {
  if (projection.totalTokens) {
    return Math.min((activeBlock.totalTokens / projection.totalTokens) * 100, 100);
  }
  // Fallback: show current usage as percentage of reasonable limit
  const reasonableLimit = 100000; // 100K tokens as example limit
  return Math.min((activeBlock.totalTokens / reasonableLimit) * 100, 100);
}

function calculateCostProgress(activeBlock, projection) {
  if (projection.totalCost) {
    return Math.min((activeBlock.costUSD / projection.totalCost) * 100, 100);
  }
  // Fallback: show current cost as percentage of reasonable limit
  const reasonableLimit = 50; // $50 as example limit
  return Math.min((activeBlock.costUSD / reasonableLimit) * 100, 100);
}

function getBurnRateLevel(tokensPerMinute) {
  if (tokensPerMinute < 500) return "normal";
  if (tokensPerMinute < 1000) return "moderate";
  return "high";
}

function getBurnRateText(level) {
  switch (level) {
    case "normal": return "正常";
    case "moderate": return "中程度";
    case "high": return "高";
    default: return "不明";
  }
}

// Utility functions for formatting
function formatNumber(num) {
  if (num === 0) return "0";
  if (num > 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  } else if (num > 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toLocaleString();
}

function formatCurrency(amount) {
  return amount.toFixed(2);
}

function formatModels(models) {
  if (!models || models.length === 0) return "";
  return models.map(model => {
    const parts = model.split('-');
    return parts.length >= 3 ? `${parts[1]}-${parts[2]}` : model;
  }).join('<br>');
}

function formatModelName(modelName) {
  const parts = modelName.split('-');
  return parts.length >= 3 ? `${parts[1]}-${parts[2]}` : modelName;
}

function formatSessionId(sessionId) {
  // Extract project name from path-like session ID
  const parts = sessionId.split('-');
  if (parts.length > 3) {
    return parts.slice(-2).join('-'); // Get last two parts
  }
  return sessionId;
}

function formatBlockPeriod(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const startStr = start.toLocaleString('ja-JP', { 
    month: '2-digit', 
    day: '2-digit', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  const endStr = end.toLocaleString('ja-JP', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  return `${startStr} - ${endStr}`;
}

function formatBlockStatus(isActive, isGap) {
  if (isGap) return '<span class="status-gap">Gap</span>';
  if (isActive) return '<span class="status-active">Active</span>';
  return '<span class="status-completed">Completed</span>';
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function displayOutput(output, isLive = false) {
  const cleanOutput = stripAnsi(output);

  // Check if JSON option is enabled in the GUI
  const jsonOptionEnabled = document.getElementById("json-output")?.checked ?? true;

  // Detect output format
  const isJson = detectJsonOutput(cleanOutput);
  const hasAsciiTable = cleanOutput.match(/[│┌┐└┘┼─├┤]/) && 
    (cleanOutput.includes("Date") || cleanOutput.includes("Models") || 
     cleanOutput.includes("Total") || cleanOutput.includes("Cost"));

  // If JSON option is disabled, always show as plain text with controls
  if (!jsonOptionEnabled) {
    const controlsHtml = `
      <div class="output-controls">
        <button class="zoom-btn" id="zoom-out" title="縮小">－</button>
        <span class="zoom-level" id="zoom-level">${currentZoom}%</span>
        <button class="zoom-btn" id="zoom-in" title="拡大">＋</button>
        <button class="zoom-btn" id="zoom-reset" title="リセット">⌂</button>
      </div>
    `;

    if (isLive && currentView === "live") {
      const existingContent =
        outputPanel.querySelector("pre")?.textContent || "";
      const timestamp = new Date().toLocaleTimeString("ja-JP");
      const prefix = `[${timestamp}] `;
      outputPanel.innerHTML = `${controlsHtml}<pre style="font-size: ${currentZoom}%">${existingContent}${prefix}${cleanOutput}\n</pre>`;
    } else {
      outputPanel.innerHTML = `${controlsHtml}<pre style="font-size: ${currentZoom}%">${cleanOutput}</pre>`;
    }
    setupZoomControls();
    outputPanel.scrollTop = outputPanel.scrollHeight;
    return;
  }

  // JSON option is enabled, convert to tables
  let htmlContent;

  if (isJson) {
    htmlContent = convertJsonToHtml(cleanOutput);
    // No controls for JSON tables
  } else if (hasAsciiTable) {
    htmlContent = convertCcusageTableToHtml(cleanOutput);
    // No controls for converted ASCII tables
  } else {
    // Plain text output - show controls
    showControls = true;
    const controlsHtml = `
      <div class="output-controls">
        <button class="zoom-btn" id="zoom-out" title="縮小">－</button>
        <span class="zoom-level" id="zoom-level">${currentZoom}%</span>
        <button class="zoom-btn" id="zoom-in" title="拡大">＋</button>
        <button class="zoom-btn" id="zoom-reset" title="リセット">⌂</button>
      </div>
    `;

    if (isLive && currentView === "live") {
      const existingContent =
        outputPanel.querySelector("pre")?.textContent || "";
      const timestamp = new Date().toLocaleTimeString("ja-JP");
      const prefix = `[${timestamp}] `;
      outputPanel.innerHTML = `${controlsHtml}<pre style="font-size: ${currentZoom}%">${existingContent}${prefix}${cleanOutput}\n</pre>`;
      setupZoomControls();
      outputPanel.scrollTop = outputPanel.scrollHeight;
      return;
    } else {
      outputPanel.innerHTML = `${controlsHtml}<pre style="font-size: ${currentZoom}%">${cleanOutput}</pre>`;
      setupZoomControls();
      outputPanel.scrollTop = outputPanel.scrollHeight;
      return;
    }
  }

  // Display table content without controls
  outputPanel.innerHTML = `<div class="output-content">${htmlContent}</div>`;
  
  // Don't auto-scroll for live monitoring to prevent jumping
  if (currentView !== "live") {
    outputPanel.scrollTop = outputPanel.scrollHeight;
  }
}

// Detect if output is JSON format
function detectJsonOutput(output) {
  const trimmed = output.trim();
  return (trimmed.startsWith('{') && trimmed.endsWith('}')) && 
         (trimmed.includes('"daily"') || trimmed.includes('"monthly"') || 
          trimmed.includes('"sessions"') || trimmed.includes('"blocks"'));
}

function displayError(error) {
  const controlsHtml = `
    <div class="output-controls">
      <button class="zoom-btn" id="zoom-out" title="縮小">－</button>
      <span class="zoom-level" id="zoom-level">${currentZoom}%</span>
      <button class="zoom-btn" id="zoom-in" title="拡大">＋</button>
      <button class="zoom-btn" id="zoom-reset" title="リセット">⌂</button>
    </div>
  `;

  outputPanel.innerHTML = `
    ${controlsHtml}
    <div class="error">
      <strong>エラーが発生しました:</strong><br>
      ${error}
    </div>
  `;
  setupZoomControls();
}

function setupZoomControls() {
  const zoomInBtn = document.getElementById("zoom-in");
  const zoomOutBtn = document.getElementById("zoom-out");
  const zoomResetBtn = document.getElementById("zoom-reset");
  const zoomLevelSpan = document.getElementById("zoom-level");

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

  const zoomLevelSpan = document.getElementById("zoom-level");
  if (zoomLevelSpan) {
    zoomLevelSpan.textContent = `${currentZoom}%`;
  }
}
