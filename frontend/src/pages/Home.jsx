import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useWaiter } from '../context/WaiterContext'

export default function Home() {
  const { waiter, setWaiter, logout } = useWaiter()
  const [modoLogin, setModoLogin] = useState('') // '' | 'garcom' | 'caixa'
  const [senhaCaixa, setSenhaCaixa] = useState('')
  const [erroLogin, setErroLogin] = useState('')
  const modulesCompleto = [
    { to: '/garcons', label: 'Garçons', desc: 'Comandas e pedidos (celular)', icon: '📱' },
    { to: '/caixa', label: 'Frente de Caixa', desc: 'Contas, pagamento, impressão', icon: '💰' },
    { to: '/cardapio', label: 'Cardápio', desc: 'Categorias e itens do menu', icon: '📋' },
    { to: '/cozinha', label: 'Cozinha', desc: 'Pedidos e produção', icon: '🍳' },
    { to: '/churrasqueira', label: 'Churrasqueira', desc: 'Espetinhos e carnes', icon: '🔥' },
    { to: '/bar', label: 'Bar', desc: 'Bebidas e drinks', icon: '🍹' },
    { to: '/admin', label: 'Relatórios', desc: 'Vendas e faturamento', icon: '📊' },
    { to: '/financeiro', label: 'Financeiro', desc: 'Despesas, entradas e lucro por dia', icon: '💹' },
  ]
  const modulesGarcom = [
    { to: '/garcons', label: 'Comandas e pedidos', desc: 'Abrir mesa e lançar pedidos', icon: '📱' },
  ]
  const modules = (waiter && !waiter.isCaixa) ? modulesGarcom : (waiter?.isCaixa ? modulesCompleto : [])
  const subtitulo = waiter?.isCaixa ? 'Frente de caixa e produções' : (waiter ? 'Sistema de garçons' : 'Sistema de gerenciamento')

  const entrarGarcom = () => {
    setWaiter({ name: 'Garçom', isCaixa: false })
    setModoLogin('')
    setErroLogin('')
  }

  const entrarCaixa = () => {
    if (senhaCaixa !== '12345') {
      setErroLogin('Senha incorreta')
      return
    }
    setWaiter({ name: 'Caixa', isCaixa: true })
    setModoLogin('')
    setSenhaCaixa('')
    setErroLogin('')
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-2 text-center text-2xl font-bold text-amber-600 md:text-3xl">BOSQUE DA CARNE</h1>
      <p className="mb-6 text-center text-slate-500">
        {subtitulo}
      </p>
      <Link
        to="/pedir"
        className="mb-6 flex items-center justify-center gap-2 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 font-semibold text-amber-800 hover:bg-amber-100"
      >
        🛒 Fazer pedido online (delivery ou retirada)
      </Link>
      {!waiter && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-slate-800">Acesso ao sistema interno</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={() => { setModoLogin('garcom'); setErroLogin('') }}>
              Login Garçom
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => { setModoLogin('caixa'); setErroLogin('') }}>
              Login Caixa
            </button>
          </div>
          {modoLogin === 'garcom' && (
            <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              <p className="mb-3">Entrar como Garçom libera apenas a área de garçons.</p>
              <button type="button" className="btn btn-primary" onClick={entrarGarcom}>
                Entrar como Garçom
              </button>
            </div>
          )}
          {modoLogin === 'caixa' && (
            <div className="mt-4 rounded-lg bg-slate-50 p-3">
              <p className="mb-2 text-sm text-slate-600">Digite a senha do Caixa para liberar todas as opções.</p>
              <input
                type="password"
                placeholder="Senha do Caixa"
                value={senhaCaixa}
                onChange={(e) => setSenhaCaixa(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && entrarCaixa()}
                className="mb-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
              {erroLogin && <p className="mb-2 text-sm text-red-600">{erroLogin}</p>}
              <button type="button" className="btn btn-primary" onClick={entrarCaixa}>
                Entrar como Caixa
              </button>
            </div>
          )}
        </div>
      )}
      {waiter && (
        <div className="mb-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-700">
            Logado como <strong>{waiter.isCaixa ? 'Caixa' : 'Garçom'}</strong>.
          </p>
          <button type="button" className="btn btn-secondary" onClick={logout}>Trocar login</button>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => (
          <Link
            key={m.to}
            to={m.to}
            className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-amber-400 hover:shadow-md"
          >
            <span className="text-3xl">{m.icon}</span>
            <span className="mt-2 font-semibold text-slate-800">{m.label}</span>
            <span className="mt-1 text-sm text-slate-500">{m.desc}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
