import { Link } from 'react-router-dom'
import { useWaiter } from '../context/WaiterContext'

export default function Home() {
  const { waiter } = useWaiter()
  const modulesCompleto = [
    { to: '/garcons', label: 'Garçons', desc: 'Comandas e pedidos (celular)', icon: '📱' },
    { to: '/caixa', label: 'Frente de Caixa', desc: 'Contas, pagamento, impressão', icon: '💰' },
    { to: '/cardapio', label: 'Cardápio', desc: 'Categorias e itens do menu', icon: '📋' },
    { to: '/cozinha', label: 'Cozinha', desc: 'Pedidos e produção', icon: '🍳' },
    { to: '/churrasqueira', label: 'Churrasqueira', desc: 'Espetinhos e carnes', icon: '🔥' },
    { to: '/bar', label: 'Bar', desc: 'Bebidas e drinks', icon: '🍹' },
    { to: '/admin', label: 'Relatórios', desc: 'Vendas e faturamento', icon: '📊' },
  ]
  const modulesGarcom = [
    { to: '/garcons', label: 'Comandas e pedidos', desc: 'Abrir mesa e lançar pedidos', icon: '📱' },
  ]
  const modules = (waiter && !waiter.isCaixa) ? modulesGarcom : modulesCompleto
  const subtitulo = waiter?.isCaixa ? 'Frente de caixa e produções' : (waiter ? 'Sistema de garçons' : 'Sistema de gerenciamento')

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
