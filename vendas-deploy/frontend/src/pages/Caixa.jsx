import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getComandas,
  getComandaSummary,
  updateComanda,
  getPrintComanda,
  mergeComandas,
  changeComandaNumber,
  lancarCouvert,
  cancelPedidosMany,
  clearComanda,
  openComanda,
} from '../api'
import { useSocket } from '../socket'
import { buildComandaPrintHtml, openComandaPrintWindow } from '../utils/comandaImpressao'
import { textoResumoAddonsPedido } from '../utils/lancheAddons'
import CaixaQuickAdd from '../components/CaixaQuickAdd'
import { startCaixaOnlineOrderAlarm, stopCaixaOnlineOrderAlarm } from '../utils/caixaOnlineOrderAlarm'

const OPEN_STATUSES = ['open', 'ordering', 'paying']

function statusLabel(st) {
  const s = String(st || '').toLowerCase()
  if (s === 'paying') return 'Pagamento'
  if (s === 'ordering') return 'Pedindo'
  if (s === 'open') return 'Aberta'
  return s
}

export default function Caixa() {
  const navigate = useNavigate()
  const [comandas, setComandas] = useState({})
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [agruparDestino, setAgruparDestino] = useState(null)
  const [agruparOrigens, setAgruparOrigens] = useState([])
  const [novoNumero, setNovoNumero] = useState('')
  const [novaMesa, setNovaMesa] = useState('')
  const [mesaAbrir, setMesaAbrir] = useState('')
  const [caixaError, setCaixaError] = useState('')
  const [cobrancaSeparadaIds, setCobrancaSeparadaIds] = useState([])
  const [cobrancaSeparadaLoading, setCobrancaSeparadaLoading] = useState(false)
  const [clearComandaLoading, setClearComandaLoading] = useState(false)
  const loadTimeoutRef = useRef(null)
  /** Fila de avisos de pedido online (socket `novo-pedido-online`). */
  const [onlineOrderQueue, setOnlineOrderQueue] = useState([])
  const savedTitleRef = useRef(typeof document !== 'undefined' ? document.title : '')

  const load = async () => {
    const data = await getComandas()
    setComandas(data)
    setLoading(false)
  }

  const scheduleLoad = () => {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current)
    loadTimeoutRef.current = setTimeout(() => {
      void load()
      loadTimeoutRef.current = null
    }, 280)
  }

  useEffect(() => {
    void load()
    return () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current)
    }
  }, [])

  useSocket((payload, eventName) => {
    scheduleLoad()
    if (eventName === 'novo-pedido-online' && payload && (payload.orderId != null || payload.comandaId != null)) {
      setOnlineOrderQueue((q) => {
        const oid = Number(payload.orderId)
        if (Number.isFinite(oid) && q.some((x) => Number(x.orderId) === oid)) return q
        return [...q, { ...payload, _id: `${payload.orderId}-${Date.now()}` }]
      })
    }
  })

  const onlineOrderAlert = onlineOrderQueue[0] || null

  useEffect(() => {
    if (!onlineOrderAlert) {
      stopCaixaOnlineOrderAlarm()
      if (typeof document !== 'undefined' && savedTitleRef.current) {
        document.title = savedTitleRef.current
      }
      return
    }
    startCaixaOnlineOrderAlarm()
    let flip = false
    const titleIv = window.setInterval(() => {
      flip = !flip
      if (typeof document !== 'undefined') {
        document.title = flip ? '🔔 NOVO PEDIDO ONLINE — Caixa' : savedTitleRef.current || 'Caixa'
      }
    }, 950)
    return () => {
      window.clearInterval(titleIv)
      stopCaixaOnlineOrderAlarm()
      if (typeof document !== 'undefined' && savedTitleRef.current) {
        document.title = savedTitleRef.current
      }
    }
  }, [onlineOrderAlert?._id])

  const dismissOnlineOrderAlert = (accepted) => {
    stopCaixaOnlineOrderAlarm()
    setOnlineOrderQueue((q) => q.slice(1))
    if (accepted) navigate('/pedidos-online')
  }

  const emAndamentoIds = useMemo(() => {
    const ids = []
    for (let i = 1; i <= 200; i++) {
      const c = comandas[i]
      const st = String(c?.status || '').toLowerCase()
      if (c?.mesa && OPEN_STATUSES.includes(st)) ids.push(i)
    }
    return ids
  }, [comandas])

  const livresIds = useMemo(() => {
    const set = new Set(emAndamentoIds)
    const out = []
    for (let i = 1; i <= 200; i++) if (!set.has(i)) out.push(i)
    return out
  }, [comandas, emAndamentoIds])

  const comandasAbertas = useMemo(
    () => emAndamentoIds.map((id) => [String(id), comandas[id]]),
    [emAndamentoIds, comandas]
  )

  const openSummary = async (id) => {
    const data = await getComandaSummary(Number(id))
    setSummary(data)
  }

  const refreshSummary = async () => {
    if (!summary?.comanda?.id) return
    const data = await getComandaSummary(summary.comanda.id)
    setSummary(data)
  }

  const toggleServiceTax = async () => {
    if (!summary) return
    const next = summary.comanda.service_tax_percent ? 0 : 10
    await updateComanda(summary.comanda.id, { service_tax_percent: next })
    await refreshSummary()
  }

  const setPeople = async (n) => {
    if (!summary) return
    const v = Math.max(0, Number(n) || 0)
    await updateComanda(summary.comanda.id, { people_count: v })
    await refreshSummary()
  }

  const registrarPago = async () => {
    if (!summary) return
    const st = summary.comanda.status
    if (st === 'closed') return
    const totalFmt = Number(summary.total ?? summary.subtotal ?? 0).toFixed(2)
    setCaixaError('')
    try {
      if (st === 'open' || st === 'ordering') {
        if (!window.confirm(`Confirmar recebimento de R$ ${totalFmt}? A comanda será fechada e contabilizada no dia operacional do fechamento (virada 01:00).`)) return
      }
      const cid = Number(summary.comanda.id)
      if (!Number.isFinite(cid)) {
        setCaixaError('Comanda inválida.')
        return
      }
      await updateComanda(cid, { status: 'closed' })
      setSummary(null)
      void load()
    } catch (e) {
      setCaixaError(e.message || 'Erro ao registrar pagamento')
    }
  }

  const setCPF = async (cpf) => {
    if (!summary) return
    await updateComanda(summary.comanda.id, { client_cpf: cpf })
    await refreshSummary()
  }

  const handleLancarCouvert = async () => {
    if (!summary) return
    setCaixaError('')
    try {
      await lancarCouvert(summary.comanda.id)
      await refreshSummary()
    } catch (e) {
      setCaixaError(e.message || 'Erro ao lançar couvert')
    }
  }

  const toggleCobrancaPedido = (id) => {
    setCobrancaSeparadaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const pagarSelecao = async () => {
    if (cobrancaSeparadaIds.length === 0) {
      setCaixaError('Selecione ao menos um item para cobrança separada.')
      return
    }
    setCaixaError('')
    setCobrancaSeparadaLoading(true)
    try {
      await cancelPedidosMany(cobrancaSeparadaIds)
      await refreshSummary()
      setModal(null)
      setCobrancaSeparadaIds([])
    } catch (e) {
      setCaixaError(e.message || 'Erro ao registrar pagamento')
    } finally {
      setCobrancaSeparadaLoading(false)
    }
  }

  const groupedPedidos = summary?.pedidos?.length
    ? (() => {
        const m = {}
        summary.pedidos.forEach((p) => {
          const k = `${p.item_id}|${p.unit_price}|${p.meat_point || ''}|${p.observations || ''}|${p.extra_caramelized_onion || 0}|${p.extra_hamburger || 0}`
          if (!m[k]) {
            m[k] = {
              item_name: p.item_name,
              unit_price: p.unit_price,
              quantity: 0,
              lineTotal: 0,
              observations: p.observations || '',
              extra_caramelized_onion: p.extra_caramelized_onion,
              extra_hamburger: p.extra_hamburger
            }
          }
          m[k].quantity += p.quantity
          m[k].lineTotal += p.quantity * p.unit_price
        })
        return Object.values(m)
      })()
    : []

  const toggleAgruparOrigem = (id) => {
    const n = Number(id)
    setAgruparOrigens((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]))
  }

  const confirmarAgrupar = async () => {
    if (!agruparDestino || agruparOrigens.length === 0) {
      setCaixaError('Selecione a comanda destino e ao menos uma comanda para agrupar.')
      return
    }
    setCaixaError('')
    try {
      await mergeComandas(agruparDestino, agruparOrigens)
      setModal(null)
      setAgruparDestino(null)
      setAgruparOrigens([])
      await load()
    } catch (e) {
      setCaixaError(e.message || 'Erro ao agrupar')
    }
  }

  const confirmarTrocarNumero = async () => {
    const n = parseInt(novoNumero, 10)
    if (!summary || Number.isNaN(n) || n < 1 || n > 200) {
      setCaixaError('Informe um número de comanda entre 1 e 200.')
      return
    }
    if (n === summary.comanda.id) {
      setCaixaError('O número novo deve ser diferente do atual.')
      return
    }
    setCaixaError('')
    try {
      await changeComandaNumber(summary.comanda.id, n)
      setModal(null)
      setNovoNumero('')
      setSummary(null)
      await load()
      const data = await getComandaSummary(n)
      setSummary(data)
    } catch (e) {
      setCaixaError(e.message || 'Erro ao trocar número')
    }
  }

  const salvarMesa = async () => {
    if (!summary) return
    const v = String(novaMesa).trim()
    if (!v) return
    setCaixaError('')
    try {
      await updateComanda(summary.comanda.id, { mesa: v })
      await refreshSummary()
      setModal(null)
      setNovaMesa('')
    } catch (e) {
      setCaixaError(e.message || 'Erro ao alterar mesa')
    }
  }

  const excluirComandaInteira = async () => {
    if (!summary) return
    if (!window.confirm(`Excluir a comanda ${summary.comanda.id} por completo? Todos os pedidos serão cancelados (cozinha/bar) e a mesa será liberada. Esta ação não pode ser desfeita.`)) return
    setCaixaError('')
    setClearComandaLoading(true)
    try {
      await clearComanda(summary.comanda.id)
      setSummary(null)
      await load()
    } catch (e) {
      setCaixaError(e.message || 'Erro ao excluir comanda')
    } finally {
      setClearComandaLoading(false)
    }
  }

  const printComanda = () => {
    if (!summary) return
    getPrintComanda(summary.comanda.id).then((d) => {
      openComandaPrintWindow(buildComandaPrintHtml(d), `Comanda ${d.comanda}`)
    })
  }

  const abrirComandaLivre = async () => {
    const id = modal?.id
    const mesa = String(mesaAbrir || '').trim()
    if (!id || !mesa) {
      setCaixaError('Informe o número da mesa.')
      return
    }
    setCaixaError('')
    try {
      await openComanda(id, mesa, null)
      setModal(null)
      setMesaAbrir('')
      await load()
      await openSummary(id)
    } catch (e) {
      setCaixaError(e.message || 'Erro ao abrir comanda')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-600">
        Carregando caixa…
      </div>
    )
  }

  return (
    <div className="min-h-0 space-y-6 pb-8">
      {onlineOrderAlert && (
        <div
          className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-0 bg-black/80 p-4 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="caixa-novo-pedido-titulo"
        >
          <div className="pointer-events-auto w-full max-w-lg animate-pulse rounded-2xl border-4 border-red-500 bg-white p-6 shadow-2xl shadow-red-500/30 sm:p-8">
            <p className="text-center text-xs font-black uppercase tracking-[0.2em] text-red-600">Novo pedido online</p>
            <h2 id="caixa-novo-pedido-titulo" className="mt-2 text-center text-2xl font-black text-slate-900 sm:text-3xl">
              Pedido #{onlineOrderAlert.orderId ?? '—'}
            </h2>
            <p className="mt-3 text-center text-base text-slate-700">
              <span className="font-semibold">{onlineOrderAlert.cliente_nome || 'Cliente'}</span>
              {onlineOrderAlert.cliente_telefone ? (
                <span className="mt-1 block text-sm text-slate-600">Tel. {onlineOrderAlert.cliente_telefone}</span>
              ) : null}
            </p>
            <p className="mt-2 text-center text-lg font-bold text-amber-700">
              {typeof onlineOrderAlert.valor_total === 'number'
                ? `Total R$ ${Number(onlineOrderAlert.valor_total).toFixed(2).replace('.', ',')}`
                : ''}
            </p>
            <p className="mt-2 text-center text-sm text-slate-500">
              {String(onlineOrderAlert.tipo || '').toLowerCase() === 'delivery' ? 'Delivery' : 'Retirada no balcão'}
              {onlineOrderAlert.comandaId != null ? ` · Comanda #${onlineOrderAlert.comandaId}` : ''}
            </p>
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-900">
              O alarme soa até você responder. Aceitar abre a tela <strong>Pedidos online</strong>.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                className="rounded-xl bg-emerald-600 px-6 py-3 text-base font-bold text-white shadow-lg hover:bg-emerald-500"
                onClick={() => dismissOnlineOrderAlert(true)}
              >
                Aceitar — ir a Pedidos online
              </button>
              <button
                type="button"
                className="rounded-xl border-2 border-slate-300 bg-white px-6 py-3 text-base font-bold text-slate-800 hover:bg-slate-50"
                onClick={() => dismissOnlineOrderAlert(false)}
              >
                Fechar aviso
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="flex flex-col gap-3 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Frente de caixa</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Comandas ativas e livres (1–200). Pagamento e lançamentos sem precisar ir em Garçom. Faturamento no relatório usa o{' '}
            <strong>dia operacional</strong> (virada <strong>01:00</strong>).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-slate-700"
            onClick={() => {
              setModal('agrupar')
              setAgruparDestino(null)
              setAgruparOrigens([])
              setCaixaError('')
            }}
            disabled={comandasAbertas.length < 2}
          >
            Juntar comandas
          </button>
          <button type="button" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => void load()}>
            Atualizar
          </button>
        </div>
      </header>

      {!summary ? (
        <>
          {emAndamentoIds.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-amber-800/90">
                Pedidos em andamento ({emAndamentoIds.length})
              </h2>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                {emAndamentoIds.map((id) => {
                  const c = comandas[id] || {}
                  const paying = String(c.status || '').toLowerCase() === 'paying'
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => void openSummary(id)}
                      className={`flex min-h-[5.5rem] flex-col items-center justify-center rounded-2xl border-2 px-2 py-3 text-center shadow-md transition hover:scale-[1.02] active:scale-[0.98] ${
                        paying
                          ? 'border-amber-400 bg-gradient-to-br from-amber-400 to-amber-500 text-slate-900'
                          : 'border-amber-200/80 bg-gradient-to-br from-amber-50 to-white text-amber-950'
                      }`}
                    >
                      <span className="text-lg font-black leading-none">{id}</span>
                      {c.mesa != null && c.mesa !== '' && <span className="mt-1 text-xs font-semibold opacity-90">Mesa {c.mesa}</span>}
                      <span className="mt-1 text-[10px] font-medium uppercase opacity-80">{statusLabel(c.status)}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
              Mesas / comandas livres ({livresIds.length})
            </h2>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
              {livresIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setModal({ type: 'abrir', id })
                    setMesaAbrir('')
                    setCaixaError('')
                  }}
                  className="flex min-h-[4.25rem] flex-col items-center justify-center rounded-xl border border-slate-300/90 bg-gradient-to-b from-slate-600 to-slate-700 py-2 text-white shadow-sm transition hover:from-slate-500 hover:to-slate-600"
                >
                  <span className="text-[9px] font-semibold uppercase text-white/80">Abrir</span>
                  <span className="text-base font-bold">{id}</span>
                </button>
              ))}
            </div>
          </section>
        </>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xl">
          <div className="grid gap-0 lg:grid-cols-12">
            <div className="border-b border-slate-100 p-5 lg:col-span-7 lg:border-b-0 lg:border-r">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Mesa / comanda</p>
                  <h2 className="text-xl font-bold text-slate-900">
                    Comanda {summary.comanda.id}
                    <span className="font-normal text-slate-500"> — Mesa {summary.comanda.mesa}</span>
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">Status: {statusLabel(summary.comanda.status)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    onClick={() => {
                      setModal({ type: 'trocarMesa', id: summary.comanda.id })
                      setNovaMesa(summary.comanda.mesa || '')
                      setCaixaError('')
                    }}
                  >
                    Trocar mesa
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    onClick={() => {
                      setModal({ type: 'trocarNumero', id: summary.comanda.id })
                      setNovoNumero('')
                      setCaixaError('')
                    }}
                  >
                    Trocar nº
                  </button>
                  <button type="button" className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800" onClick={() => setSummary(null)}>
                    Voltar às comandas
                  </button>
                </div>
              </div>

              <div className="mb-4 max-h-[min(52vh,420px)] overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-100/95 text-xs uppercase text-slate-600">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Qtd</th>
                      <th className="px-3 py-2 font-semibold">Produto</th>
                      <th className="px-3 py-2 text-right font-semibold">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedPedidos.map((g, i) => {
                      const adG = textoResumoAddonsPedido(g)
                      return (
                      <tr key={i} className="border-b border-slate-100/80 last:border-0">
                        <td className="px-3 py-2.5 align-top font-medium text-slate-800">{g.quantity}</td>
                        <td className="px-3 py-2.5 align-top text-slate-800">
                          {g.item_name}
                          {adG ? <span className="font-medium text-emerald-700">{adG}</span> : null}
                          {g.observations ? <span className="mt-0.5 block text-xs text-slate-500">{g.observations}</span> : null}
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-slate-800">R$ {g.lineTotal.toFixed(2)}</td>
                      </tr>
                    )})}
                  </tbody>
                </table>
                {groupedPedidos.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Nenhum item na comanda.</p>}
              </div>

              <CaixaQuickAdd comandaId={summary.comanda.id} comandaStatus={summary.comanda.status} onItemAdded={refreshSummary} />
            </div>

            <div className="flex flex-col bg-gradient-to-b from-slate-50 to-white p-5 lg:col-span-5">
              <div className="flex-1 space-y-3 text-sm">
                <div className="flex justify-between border-b border-slate-200/80 pb-2 text-slate-700">
                  <span>Subtotal itens</span>
                  <span className="font-medium">R$ {summary.subtotal.toFixed(2)}</span>
                </div>
                <label className="flex cursor-pointer items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <input type="checkbox" checked={!!summary.comanda.service_tax_percent} onChange={() => void toggleServiceTax()} className="rounded border-slate-300" />
                    Taxa 10%
                  </span>
                  {summary.comanda.service_tax_percent ? <span>R$ {summary.serviceTax.toFixed(2)}</span> : <span className="text-slate-400">—</span>}
                </label>
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 pb-3">
                  <span className="text-slate-700">Pessoas (couvert)</span>
                  <input
                    type="number"
                    min="0"
                    value={summary.comanda.people_count || 0}
                    onChange={(e) => void setPeople(e.target.value)}
                    className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center"
                  />
                  <span className="font-medium">R$ {(summary.couvertPendente ?? summary.couvert ?? 0).toFixed(2)}</span>
                  {(summary.couvertPendente ?? 0) > 0 && (summary.comanda.people_count || 0) > 0 && (
                    <button type="button" className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-500" onClick={() => void handleLancarCouvert()}>
                      Lançar couvert
                    </button>
                  )}
                </div>
                {summary.couvertLancado > 0 && <p className="text-xs text-slate-500">Couvert já na conta: R$ {summary.couvertLancado.toFixed(2)}</p>}
              </div>

              <div className="mt-4 border-t border-slate-200 pt-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold uppercase text-slate-600">Total</span>
                  <span className="text-3xl font-black text-amber-600">R$ {summary.total.toFixed(2)}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Use <strong className="text-slate-700">Registrar pagamento</strong> quando o cliente pagar — o valor entra no faturamento (dia operacional 01:00).
                </p>
              </div>

              <label className="mt-4 block text-xs font-medium text-slate-600">
                CPF (NFC-e)
                <input
                  type="text"
                  placeholder="Opcional"
                  value={summary.comanda.client_cpf || ''}
                  onChange={(e) => void setCPF(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                />
              </label>

              <div className="mt-5 flex flex-col gap-2">
                {summary.pedidos?.length > 0 && (
                  <button
                    type="button"
                    className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setModal('cobrancaSeparada')
                      setCobrancaSeparadaIds([])
                      setCaixaError('')
                    }}
                  >
                    Cobrança separada
                  </button>
                )}
                <button type="button" className="btn btn-secondary w-full text-sm" onClick={() => void refreshSummary()}>
                  Atualizar totais
                </button>
                <button type="button" className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={printComanda}>
                  Imprimir pré-conta
                </button>
                <button
                  type="button"
                  className="w-full rounded-xl bg-slate-900 py-3 text-base font-bold text-white shadow-lg hover:bg-slate-800 disabled:opacity-40"
                  onClick={() => void registrarPago()}
                  disabled={summary.comanda.status === 'closed'}
                >
                  Registrar pagamento
                </button>
                <button
                  type="button"
                  className="w-full rounded-xl border border-red-200 py-2 text-sm text-red-700 hover:bg-red-50"
                  onClick={() => void excluirComandaInteira()}
                  disabled={clearComandaLoading}
                >
                  {clearComandaLoading ? 'Excluindo…' : 'Excluir comanda inteira'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {caixaError && <p className="text-sm text-red-600">{caixaError}</p>}

      {modal === 'agrupar' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-[2px]">
          <div className="my-auto flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-900">Juntar comandas</h3>
              <p className="mt-1 text-sm text-slate-600">
                Selecione a comanda destino e as comandas de origem. Todos os pedidos vão para o destino; as origens são fechadas.
              </p>
            </div>
            <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-3">
              <div className="border-b border-slate-100 p-5 md:border-b-0 md:border-r">
                <p className="mb-2 text-xs font-bold uppercase text-slate-500">Destino</p>
                <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">
                  {comandasAbertas.map(([id, c]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setAgruparDestino(Number(id))}
                      className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                        agruparDestino === Number(id) ? 'bg-amber-500 text-slate-900' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                      }`}
                    >
                      {id} · Mesa {c.mesa}
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-b border-slate-100 p-5 md:border-b-0 md:border-r">
                <p className="mb-2 text-xs font-bold uppercase text-slate-500">Origens (unir ao destino)</p>
                <div className="max-h-56 space-y-2 overflow-y-auto">
                  {comandasAbertas
                    .filter(([id]) => Number(id) !== agruparDestino)
                    .map(([id, c]) => (
                      <label key={id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50">
                        <input type="checkbox" checked={agruparOrigens.includes(Number(id))} onChange={() => toggleAgruparOrigem(id)} />
                        <span className="text-sm text-slate-800">
                          Comanda {id} — Mesa {c.mesa}
                        </span>
                      </label>
                    ))}
                </div>
              </div>
              <div className="flex flex-col justify-between bg-slate-50/50 p-5">
                <div>
                  <p className="text-xs text-slate-500">Destino: comanda {agruparDestino ?? '—'}</p>
                </div>
                <div className="mt-4 flex gap-2">
                  <button type="button" className="btn btn-secondary flex-1" onClick={() => { setModal(null); setCaixaError('') }}>
                    Cancelar
                  </button>
                  <button type="button" className="btn btn-primary flex-1 font-semibold" onClick={() => void confirmarAgrupar()}>
                    Juntar pedidos
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal?.type === 'abrir' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Abrir comanda {modal.id}</h3>
            <p className="mt-1 text-sm text-slate-500">Informe o número da mesa para iniciar o atendimento.</p>
            <input
              type="text"
              placeholder="Número da mesa"
              value={mesaAbrir}
              onChange={(e) => setMesaAbrir(e.target.value)}
              className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && void abrirComandaLivre()}
            />
            <div className="mt-4 flex gap-2">
              <button type="button" className="btn btn-secondary flex-1" onClick={() => { setModal(null); setCaixaError('') }}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary flex-1 font-semibold" onClick={() => void abrirComandaLivre()}>
                Abrir
              </button>
            </div>
          </div>
        </div>
      )}

      {modal?.type === 'trocarNumero' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="mb-3 text-lg font-bold text-slate-800">Trocar número da comanda</h3>
            <input
              type="number"
              min="1"
              max="200"
              placeholder="Novo número"
              value={novoNumero}
              onChange={(e) => setNovoNumero(e.target.value)}
              className="mb-4 w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-slate-800"
            />
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary flex-1" onClick={() => { setModal(null); setCaixaError('') }}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary flex-1" onClick={() => void confirmarTrocarNumero()}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {modal?.type === 'trocarMesa' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="mb-3 text-lg font-bold text-slate-800">Trocar mesa</h3>
            <input
              type="text"
              placeholder="Número da mesa"
              value={novaMesa}
              onChange={(e) => setNovaMesa(e.target.value)}
              className="mb-4 w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-slate-800"
            />
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary flex-1" onClick={() => { setModal(null); setCaixaError('') }}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary flex-1" onClick={() => void salvarMesa()}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'cobrancaSeparada' && summary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 p-5">
              <h3 className="text-lg font-bold text-slate-800">Cobrança separada</h3>
              <p className="mt-1 text-sm text-slate-500">Itens selecionados saem da comanda ao confirmar.</p>
            </div>
            <ul className="flex-1 space-y-2 overflow-y-auto p-5 text-slate-700">
              {summary.pedidos.map((p) => {
                const ad = textoResumoAddonsPedido(p)
                return (
                <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={cobrancaSeparadaIds.includes(p.id)} onChange={() => toggleCobrancaPedido(p.id)} />
                    <span className="truncate text-sm">
                      {p.quantity}x {p.item_name}
                      {ad ? <span className="text-emerald-700">{ad}</span> : null}
                    </span>
                  </label>
                  <span className="shrink-0 text-sm text-slate-600">R$ {(p.quantity * p.unit_price).toFixed(2)}</span>
                </li>
                )
              })}
            </ul>
            <div className="border-t border-slate-200 bg-slate-50 p-5">
              {caixaError && <p className="mb-2 text-sm text-red-600">{caixaError}</p>}
              <p className="mb-3 flex justify-between font-semibold text-slate-800">
                Total seleção
                <span>
                  {`R$ ${summary.pedidos
                    .filter((p) => cobrancaSeparadaIds.includes(p.id))
                    .reduce((s, p) => s + p.quantity * p.unit_price, 0)
                    .toFixed(2)}`}
                </span>
              </p>
              <div className="flex gap-2">
                <button type="button" className="btn btn-secondary flex-1" onClick={() => { setModal(null); setCaixaError('') }} disabled={cobrancaSeparadaLoading}>
                  Cancelar
                </button>
                <button type="button" className="btn btn-success flex-1 font-semibold" onClick={() => void pagarSelecao()} disabled={cobrancaSeparadaIds.length === 0 || cobrancaSeparadaLoading}>
                  {cobrancaSeparadaLoading ? '…' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
