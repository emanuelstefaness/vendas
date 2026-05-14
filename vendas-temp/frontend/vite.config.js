import os from 'node:os'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** No CMD, mostra o link certo para abrir no celular (mesma Wi‑Fi). */
function pdvLanHintPlugin() {
  return {
    name: 'pdv-lan-hint',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const port = server.config.server.port || 5173
        const nets = os.networkInterfaces()
        const ips = []
        for (const k of Object.keys(nets)) {
          for (const n of nets[k] || []) {
            const fam = n.family
            if ((fam === 'IPv4' || fam === 4) && !n.internal) ips.push(n.address)
          }
        }
        if (!ips.length) return
        console.log('\n\x1b[36m%s\x1b[0m', '>>> PDV — abra no celular/outro PC (mesma rede Wi-Fi):')
        for (const ip of ips) {
          console.log(`    http://${ip}:${port}/`)
        }
        console.log('\x1b[33m%s\x1b[0m', '    Se não abrir: firewall bloqueando 5173 e 3001. Na pasta do projeto, PowerShell ADMIN: npm run fw:windows\n')
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), pdvLanHintPlugin()],
  // 0.0.0.0: escuta em todas as placas (necessário para outros dispositivos na LAN)
  server: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: true,
    allowedHosts: true,
    // HMR: não fixar clientPort — em celulares/rede local o Vite usa o host do próprio pedido.
    proxy: {
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true },
      '/socket.io': { target: 'http://127.0.0.1:3001', ws: true, changeOrigin: true },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true },
      '/socket.io': { target: 'http://127.0.0.1:3001', ws: true, changeOrigin: true },
    },
  },
})
