import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';
import { copyFileSync, writeFileSync, readFileSync } from 'fs';

export default defineConfig(({ command, mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    base: './',
    css: {
      postcss: './postcss.config.js',
    },
    define: {
      // Make environment variables available in the extension
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(env.VITE_API_BASE_URL),
      'import.meta.env.VITE_ENVIRONMENT': JSON.stringify(env.VITE_ENVIRONMENT || mode),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: resolve(__dirname, 'popup.html'),
          background: resolve(__dirname, 'src/background.js'),
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: '[name]-[hash].js',
          assetFileNames: '[name].[ext]',
        }
      }
    },
    plugins: [
      {
        name: 'copy-manifest',
        writeBundle() {
          // Copy manifest.json to dist
          copyFileSync('manifest.json', 'dist/manifest.json');
        }
      }
    ]
  };
});