import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig(({ command, mode }) => {
  const demoMode = command === 'serve' && mode === 'demo'

  return {
  plugins: [react()],

  resolve: {
    alias: demoMode
      ? { '@supabase/supabase-js': fileURLToPath(new URL('./test/mock-supabase.js', import.meta.url)) }
      : {},
  },

  server: {
    port: 5173,
    strictPort: false,
    open: true,
  },

  build: {
    target: 'ES2020',
    minify: 'terser',
    sourcemap: false,
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        drop_debugger: true,
      },
      format: {
        comments: false,
      },
    },
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom'],
          'supabase': ['@supabase/supabase-js'],
        },
        entryFileNames: 'js/[name].[hash].js',
        chunkFileNames: 'js/[name].[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|gif|svg/.test(ext)) {
            return `images/[name].[hash][extname]`;
          } else if (/woff|woff2|eot|ttf|otf/.test(ext)) {
            return `fonts/[name].[hash][extname]`;
          } else if (ext === 'css') {
            return `css/[name].[hash][extname]`;
          }
          return `[name].[hash][extname]`;
        },
      },
    },
    lib: undefined,
    ssrManifest: false,
    assetsInlineLimit: 4096,
    emptyOutDir: true,
    reportCompressedSize: false,
    cssCodeSplit: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },

  optimizeDeps: {
    include: demoMode ? ['react', 'react-dom'] : ['react', 'react-dom', '@supabase/supabase-js'],
    exclude: ['@vite/env'],
  },
  }
})
