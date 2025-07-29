import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, writeFileSync, readFileSync } from 'fs';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        background: resolve(__dirname, 'src/background.js'),
        content: resolve(__dirname, 'src/content.js'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: '[name].[ext]',
      }
    },
    watch: {
      include: 'src/**',
      exclude: 'node_modules/**'
    }
  },
  plugins: [
    {
      name: 'copy-manifest',
      writeBundle() {
        // Copy manifest.json to dist
        copyFileSync('manifest.json', 'dist/manifest.json');
        // Copy popup.css
        copyFileSync('popup.css', 'dist/popup.css');
      }
    }
  ]
});