import { useState, useEffect } from 'react'
import { getPedidosKitchen } from '../api'
import { useSocket } from '../socket'

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
          <div key={p.id} className={`rounded-2xl border-2 p-6 text-xl shadow-md ${p.waiting_grill ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white'}`}>
            <div className="mb-2 font-bold text-2xl text-amber-600">Comanda {p.comanda_id} — Mesa {p.mesa}</div>
            <p className="text-slate-700">{p.quantity}x {p.item_name}</p>
            {p.waiting_grill && <p className="mt-2 text-lg font-semibold text-amber-600">Aguardando churrasqueira</p>}
          </div>
        ))}
      </div>
      {list.length === 0 && <p className="text-center text-2xl text-slate-500">Nenhum pedido no momento</p>}
    </div>
  )
}
