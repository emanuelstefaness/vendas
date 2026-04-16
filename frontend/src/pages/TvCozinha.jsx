import { useState, useEffect } from 'react'
import { getPedidosKitchen } from '../api'
import { useSocket } from '../socket'
import { comandaOnlineLabel, tvPedidoCardClass } from '../utils/comandaOnlineVisual'

export default function TvCozinha() {
  const [list, setList] = useState([])

  const load = async () => {
    const data = await getPedidosKitchen()
    setList(data)
  }

  useEffect(() => { load() }, [])
  useSocket(() => load())

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <h1 className="mb-6 text-center text-3xl font-bold text-amber-600 md:text-4xl">TV COZINHA — BOSQUE DA CARNE</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => (
          <div key={p.id} className={tvPedidoCardClass(p)}>
            {p.comanda_tipo_online === 'delivery' && (
              <div className="mb-3 rounded-xl border-2 border-sky-700 bg-sky-200 px-4 py-3 text-center">
                <p className="text-xl font-black uppercase tracking-wide text-sky-950">🚚 Delivery</p>
                <p className="mt-1 text-base font-bold text-sky-900">Embalar — envio ao cliente</p>
              </div>
            )}
            <div className="mb-2 flex flex-wrap items-center gap-2 font-bold text-2xl text-amber-600">
              <span>Comanda {p.comanda_id} — Mesa {p.mesa}</span>
              {p.comanda_tipo_online !== 'delivery' && comandaOnlineLabel(p.comanda_tipo_online) && (
                <span className="rounded-full bg-black/10 px-3 py-1 text-lg text-slate-800">{comandaOnlineLabel(p.comanda_tipo_online)}</span>
              )}
            </div>
            <p className="text-slate-700">{p.quantity}x {p.item_name}</p>
            {p.waiting_grill && <p className="mt-2 text-lg font-semibold text-amber-600">Aguardando churrasqueira</p>}
          </div>
        ))}
      </div>
      {list.length === 0 && <p className="text-center text-2xl text-slate-500">Nenhum pedido no momento</p>}
    </div>
  )
}
