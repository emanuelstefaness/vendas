import { useState, useEffect } from 'react'
import { getPedidosBar } from '../api'
import { useSocket } from '../socket'

export default function TvBar() {
  const [list, setList] = useState([])

  const load = async () => {
    const data = await getPedidosBar()
    setList(data)
  }

  useEffect(() => { load() }, [])
  useSocket(() => load())

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <h1 className="mb-2 text-center text-3xl font-bold text-amber-600 md:text-4xl">TV BAR — BOSQUE DA CARNE</h1>
      <p className="mb-6 text-center text-lg text-slate-600">Caipirinhas, doses e drinks</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => (
          <div key={p.id} className="rounded-2xl border-2 border-slate-200 bg-white p-6 text-xl shadow-md">
            <div className="mb-2 font-bold text-2xl text-amber-600">Comanda {p.comanda_id} — Mesa {p.mesa}</div>
            <p className="text-slate-700">{p.quantity}x {p.item_name}</p>
          </div>
        ))}
      </div>
      {list.length === 0 && <p className="text-center text-2xl text-slate-500">Nenhum pedido no momento</p>}
    </div>
  )
}
