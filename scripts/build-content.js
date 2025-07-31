#!/usr/bin/env node

/**
 * @fileoverview Build script for content script modules
 * @author Prompter Extension
 * @since 1.0.0
 */

import { build } from "esbuild";
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const srcDir = join(rootDir, "src");
const distDir = join(rootDir, "dist");

// Ensure dist directory exists
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

/**
 * Build configuration for content script
 */
const buildConfig = {
  entryPoints: [join(srcDir, "content", "index.js")],
  bundle: true,
  outfile: join(distDir, "content.js"),
  format: "iife",
  platform: "browser",
  target: "chrome88",
  minify: process.env.NODE_ENV === "production",
  sourcemap: process.env.NODE_ENV !== "production",
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV || "development"
    ),
    // Inject Vite environment variables for consistency
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify(
      process.env.VITE_API_BASE_URL || "http://localhost:3000"
    ),
    "import.meta.env.VITE_ENVIRONMENT": JSON.stringify(
      process.env.VITE_ENVIRONMENT || "development"
    ),
    "import.meta.env.MODE": JSON.stringify(
      process.env.NODE_ENV || "development"
    ),
  },
  banner: {
    js: `// Prompter Extension - Content Script (Refactored)
// Generated: ${new Date().toISOString()}
// Modules: TextSelection, TextReplacement, VisualFeedback, ModalSystem, SiteHandlers`,
  },
  external: ["chrome"],
  loader: {
    ".js": "js",
  },
  resolveExtensions: [".js"],
  logLevel: "info",
};

/**
 * Build the content script
 */
async function buildContentScript() {
  try {
    console.log("🔨 Building content script...");

    const result = await build(buildConfig);

    if (result.errors.length > 0) {
      console.error("❌ Build failed with errors:", result.errors);
      process.exit(1);
    }

    if (result.warnings.length > 0) {
      console.warn("⚠️ Build completed with warnings:", result.warnings);
    }

    console.log("✅ Content script built successfully!");
    console.log(`📦 Output: ${buildConfig.outfile}`);

    // Log module information
    console.log("📁 Included modules:");
    console.log("  ├── 🔄 textSelection.js");
    console.log("  ├── 🔧 textReplacement.js");
    console.log("  ├── 🎨 visualFeedback.js");
    console.log("  ├── 📱 modalManager.js");
    console.log("  ├── 🎭 modalStyles.js");
    console.log("  ├── 📋 templateRenderer.js");
    console.log("  ├── ⌨️ keyboardHandling.js");
    console.log("  ├── 🌐 siteHandlers.js");
    console.log("  ├── 🔧 utils.js");
    console.log("  ├── 📊 constants.js");
    console.log("  └── 📝 types.js");
  } catch (error) {
    console.error("❌ Build failed:", error);
    process.exit(1);
  }
}

/**
 * Build legacy content script for compatibility
 */
async function buildLegacyContentScript() {
  const legacyConfig = {
    ...buildConfig,
    entryPoints: [join(srcDir, "content.js")],
    outfile: join(distDir, "content-legacy.js"),
    banner: {
      js: `// Prompter Extension - Legacy Content Script
// Generated: ${new Date().toISOString()}
// Note: This is the original monolithic file for compatibility`,
    },
  };

  try {
    console.log("🔨 Building legacy content script...");

    const result = await build(legacyConfig);

    if (result.errors.length > 0) {
      console.error("❌ Legacy build failed:", result.errors);
      return;
    }

    console.log("✅ Legacy content script built successfully!");
  } catch (error) {
    console.warn(
      "⚠️ Legacy build failed (this is expected if not using legacy mode):",
      error.message
    );
  }
}

/**
 * Main build function
 */
async function main() {
  const startTime = Date.now();

  console.log("🚀 Starting content script build...");
  console.log(`📂 Source: ${srcDir}`);
  console.log(`📦 Output: ${distDir}`);
  console.log(`🔧 Mode: ${process.env.NODE_ENV || "development"}`);
  console.log("");

  await buildContentScript();
  await buildLegacyContentScript();

  const endTime = Date.now();
  const duration = endTime - startTime;

  console.log("");
  console.log(`🎉 Build completed in ${duration}ms`);
  console.log("📋 Next steps:");
  console.log("  1. Load extension in Chrome (chrome://extensions/)");
  console.log("  2. Test on supported websites");
  console.log(
    '  3. Check console for "🎉 Prompter Extension - Fully Refactored & Ready!"'
  );
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("❌ Build script failed:", error);
    process.exit(1);
  });
}

export { buildContentScript, buildConfig };
