import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getComandas, getComandaSummary, updateComanda, getPrintComanda, mergeComandas, changeComandaNumber, lancarCouvert, cancelPedidosMany, clearComanda } from '../api'
import { useSocket } from '../socket'
import { buildComandaPrintHtml, openComandaPrintWindow } from '../utils/comandaImpressao'

const OPEN_STATUSES = ['open', 'ordering', 'paying']

export default function Caixa() {
  const [comandas, setComandas] = useState({})
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // 'agrupar' | { type: 'trocarNumero', id } | { type: 'trocarMesa', id }
  const [agruparDestino, setAgruparDestino] = useState(null)
  const [agruparOrigens, setAgruparOrigens] = useState([])
  const [novoNumero, setNovoNumero] = useState('')
  const [novaMesa, setNovaMesa] = useState('')
  const [caixaError, setCaixaError] = useState('')
  const [cobrancaSeparadaIds, setCobrancaSeparadaIds] = useState([])
  const [cobrancaSeparadaLoading, setCobrancaSeparadaLoading] = useState(false)
  const [clearComandaLoading, setClearComandaLoading] = useState(false)

  const load = async () => {
    const data = await getComandas()
    setComandas(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  useSocket(() => load())

  const openSummary = async (id) => {
    const data = await getComandaSummary(Number(id))
    setSummary(data)
  }

  const toggleServiceTax = async () => {
    if (!summary) return
    const next = summary.comanda.service_tax_percent ? 0 : 10
    await updateComanda(summary.comanda.id, { service_tax_percent: next })
    const data = await getComandaSummary(summary.comanda.id)
    setSummary(data)
  }

  const setPeople = async (n) => {
    if (!summary) return
    const v = Math.max(0, Number(n) || 0)
    await updateComanda(summary.comanda.id, { people_count: v })
    const data = await getComandaSummary(summary.comanda.id)
    setSummary(data)
  }

  const setPaying = async () => {
    if (!summary) return
    setCaixaError('')
    try {
      await updateComanda(summary.comanda.id, { status: 'paying' })
      await load()
      setSummary(null)
    } catch (e) {
      setCaixaError(e.message || 'Erro ao atualizar')
    }
  }

  /** Marca como pago: fecha a comanda, grava closed_at e entra no faturamento / relatórios do dia */
  const registrarPago = async () => {
    if (!summary) return
    const st = summary.comanda.status
    if (st === 'closed') return
    const totalFmt = Number(summary.total ?? summary.subtotal ?? 0).toFixed(2)
    setCaixaError('')
    try {
      if (st === 'open' || st === 'ordering') {
        if (!window.confirm(`Confirmar recebimento de R$ ${totalFmt}? A comanda será fechada e contabilizada no relatório de hoje.`)) return
      }
      const cid = Number(summary.comanda.id)
      if (!Number.isFinite(cid)) {
        setCaixaError('Comanda inválida.')
        return
      }
      await updateComanda(cid, { status: 'closed' })
      await load()
      setSummary(null)
    } catch (e) {
      setCaixaError(e.message || 'Erro ao registrar pagamento')
    }
  }

  const setCPF = async (cpf) => {
    if (!summary) return
    await updateComanda(summary.comanda.id, { client_cpf: cpf })
    const data = await getComandaSummary(summary.comanda.id)
    setSummary(data)
  }

  const handleLancarCouvert = async () => {
    if (!summary) return
    setCaixaError('')
    try {
      await lancarCouvert(summary.comanda.id)
      const data = await getComandaSummary(summary.comanda.id)
      setSummary(data)
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
      const data = await getComandaSummary(summary.comanda.id)
      setSummary(data)
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
          const k = `${p.item_id}|${p.unit_price}|${p.meat_point || ''}|${p.observations || ''}`
          if (!m[k]) m[k] = { item_name: p.item_name, unit_price: p.unit_price, quantity: 0, lineTotal: 0, observations: p.observations || '' }
          m[k].quantity += p.quantity
          m[k].lineTotal += p.quantity * p.unit_price
        })
        return Object.values(m)
      })()
    : []

  const comandasAbertas = Object.entries(comandas).filter(
    ([, c]) => c.mesa && OPEN_STATUSES.includes(c.status)
  )

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
      const data = await getComandaSummary(summary.comanda.id)
      setSummary(data)
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

  if (loading) return <div className="p-4 text-slate-600">Carregando...</div>

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-slate-800">Frente de Caixa</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-info"
          onClick={() => { setModal('agrupar'); setAgruparDestino(null); setAgruparOrigens([]); setCaixaError('') }}
          disabled={comandasAbertas.length < 2}
        >
          Agrupar comandas
        </button>
      </div>

      {!summary ? (
        <div className="grid gap-2 sm:grid-cols-4 md:grid-cols-6">
          {Object.entries(comandas).filter(([, c]) => c.mesa && c.status !== 'closed').map(([id, c]) => (
            <button
              key={id}
              type="button"
              onClick={() => openSummary(Number(id))}
              className={`rounded-xl p-4 text-left shadow-sm ${
                c.status === 'paying' ? 'bg-amber-500 text-slate-900 hover:bg-amber-400' : 'bg-white border border-slate-200 text-slate-800 hover:bg-slate-50'
              }`}
            >
              <span className="font-bold">Comanda {id}</span>
              <br />
              <span className="text-sm">Mesa {c.mesa}</span>
              <br />
              <span className="text-xs text-slate-500">{c.status}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-800">Comanda {summary.comanda.id} — Mesa {summary.comanda.mesa}</h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-info text-sm" onClick={() => { setModal({ type: 'trocarMesa', id: summary.comanda.id }); setNovaMesa(summary.comanda.mesa || ''); setCaixaError('') }}>
                Trocar mesa
              </button>
              <button type="button" className="btn btn-info text-sm" onClick={() => { setModal({ type: 'trocarNumero', id: summary.comanda.id }); setNovoNumero(''); setCaixaError('') }}>
                Trocar nº comanda
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setSummary(null)}>Fechar</button>
            </div>
          </div>
          <ul className="mb-4 space-y-1 border-b border-slate-200 pb-4 text-slate-700">
            {groupedPedidos.map((g, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="min-w-0">
                  <span className="block">{g.quantity}x {g.item_name}</span>
                  {g.observations ? <span className="block text-xs text-slate-500">Descrição: {g.observations}</span> : null}
                </span>
                <span className="shrink-0">R$ {g.lineTotal.toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between text-slate-700">Subtotal <span>R$ {summary.subtotal.toFixed(2)}</span></p>
          <div className="my-3 flex items-center justify-between text-slate-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!summary.comanda.service_tax_percent}
                onChange={toggleServiceTax}
              />
              Taxa de garçom 10%
            </label>
            {summary.comanda.service_tax_percent ? <span>R$ {summary.serviceTax.toFixed(2)}</span> : null}
          </div>
          <div className="my-3 flex flex-wrap items-center gap-2 text-slate-700">
            <label>Pessoas (couvert R$5/pessoa):</label>
            <input
              type="number"
              min="0"
              value={summary.comanda.people_count || 0}
              onChange={(e) => setPeople(e.target.value)}
              className="w-20 rounded border border-slate-300 bg-white px-2 py-1 text-slate-800"
            />
            <span>R$ {(summary.couvertPendente ?? summary.couvert ?? 0).toFixed(2)}</span>
            {(summary.couvertPendente ?? 0) > 0 && (summary.comanda.people_count || 0) > 0 && (
              <button type="button" className="btn btn-primary text-sm" onClick={handleLancarCouvert}>
                Lançar na comanda
              </button>
            )}
            {summary.couvertLancado > 0 && <span className="text-slate-500 text-sm">(já na comanda: R$ {summary.couvertLancado.toFixed(2)})</span>}
          </div>
          <p className="mb-3 flex justify-between font-bold text-lg text-slate-800">Total <span className="text-amber-600">R$ {summary.total.toFixed(2)}</span></p>
          <p className="mb-3 text-sm text-slate-500">Use <strong className="text-slate-700">Pago</strong> quando o cliente pagar — o valor entra no faturamento e nos relatórios do dia.</p>
          <div className="mb-3">
            <label className="block text-sm text-slate-600">CPF (NFC-e)</label>
            <input
              type="text"
              placeholder="CPF do cliente"
              value={summary.comanda.client_cpf || ''}
              onChange={(e) => setCPF(e.target.value)}
              className="w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-slate-800"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {summary.pedidos?.length > 0 && (
              <button type="button" className="btn btn-info" onClick={() => { setModal('cobrancaSeparada'); setCobrancaSeparadaIds([]); setCaixaError(''); }}>
                Cobrança separada
              </button>
            )}
            <Link to={`/garcons/${summary.comanda.id}/pedidos`} className="btn btn-info">Lançar / Editar pedidos</Link>
            <button type="button" className="btn btn-primary" onClick={printComanda}>Imprimir comanda</button>
            <button type="button" className="btn btn-secondary" onClick={() => openSummary(summary.comanda.id)}>Atualizar</button>
            {(summary.comanda.status === 'open' || summary.comanda.status === 'ordering') && (
              <button type="button" className="btn btn-secondary" onClick={setPaying}>
                Aguardando pagamento
              </button>
            )}
            <button type="button" className="btn btn-success font-semibold" onClick={registrarPago} disabled={summary.comanda.status === 'closed'}>
              Pago
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={excluirComandaInteira}
              disabled={clearComandaLoading}
            >
              {clearComandaLoading ? 'Excluindo...' : 'Excluir comanda inteira'}
            </button>
          </div>
        </div>
      )}

      {caixaError && <p className="mt-2 text-sm text-red-600">{caixaError}</p>}

      {modal === 'agrupar' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4">
          <div className="my-auto flex w-full max-w-md max-h-[min(90vh,calc(100dvh-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="shrink-0 border-b border-slate-200 p-5">
              <h3 className="text-lg font-bold text-slate-800">Agrupar comandas</h3>
              <p className="mt-2 text-sm text-slate-500">Só aparecem comandas abertas. Escolha a comanda que ficará e as que serão unidas a ela.</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-slate-700">Comanda que ficará (destino)</label>
                <div className="flex flex-wrap gap-2">
                  {comandasAbertas.map(([id, c]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setAgruparDestino(Number(id))}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${agruparDestino === Number(id) ? 'bg-amber-500 text-slate-900' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'}`}
                    >
                      {id} (Mesa {c.mesa})
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Comandas a agrupar (origem)</label>
                <div className="flex flex-wrap gap-2">
                  {comandasAbertas.filter(([id]) => Number(id) !== agruparDestino).map(([id, c]) => (
                    <label key={id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
                      <input type="checkbox" checked={agruparOrigens.includes(Number(id))} onChange={() => toggleAgruparOrigem(id)} />
                      <span className="text-sm">Comanda {id} — Mesa {c.mesa}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="shrink-0 border-t border-slate-200 bg-slate-50 p-5">
              <div className="flex gap-2">
                <button type="button" className="btn btn-secondary flex-1" onClick={() => { setModal(null); setCaixaError('') }}>Cancelar</button>
                <button type="button" className="btn btn-primary flex-1" onClick={confirmarAgrupar}>Agrupar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal?.type === 'trocarNumero' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="mb-3 text-lg font-bold text-slate-800">Trocar número da comanda</h3>
            <p className="mb-3 text-sm text-slate-500">A comanda atual passará a ter o novo número (1 a 200). O número antigo ficará livre.</p>
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
              <button type="button" className="btn btn-secondary flex-1" onClick={() => { setModal(null); setCaixaError('') }}>Cancelar</button>
              <button type="button" className="btn btn-primary flex-1" onClick={confirmarTrocarNumero}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {modal?.type === 'trocarMesa' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="mb-3 text-lg font-bold text-slate-800">Trocar número da mesa</h3>
            <input
              type="text"
              placeholder="Número da mesa"
              value={novaMesa}
              onChange={(e) => setNovaMesa(e.target.value)}
              className="mb-4 w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-slate-800"
            />
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary flex-1" onClick={() => { setModal(null); setCaixaError('') }}>Cancelar</button>
              <button type="button" className="btn btn-primary flex-1" onClick={salvarMesa}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'cobrancaSeparada' && summary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="p-5 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">Cobrança separada</h3>
              <p className="text-sm text-slate-500 mt-1">Selecione os itens que serão cobrados à parte. Ao clicar em &quot;Ser pago&quot;, eles saem da comanda.</p>
            </div>
            <ul className="flex-1 overflow-y-auto p-5 space-y-2 text-slate-700">
              {summary.pedidos.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
                  <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={cobrancaSeparadaIds.includes(p.id)}
                      onChange={() => toggleCobrancaPedido(p.id)}
                    />
                    <span className="truncate">{p.quantity}x {p.item_name}</span>
                  </label>
                  <span className="text-slate-600">R$ {(p.quantity * p.unit_price).toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <div className="p-5 border-t border-slate-200 bg-slate-50">
              {caixaError && <p className="text-sm text-red-600 mb-2">{caixaError}</p>}
              <p className="flex justify-between font-semibold text-slate-800 mb-3">
                Total da seleção: R$ {summary.pedidos.filter((p) => cobrancaSeparadaIds.includes(p.id)).reduce((s, p) => s + p.quantity * p.unit_price, 0).toFixed(2)}
              </p>
              <div className="flex gap-2">
                <button type="button" className="btn btn-secondary flex-1" onClick={() => { setModal(null); setCaixaError('') }} disabled={cobrancaSeparadaLoading}>Cancelar</button>
                <button type="button" className="btn btn-success flex-1" onClick={pagarSelecao} disabled={cobrancaSeparadaIds.length === 0 || cobrancaSeparadaLoading}>
                  {cobrancaSeparadaLoading ? 'Registrando...' : 'Ser pago'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
