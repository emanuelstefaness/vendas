import { useState, useEffect } from 'react'
import { getPedidosGrill } from '../api'
import { useSocket } from '../socket'
import { comandaOnlineLabel, tvPedidoCardClass } from '../utils/comandaOnlineVisual'

export default function TvChurrasqueira() {
  const [list, setList] = useState([])

  const load = async () => {
    const data = await getPedidosGrill()
    setList(data)
  }

  useEffect(() => { load() }, [])
  useSocket(() => load())

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <h1 className="mb-6 text-center text-3xl font-bold text-amber-600 md:text-4xl">TV CHURRASQUEIRA — BOSQUE DA CARNE</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => (
          <div key={p.id} className={tvPedidoCardClass(p)}>
            <div className="mb-2 flex flex-wrap items-center gap-2 font-bold text-2xl text-amber-600">
              <span>Comanda {p.comanda_id} — Mesa {p.mesa}</span>
              {comandaOnlineLabel(p.comanda_tipo_online) && (
                <span className="rounded-full bg-black/10 px-3 py-1 text-lg text-slate-800">{comandaOnlineLabel(p.comanda_tipo_online)}</span>
              )}
            </div>
            <p className="text-slate-700">{p.quantity}x {p.item_name}</p>
            {p.observations && String(p.observations).trim() && (
              <p className="mt-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-lg font-semibold text-violet-800">
                {String(p.observations).trim()}
              </p>
            )}
            {p.meat_point && <p className="mt-2 text-lg font-semibold text-green-600">Ponto: {p.meat_point}</p>}
          </div>
        ))}
      </div>
      {list.length === 0 && <p className="text-center text-2xl text-slate-500">Nenhum pedido no momento</p>}
    </div>
  )
}
