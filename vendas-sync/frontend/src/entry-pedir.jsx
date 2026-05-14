import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import PedirOnline from './pages/PedirOnline.jsx'
import './index.css'

// App mínimo só para pedidos online (deploy). PDV completo roda localmente.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PedirOnline />} />
        <Route path="/pedir" element={<PedirOnline />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
