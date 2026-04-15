import { Routes, Route, Link, useLocation, NavLink, Navigate } from 'react-router-dom'
import { useWaiter } from './context/WaiterContext'
import Home from './pages/Home'
import Garcons from './pages/Garcons'
import Pedidos from './pages/Pedidos'
import Cozinha from './pages/Cozinha'
import Churrasqueira from './pages/Churrasqueira'
import Bar from './pages/Bar'
import Caixa from './pages/Caixa'
import Admin from './pages/Admin'
import Cardapio from './pages/Cardapio'
import TvChurrasqueira from './pages/TvChurrasqueira'
import TvCozinha from './pages/TvCozinha'
import TvBar from './pages/TvBar'
import PedirOnline from './pages/PedirOnline'
import PedidosOnlineInterno from './pages/PedidosOnlineInterno'

// Rotas que garçom (não-caixa) não pode acessar; quem digitou "caixa" tem acesso total
function SemAcessoGarcom({ children }) {
  const { waiter } = useWaiter()
  if (waiter && !waiter.isCaixa) return <Navigate to="/garcons" replace />
  return children
}

function App() {
  const loc = useLocation()
  const { waiter, logout } = useWaiter()
  const isTv = loc.pathname.startsWith('/tv')
  const isHome = loc.pathname === '/'
  const isPedir = loc.pathname === '/pedir'
  const isGarcomOnly = !!waiter && !waiter.isCaixa

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {!isTv && !isHome && !isPedir && (
        <nav className="sticky top-0 z-50 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
          <Link to="/" className="rounded-lg px-3 py-2 text-lg font-bold text-amber-600 transition hover:text-amber-500">BOSQUE DA CARNE</Link>
          <NavLink to="/garcons" className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>Garçons</NavLink>
          {!isGarcomOnly && (
            <>
              <NavLink to="/caixa" className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>Caixa</NavLink>
              <NavLink to="/cozinha" className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>Cozinha</NavLink>
              <NavLink to="/churrasqueira" className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>Churrasqueira</NavLink>
              <NavLink to="/bar" className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>Bar</NavLink>
              <NavLink to="/cardapio" className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>Cardápio</NavLink>
              <NavLink to="/pedidos-online" className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>Pedidos online</NavLink>
              <NavLink to="/admin" className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>Relatórios</NavLink>
            </>
          )}
          <span className="ml-auto flex items-center gap-2">
            {waiter && (
              <span className="rounded-md bg-slate-100 px-2 py-1 text-sm font-medium text-slate-700">
                {waiter.isCaixa ? 'Caixa / Produção' : `Garçom: ${waiter.name}`}
              </span>
            )}
            {waiter && (
              <button type="button" onClick={logout} className="rounded-md bg-slate-100 px-2 py-1 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600">
                Sair
              </button>
            )}
          </span>
        </nav>
      )}

      <main className={isTv ? '' : 'p-4 md:p-5'}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pedir" element={<PedirOnline />} />
          <Route path="/garcons" element={<Garcons />} />
          <Route path="/garcons/:comandaId/pedidos" element={<Pedidos />} />
          <Route path="/cozinha" element={<SemAcessoGarcom><Cozinha /></SemAcessoGarcom>} />
          <Route path="/churrasqueira" element={<SemAcessoGarcom><Churrasqueira /></SemAcessoGarcom>} />
          <Route path="/bar" element={<SemAcessoGarcom><Bar /></SemAcessoGarcom>} />
          <Route path="/caixa" element={<SemAcessoGarcom><Caixa /></SemAcessoGarcom>} />
          <Route path="/cardapio" element={<SemAcessoGarcom><Cardapio /></SemAcessoGarcom>} />
          <Route path="/pedidos-online" element={<SemAcessoGarcom><PedidosOnlineInterno /></SemAcessoGarcom>} />
          <Route path="/admin" element={<SemAcessoGarcom><Admin /></SemAcessoGarcom>} />
          <Route path="/tv/churrasqueira" element={<TvChurrasqueira />} />
          <Route path="/tv/cozinha" element={<TvCozinha />} />
          <Route path="/tv/bar" element={<TvBar />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
