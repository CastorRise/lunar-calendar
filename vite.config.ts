import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'development-entry',
      configureServer(server) {
        // The checked-in index.html is the self-contained offline build.
        // Serve the Vite entry during development, including --open at /.
        server.middlewares.use((request, _response, next) => {
          if (request.url === '/' || request.url?.startsWith('/?') || request.url === '/index.html') {
            request.url = request.url.replace(/^\/(?:index\.html)?/, '/app.html')
          }
          next()
        })
      },
    },
  ],
  build: {
    rollupOptions: {
      input: 'app.html',
      output: { inlineDynamicImports: true },
    },
  },
})
