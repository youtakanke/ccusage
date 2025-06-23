<div align="center">
    <img src="https://cdn.jsdelivr.net/gh/ryoppippi/ccusage@main/docs/public/logo.svg" alt="ccusage logo" width="256" height="256">
    <h1>CCUsage GUI Enhanced Edition</h1>
    <p><em>Based on <a href="https://github.com/ryoppippi/ccusage">ccusage</a> by ryoppippi</em></p>
</div>

<p align="center">
    <a href="https://github.com/a12406/ccusage-gui-enhanced/releases"><img src="https://img.shields.io/github/v/release/a12406/ccusage-gui-enhanced?color=green&label=GUI%20Enhanced" alt="GUI Enhanced Version" /></a>
    <a href="https://npmjs.com/package/ccusage"><img src="https://img.shields.io/npm/v/ccusage?color=yellow&label=Original%20CLI" alt="Original CLI Version" /></a>
    <a href="https://github.com/ryoppippi/ccusage"><img src="https://img.shields.io/badge/Original-ryoppippi%2Fccusage-blue" alt="Original Repository" /></a>
</p>

## ✨ GUI Enhanced Edition Features

This is an enhanced version of ccusage with a beautiful macOS GUI application featuring:

- 🎨 **Enhanced Live Monitoring**: Compact dashboard with progress bars and real-time burn rate indicators
- 📊 **Beautiful Table Display**: ASCII tables automatically converted to styled HTML tables
- 📅 **Date Picker Controls**: Calendar interface for easy date selection
- 📋 **Smart UI**: JSON output as default, adaptive interface for different report types
- 🖥️ **Optimized Layout**: Responsive design that fits perfectly within screen bounds
- ⚡ **Electron App**: Native macOS application with DMG distribution

## 🚀 Quick Start (GUI)

### Option 1: Download DMG (Recommended)
1. Download the latest DMG from [Releases](https://github.com/a12406/ccusage-gui-enhanced/releases)
2. Open the DMG and drag CCUsage to Applications
3. Launch the app from Applications or Launchpad

### Option 2: Run from Source
```bash
git clone https://github.com/a12406/ccusage-gui-enhanced.git
cd ccusage-gui-enhanced
npm install
npm run gui:dev  # Development mode with DevTools
# or
npm run gui     # Production mode
```

## 📖 GUI Documentation

See [GUI_README.md](./GUI_README.md) for complete GUI documentation including:
- Detailed feature explanations
- Usage instructions
- Build and distribution guide
- Developer information

<div align="center">
    <img src="https://cdn.jsdelivr.net/gh/ryoppippi/ccusage@main/docs/public/screenshot.png">
</div>

> Analyze your Claude Code token usage and costs from local JSONL files — incredibly fast and informative!

## Installation

```bash
npm i -g ccusage
```

## Usage

```bash
# Basic usage
ccusage          # Show daily report (default)
ccusage daily    # Daily token usage and costs
ccusage monthly  # Monthly aggregated report
ccusage session  # Usage by conversation session
ccusage blocks   # 5-hour billing windows

# Live monitoring
ccusage blocks --live  # Real-time usage dashboard

# Filters and options
ccusage daily --since 20250525 --until 20250530
ccusage daily --json  # JSON output
ccusage daily --breakdown  # Per-model cost breakdown
```

## Features

- 📊 **Daily Report**: View token usage and costs aggregated by date
- 📅 **Monthly Report**: View token usage and costs aggregated by month
- 💬 **Session Report**: View usage grouped by conversation sessions
- ⏰ **5-Hour Blocks Report**: Track usage within Claude's billing windows with active block monitoring
- 📈 **Live Monitoring**: Real-time dashboard showing active session progress, token burn rate, and cost projections with `blocks --live`
- 🤖 **Model Tracking**: See which Claude models you're using (Opus, Sonnet, etc.)
- 📊 **Model Breakdown**: View per-model cost breakdown with `--breakdown` flag
- 📅 **Date Filtering**: Filter reports by date range using `--since` and `--until`
- 📁 **Custom Path**: Support for custom Claude data directory locations
- 🎨 **Beautiful Output**: Colorful table-formatted display with automatic responsive layout
- 📱 **Smart Tables**: Automatic compact mode for narrow terminals (< 100 characters) with essential columns
- 📋 **Enhanced Model Display**: Model names shown as bulleted lists for better readability
- 📄 **JSON Output**: Export data in structured JSON format with `--json`
- 💰 **Cost Tracking**: Shows costs in USD for each day/month/session
- 🔄 **Cache Token Support**: Tracks and displays cache creation and cache read tokens separately
- 🌐 **Offline Mode**: Use pre-cached pricing data without network connectivity with `--offline` (Claude models only)
- 🔌 **MCP Integration**: Built-in Model Context Protocol server for integration with other tools

## Documentation

Full documentation is available at **[ccusage.com](https://ccusage.com/)**

## Sponsors

<p align="center">
    <a href="https://github.com/sponsors/ryoppippi">
        <img src="https://cdn.jsdelivr.net/gh/ryoppippi/sponsors@main/sponsors.svg">
    </a>
</p>

## Star History

<a href="https://www.star-history.com/#ryoppippi/ccusage&Date">
    <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=ryoppippi/ccusage&type=Date&theme=dark" />
        <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=ryoppippi/ccusage&type=Date" />
        <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=ryoppippi/ccusage&type=Date" />
    </picture>
</a>

## License

[MIT](LICENSE) © [@ryoppippi](https://github.com/ryoppippi)
