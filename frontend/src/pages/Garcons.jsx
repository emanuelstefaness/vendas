import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getComandas, openComanda, getWaiterByName } from '../api'
import { useSocket } from '../socket'
import { useWaiter } from '../context/WaiterContext'

const statusClass = {
  closed: 'card-status-closed',
  open: 'card-status-open',
  ordering: 'card-status-ordering',
  paying: 'card-status-paying',
  closed_green: 'card-status-closed-green',
}

/** Em andamento na lista do garçom: só contas realmente abertas (não confiar só em pedidos antigos) */
const GARCOM_OPEN = ['open', 'ordering', 'paying']

function comandaEmAndamentoNaLista(c) {
  if (!c) return false
  if (c.closed_at) return false
  const st = String(c.status || '').toLowerCase().trim()
  return GARCOM_OPEN.includes(st)
}

function comandaFechadaParaReabrir(c) {
  if (!c) return true
  if (c.closed_at) return true
  const st = String(c.status || '').toLowerCase().trim()
  return st === 'closed'
}

function cardStatusVisual(c) {
  const stRaw = String(c.status || 'closed').toLowerCase().trim()
  if (c.closed_at && GARCOM_OPEN.includes(stRaw)) {
    return c.mesa ? 'closed_green' : 'closed'
  }
  if (stRaw === 'closed' && c.mesa) return 'closed_green'
  return stRaw
}

export default function Garcons() {
  const navigate = useNavigate()
  const { waiter, setWaiter } = useWaiter()
  const [comandas, setComandas] = useState({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // { id, mesa } ou 'nome' para pedir nome do garçom
  const [nomeError, setNomeError] = useState('')

  const refresh = async () => {
    try {
      const data = await getComandas()
      setComandas(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])
  useSocket(() => refresh())

  const handleCard = (id, comanda) => {
    const c = comandas[id] || { id, status: 'closed', mesa: null }
    if (comandaEmAndamentoNaLista(c)) {
      navigate(`/garcons/${id}/pedidos`)
      return
    }
    if (comandaFechadaParaReabrir(c) && !c.mesa) {
      setModal({ id })
      return
    }
    if (comandaFechadaParaReabrir(c) && c.mesa) {
      setModal({ id, mesa: c.mesa })
      return
    }
    setModal({ id })
  }

  const submitNome = async () => {
    const input = document.querySelector('input[placeholder="Seu nome"]')
    const name = input?.value?.trim()
    if (!name) { setNomeError('Digite seu nome'); return }
    setNomeError('')
    // "caixa" = acesso total (Frente de Caixa + produções), sem restrição de garçom
    if (name.toLowerCase() === 'caixa') {
      setWaiter({ name: 'Caixa', isCaixa: true })
      setModal(null)
      return
    }
    try {
      const w = await getWaiterByName(name)
      setWaiter(w)
      setModal(null)
    } catch (e) {
      setNomeError(e.message || 'Erro ao identificar')
    }
  }

  const submitMesa = async () => {
    const input = document.querySelector('input[placeholder="Número da mesa"]')
    const mesa = input?.value?.trim()
    if (!mesa) return
    const id = modal.id
    try {
      await openComanda(id, mesa, waiter?.id ?? null)
      setModal(null)
      await refresh()
      navigate(`/garcons/${id}/pedidos`)
    } catch (e) {
      alert(e.message)
    }
  }

  useEffect(() => {
    if (!loading && !waiter) setModal('nome')
  }, [loading, waiter])

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center p-4 text-slate-500">Carregando...</div>

  if (!waiter) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
          <h2 className="mb-1 text-xl font-bold text-amber-600">Identificação</h2>
          <p className="mb-4 text-sm text-slate-500">Digite seu nome para lançar pedidos. Ou digite <strong>caixa</strong> para acesso à frente de caixa e telas de produção.</p>
          <input
            type="text"
            placeholder="Seu nome"
            className="mb-2 w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            onKeyDown={(e) => e.key === 'Enter' && submitNome()}
            autoFocus
          />
          {nomeError && <p className="mb-2 text-sm text-red-600">{nomeError}</p>}
          <button type="button" className="btn btn-primary w-full" onClick={submitNome}>Entrar</button>
        </div>
      </div>
    )
  }

  const emAndamento = Array.from({ length: 200 }, (_, i) => i + 1).filter((id) =>
    comandaEmAndamentoNaLista(comandas[id])
  )
  const livres = Array.from({ length: 200 }, (_, i) => i + 1).filter(
    (id) => !comandaEmAndamentoNaLista(comandas[id])
  )

  const goToMesa = (e) => {
    const v = e.target?.value?.trim()
    const n = parseInt(v, 10)
    if (v && !Number.isNaN(n) && n >= 1 && n <= 200) handleCard(n, comandas[n] || { id: n, status: 'closed', mesa: null })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <input
          type="text"
          inputMode="numeric"
          placeholder="Digite o nº da mesa/comanda..."
          className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          onKeyDown={(e) => e.key === 'Enter' && goToMesa(e)}
        />
      </div>

      {emAndamento.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Pedidos em andamento ({emAndamento.length})
          </h2>
          <div className="grid grid-cols-3 gap-3 sm:flex sm:flex-wrap sm:gap-2">
            {emAndamento.map((id) => {
              const c = comandas[id] || { id, status: 'open', mesa: null }
              const cls = statusClass[cardStatusVisual(c)] || statusClass.closed
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleCard(id, c)}
                  className={`flex min-h-[4.75rem] min-w-0 flex-col items-center justify-center rounded-xl text-white shadow-md transition active:scale-95 sm:min-h-[3.5rem] sm:min-w-[4rem] ${cls}`}
                >
                  <span className="text-lg font-bold sm:text-base">{id}</span>
                  {c.mesa && <span className="text-xs opacity-90">Mesa {c.mesa}</span>}
                </button>
              )
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Mesas / Comandas livres ({livres.length})
        </h2>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 sm:gap-2 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
          {livres.map((id) => {
            const c = comandas[id] || { id, status: 'closed', mesa: null }
            const cls = statusClass[cardStatusVisual(c)] || statusClass.closed
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleCard(id, c)}
                className={`flex min-h-[4.25rem] min-w-0 flex-col items-center justify-center rounded-xl text-white shadow transition active:scale-95 sm:min-h-[3rem] sm:rounded-lg ${cls}`}
              >
                <span className="text-base font-bold sm:text-sm">{id}</span>
                {c.mesa && <span className="text-[10px] opacity-80">Mesa {c.mesa}</span>}
              </button>
            )
          })}
        </div>
      </section>

      {modal && modal !== 'nome' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-semibold text-slate-800">Comanda {modal.id}</h2>
            <p className="mb-4 text-sm text-slate-500">Informe o número da mesa</p>
            <input
              type="text"
              placeholder="Número da mesa"
              defaultValue={modal.mesa}
              className="mb-4 w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-lg text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              onKeyDown={(e) => e.key === 'Enter' && submitMesa()}
              autoFocus
            />
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary flex-1" onClick={() => setModal(null)}>Cancelar</button>
              <button type="button" className="btn btn-primary flex-1" onClick={submitMesa}>Abrir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
