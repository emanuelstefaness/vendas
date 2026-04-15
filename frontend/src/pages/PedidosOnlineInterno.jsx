import { useState, useEffect, useRef } from 'react'
import { getOrders, updateOrderStatus, getPrintOrder } from '../api'
import { useSocket } from '../socket'

const STATUS_LABEL = {
  recebido: 'Recebido',
  em_producao: 'Em produção',
  pronto: 'Pronto',
  saiu_entrega: 'Saiu para entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado'
}

function playNewOrderSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 800
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
  } catch (_) {}
}

export default function PedidosOnlineInterno() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterTipo, setFilterTipo] = useState('') // '' | delivery | retirada
  const [tab, setTab] = useState('todos') // todos | delivery
  const [alert, setAlert] = useState(null)
  const prevOrdersRef = useRef(0)

  const load = async () => {
    setLoading(true)
    const tipo = filterTipo || undefined
    const data = await getOrders(tipo)
    setOrders(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [filterTipo])
  useSocket((payload, eventName) => {
    load()
    if (eventName === 'novo-pedido-online' && payload) {
      playNewOrderSound()
      setAlert({
        id: payload.orderId,
        tipo: payload.tipo,
        cliente_nome: payload.cliente_nome,
        valor_total: payload.valor_total
      })
      setTimeout(() => setAlert(null), 8000)
    }
  })

  useEffect(() => {
    prevOrdersRef.current = orders.length
  }, [orders])

  const list = tab === 'delivery' ? orders.filter((o) => o.tipo === 'delivery') : orders

  const handleStatus = async (orderId, status) => {
    await updateOrderStatus(orderId, status)
    load()
  }

  const handlePrint = (order) => {
    getPrintOrder(order.id).then((d) => {
      const lines = [
        '========== ' + d.logo + ' ==========',
        d.tipo + ' #' + d.numero,
        '-----------------------------------',
        'Cliente: ' + d.cliente_nome,
        'Tel: ' + d.cliente_telefone,
        '-----------------------------------'
      ]
      if (d.endereco_rua) {
        lines.push(
          d.endereco_rua + ', ' + d.endereco_numero + (d.endereco_complemento ? ' ' + d.endereco_complemento : ''),
          d.endereco_bairro + (d.endereco_referencia ? ' - ' + d.endereco_referencia : ''),
          '-----------------------------------'
        )
      }
      lines.push(...d.items.map((i) => i.quantity + 'x ' + i.item_name + '  R$ ' + (i.quantity * i.unit_price).toFixed(2)))
      lines.push('-----------------------------------', 'TOTAL: R$ ' + Number(d.valor_total).toFixed(2), '===================================')
      const text = lines.join('\n')
      const w = window.open('', '_blank')
      w.document.write('<pre style="font-family:monospace; padding:16px; font-size:14px">' + text.replace(/</g, '&lt;') + '</pre>')
      w.document.title = 'Pedido #' + d.numero
      w.print()
      w.close()
    })
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-slate-800">Pedidos online</h1>

      {alert && (
        <div className="mb-4 rounded-xl border-2 border-amber-500 bg-amber-50 p-4 shadow-lg animate-pulse">
          <p className="font-bold text-amber-800">🔔 Novo pedido de {alert.tipo === 'delivery' ? 'delivery' : 'retirada'} recebido</p>
          <p className="text-slate-700">#{alert.id} — {alert.cliente_nome} — R$ {Number(alert.valor_total).toFixed(2)}</p>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab('todos')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'todos' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700'}`}
        >
          Todos
        </button>
        <button
          type="button"
          onClick={() => setTab('delivery')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'delivery' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700'}`}
        >
          🚚 Delivery
        </button>
        <select
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
        >
          <option value="">Todos os tipos</option>
          <option value="delivery">Delivery</option>
          <option value="retirada">Retirada</option>
        </select>
      </div>

      {loading ? (
        <p className="text-slate-500">Carregando...</p>
      ) : list.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">Nenhum pedido online.</p>
      ) : (
        <div className="space-y-4">
          {list.map((order) => (
            <div
              key={order.id}
              className={`rounded-xl border-2 bg-white p-4 shadow-sm ${
                order.tipo === 'delivery' ? 'border-amber-400' : 'border-slate-200'
              }`}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-slate-800">
                  #{order.id}
                  {order.tipo === 'delivery' ? ' 🚚 Delivery' : ' 🛍 Retirada'}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-sm font-medium text-slate-700">
                  {STATUS_LABEL[order.status] || order.status}
                </span>
              </div>
              <p className="text-slate-700">{order.cliente_nome} — {order.cliente_telefone}</p>
              {order.tipo === 'delivery' && order.endereco_rua && (
                <p className="mt-1 text-sm text-slate-600">
                  {order.endereco_rua}, {order.endereco_numero}
                  {order.endereco_complemento ? ' ' + order.endereco_complemento : ''} — {order.endereco_bairro}
                </p>
              )}
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {order.items?.map((i) => (
                  <li key={i.id}>{i.quantity}x {i.item_name} — R$ {(i.quantity * i.unit_price).toFixed(2)}</li>
                ))}
              </ul>
              <p className="mt-2 font-semibold text-slate-800">Total: R$ {Number(order.valor_total).toFixed(2)}</p>
              {order.observacoes && <p className="mt-1 text-sm text-slate-500">Obs: {order.observacoes}</p>}

              <div className="mt-4 flex flex-wrap gap-2">
                {order.status === 'recebido' && (
                  <button type="button" className="btn btn-info text-sm" onClick={() => handleStatus(order.id, 'em_producao')}>
                    Em produção
                  </button>
                )}
                {order.status === 'em_producao' && (
                  <button type="button" className="btn btn-primary text-sm" onClick={() => handleStatus(order.id, 'pronto')}>
                    Pronto
                  </button>
                )}
                {order.tipo === 'delivery' && order.status === 'pronto' && (
                  <button type="button" className="btn btn-success text-sm" onClick={() => handleStatus(order.id, 'saiu_entrega')}>
                    Saiu para entrega
                  </button>
                )}
                {(order.tipo === 'retirada' && order.status === 'pronto') || (order.tipo === 'delivery' && order.status === 'saiu_entrega') ? (
                  <button type="button" className="btn btn-success text-sm" onClick={() => handleStatus(order.id, 'entregue')}>
                    {order.tipo === 'delivery' ? 'Entregue' : 'Retirado'}
                  </button>
                ) : null}
                {!['entregue', 'cancelado'].includes(order.status) && (
                  <button type="button" className="btn btn-danger text-sm" onClick={() => handleStatus(order.id, 'cancelado')}>
                    Cancelar
                  </button>
                )}
                {order.tipo === 'delivery' && (
                  <button type="button" className="btn btn-secondary text-sm" onClick={() => handlePrint(order)}>
                    Imprimir comanda
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
