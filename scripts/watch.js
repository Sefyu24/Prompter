#!/usr/bin/env node

/**
 * @fileoverview Development watch script for automatic rebuilding
 * @author Prompter Extension
 * @since 1.0.0
 */

import { watch } from "chokidar";
import { buildContentScript } from "./build-content.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const srcDir = join(rootDir, "src");

/**
 * Debounce function to prevent rapid rebuilds
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Handle file changes
 * @param {string} path - Changed file path
 */
async function handleFileChange(path) {
  const relativePath = path.replace(rootDir, ".");

  console.log(`\n📝 File changed: ${relativePath}`);
  console.log("🔄 Rebuilding...");

  try {
    await buildContentScript();
    console.log("✅ Rebuild completed successfully!");
    console.log("🔄 Extension will reload automatically in Chrome");
  } catch (error) {
    console.error("❌ Rebuild failed:", error);
  }
}

/**
 * Start watching for file changes
 */
function startWatching() {
  console.log("👀 Starting development watch mode...");
  console.log(`📂 Watching: ${srcDir}`);
  console.log("");
  console.log("📋 Watch targets:");
  console.log("  ├── 📁 src/content/ (all modules)");
  console.log("  ├── 📄 src/content.js (legacy)");
  console.log("  ├── 📄 manifest.json");
  console.log("  └── 📄 package.json");
  console.log("");
  console.log("💡 Tips:");
  console.log("  • Save any file to trigger rebuild");
  console.log("  • Press Ctrl+C to stop watching");
  console.log("  • Use Chrome DevTools to see live changes");
  console.log("");

  // Debounced file change handler
  const debouncedHandler = debounce(handleFileChange, 300);

  // Watch content script files
  const watcher = watch(
    [
      join(srcDir, "content/**/*.js"),
      join(srcDir, "content.js"),
      join(rootDir, "manifest.json"),
      join(rootDir, "package.json"),
    ],
    {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    }
  );

  watcher.on("change", debouncedHandler);
  watcher.on("add", debouncedHandler);
  watcher.on("unlink", (path) => {
    console.log(`\n🗑️ File deleted: ${path.replace(rootDir, ".")}`);
    debouncedHandler(path);
  });

  watcher.on("error", (error) => {
    console.error("❌ Watch error:", error);
  });

  // Handle process termination
  process.on("SIGINT", () => {
    console.log("\n\n👋 Stopping watch mode...");
    watcher.close();
    process.exit(0);
  });

  console.log("✅ Watch mode started successfully!");
  console.log("");
}

/**
 * Main function
 */
async function main() {
  try {
    // Initial build
    console.log("🔨 Running initial build...");
    await buildContentScript();
    console.log("");

    // Start watching
    startWatching();
  } catch (error) {
    console.error("❌ Failed to start watch mode:", error);
    process.exit(1);
  }
}

// Show helpful information
console.log("🔧 Prompter Extension - Development Watch Mode");
console.log("=".repeat(50));

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { startWatching, handleFileChange };
