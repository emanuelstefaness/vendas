import { useState, useEffect, useMemo } from 'react'
import {
  getReportsVendasComandas,
  getReportsVendasPorDia,
  getReportsItensMaisVendidos,
  getReportsPorCategoria,
  getReportsFaturamento,
  getReportsChurrasqueira,
  getReportsPorGarcom,
  getReportsCancelamentos
} from '../api'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatMoney(n) {
  const v = Number(n || 0)
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDateBR(iso) {
  if (!iso || iso.length < 10) return iso
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export default function Admin() {
  const [periodMode, setPeriodMode] = useState('day')
  const [dateSingle, setDateSingle] = useState(todayISO)
  const [dateFrom, setDateFrom] = useState(() => {
    const t = new Date()
    return new Date(t.getFullYear(), t.getMonth(), 1).toISOString().slice(0, 10)
  })
  const [dateTo, setDateTo] = useState(todayISO)

  const { from, to } = useMemo(() => {
    if (periodMode === 'day') {
      const d = dateSingle.slice(0, 10)
      return { from: d, to: d }
    }
    let a = dateFrom.slice(0, 10)
    let b = dateTo.slice(0, 10)
    if (a > b) [a, b] = [b, a]
    return { from: a, to: b }
  }, [periodMode, dateSingle, dateFrom, dateTo])

  const periodLabel =
    from === to
      ? formatDateBR(from)
      : `${formatDateBR(from)} a ${formatDateBR(to)}`

  const [vendasComandas, setVendasComandas] = useState([])
  const [vendasPorDia, setVendasPorDia] = useState([])
  const [itensMaisVendidos, setItensMaisVendidos] = useState([])
  const [porCategoria, setPorCategoria] = useState([])
  const [faturamento, setFaturamento] = useState(null)
  const [churrasqueira, setChurrasqueira] = useState([])
  const [porGarcom, setPorGarcom] = useState([])
  const [cancelamentos, setCancelamentos] = useState(null)
  const [tab, setTab] = useState('faturamento')
  const [err, setErr] = useState(null)

  const load = async () => {
    setErr(null)
    try {
      const [vc, vd, itens, cat, fat, churr, gar, canc] = await Promise.all([
        getReportsVendasComandas(from, to),
        getReportsVendasPorDia(from, to),
        getReportsItensMaisVendidos(from, to, 50),
        getReportsPorCategoria(from, to),
        getReportsFaturamento(from, to),
        getReportsChurrasqueira(from, to),
        getReportsPorGarcom(from, to),
        getReportsCancelamentos(from, to)
      ])
      setVendasComandas(vc)
      setVendasPorDia(vd)
      setItensMaisVendidos(itens)
      setPorCategoria(cat)
      setFaturamento(fat)
      setChurrasqueira(churr)
      setPorGarcom(gar)
      setCancelamentos(canc)
    } catch (e) {
      setErr(e?.message || 'Erro ao carregar relatórios')
    }
  }

  useEffect(() => {
    load()
  }, [from, to])

  const topItem = itensMaisVendidos[0]

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12">
      <header className="border-b border-slate-200 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Relatórios</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Faturamento e vendas por <strong>dia operacional</strong> (virada <strong>01:00</strong>), alinhado ao módulo Financeiro. Comandas fechadas no caixa com itens ou pessoas (couvert).
        </p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Período</p>
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-medium ${periodMode === 'day' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            onClick={() => setPeriodMode('day')}
          >
            Um dia
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-medium ${periodMode === 'range' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            onClick={() => setPeriodMode('range')}
          >
            Intervalo
          </button>
        </div>
        {periodMode === 'day' ? (
          <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
            <span>Data</span>
            <input
              type="date"
              value={dateSingle}
              onChange={(e) => setDateSingle(e.target.value)}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-slate-800"
            />
          </label>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              De
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded border border-slate-300 bg-white px-3 py-2 text-slate-800"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Até
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded border border-slate-300 bg-white px-3 py-2 text-slate-800"
              />
            </label>
          </div>
        )}
        <p className="mt-3 text-sm text-slate-700">
          <span className="font-semibold text-slate-900">{periodLabel}</span>
          <span className="text-slate-500"> — cancelamentos usam data do registro do item.</span>
        </p>
        <button type="button" className="btn btn-primary mt-4" onClick={() => void load()}>
          Atualizar dados
        </button>
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      </div>

      {faturamento && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase text-amber-800">Faturamento no período</p>
            <p className="mt-2 text-2xl font-black text-amber-900">{formatMoney(faturamento.faturamento)}</p>
            <p className="mt-1 text-xs text-amber-800/80">Itens + taxa + couvert</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-500">Comandas finalizadas</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{faturamento.comandasCount ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-500">Ticket médio</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{formatMoney(faturamento.ticketMedio)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-500">Produto nº 1</p>
            <p className="mt-2 line-clamp-2 text-lg font-bold text-slate-900">{topItem ? topItem.name : '—'}</p>
            {topItem && <p className="mt-1 text-sm text-slate-600">{topItem.total_quantity} un. · {formatMoney(topItem.total_value)}</p>}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-2">
        {[
          ['faturamento', 'Resumo'],
          ['comandas', 'Comandas'],
          ['evolucao', 'Por dia'],
          ['itens', 'Mais vendidos'],
          ['categoria', 'Categorias'],
          ['churrasqueira', 'Churrasqueira'],
          ['garcom', 'Garçons'],
          ['cancelamentos', 'Cancelamentos'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === id ? 'bg-white text-amber-900 shadow ring-1 ring-amber-200' : 'text-slate-600 hover:bg-white/70'}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'faturamento' && faturamento && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Composição do faturamento</h2>
          {faturamento.business_day_note && <p className="mt-2 text-xs text-slate-500">{faturamento.business_day_note}</p>}
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <dt className="text-xs font-semibold uppercase text-slate-500">Taxa de serviço</dt>
              <dd className="mt-1 text-xl font-bold text-slate-900">{formatMoney(faturamento.taxaServico)}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <dt className="text-xs font-semibold uppercase text-slate-500">Couvert (previsto)</dt>
              <dd className="mt-1 text-xl font-bold text-slate-900">{formatMoney(faturamento.couvert)}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <dt className="text-xs font-semibold uppercase text-slate-500">Pessoas (soma)</dt>
              <dd className="mt-1 text-xl font-bold text-slate-900">{faturamento.totalPessoas ?? 0}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <dt className="text-xs font-semibold uppercase text-slate-500">Ticket por pessoa</dt>
              <dd className="mt-1 text-xl font-bold text-slate-900">{formatMoney(faturamento.ticketPorPessoa)}</dd>
            </div>
          </dl>
        </div>
      )}

      {tab === 'comandas' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
            <h2 className="font-bold text-slate-900">Comandas — {periodLabel}</h2>
            <p className="mt-1 text-sm text-slate-500">Itens + taxa + couvert por fechamento.</p>
          </div>
          <div className="max-h-[min(70vh,560px)] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-white shadow-sm">
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="px-6 py-3">Comanda</th>
                  <th className="px-4 py-3">Mesa</th>
                  <th className="px-4 py-3">Fechamento</th>
                  <th className="hidden px-4 py-3 text-right md:table-cell">Itens</th>
                  <th className="px-6 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {vendasComandas.map((c) => (
                  <tr key={c.comanda_id} className="border-b border-slate-50 hover:bg-slate-50/80">
                    <td className="px-6 py-3 font-semibold text-slate-900">{c.comanda_id}</td>
                    <td className="px-4 py-3 text-slate-700">{c.mesa ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {c.closed_at ? `${formatDateBR(c.closed_at.slice(0, 10))} ${c.closed_at.length > 10 ? c.closed_at.slice(11, 16) : ''}` : '—'}
                    </td>
                    <td className="hidden px-4 py-3 text-right text-xs text-slate-500 md:table-cell">{formatMoney(c.subtotal)}</td>
                    <td className="px-6 py-3 text-right font-bold text-amber-700">{formatMoney(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {vendasComandas.length === 0 && <p className="p-8 text-center text-slate-500">Nenhuma comanda neste período.</p>}
          </div>
        </div>
      )}

      {tab === 'evolucao' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
            <h2 className="font-bold text-slate-900">Faturamento por dia operacional — {periodLabel}</h2>
            {from === to && <p className="mt-1 text-sm text-slate-500">Um único dia: uma linha corresponde ao resumo.</p>}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="px-6 py-3">Dia</th>
                <th className="px-6 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {vendasPorDia.map((r) => (
                <tr key={r.dia} className="border-b border-slate-50 hover:bg-slate-50/80">
                  <td className="px-6 py-3 font-medium text-slate-800">{formatDateBR(r.dia)}</td>
                  <td className="px-6 py-3 text-right font-bold text-amber-700">{formatMoney(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {vendasPorDia.length === 0 && <p className="p-8 text-center text-slate-500">Nenhum dado neste período.</p>}
        </div>
      )}

      {tab === 'itens' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
            <h2 className="font-bold text-slate-900">Produtos mais vendidos — {periodLabel}</h2>
            <p className="mt-1 text-sm text-slate-500">Quantidade e valor em comandas fechadas no período.</p>
          </div>
          <div className="max-h-[min(70vh,560px)] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="w-12 px-4 py-3 text-center">#</th>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3 text-right">Qtd</th>
                  <th className="px-6 py-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {itensMaisVendidos.map((r, i) => (
                  <tr key={`${r.name}-${i}`} className="border-b border-slate-50 hover:bg-slate-50/80">
                    <td className="px-4 py-2.5 text-center text-xs font-bold text-slate-400">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{r.name}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{r.total_quantity}</td>
                    <td className="px-6 py-2.5 text-right font-semibold text-slate-800">{formatMoney(r.total_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {itensMaisVendidos.length === 0 && <p className="p-8 text-center text-slate-500">Nenhum item.</p>}
          </div>
        </div>
      )}

      {tab === 'categoria' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
            <h2 className="font-bold text-slate-900">Vendas por categoria — {periodLabel}</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="px-6 py-3 text-left">Categoria</th>
                <th className="px-6 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {porCategoria.map((r) => (
                <tr key={r.category_name} className="border-b border-slate-50 hover:bg-slate-50/80">
                  <td className="px-6 py-3 font-medium text-slate-900">{r.category_name}</td>
                  <td className="px-6 py-3 text-right font-semibold text-slate-800">{formatMoney(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {porCategoria.length === 0 && <p className="p-8 text-center text-slate-500">Nenhuma venda.</p>}
        </div>
      )}

      {tab === 'churrasqueira' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
            <h2 className="font-bold text-slate-900">Produção churrasqueira — {periodLabel}</h2>
            <p className="mt-1 text-sm text-slate-500">Itens com setor grill nas comandas fechadas.</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="px-6 py-3 text-left">Item</th>
                <th className="px-6 py-3 text-right">Unidades</th>
              </tr>
            </thead>
            <tbody>
              {churrasqueira.map((r) => (
                <tr key={r.name} className="border-b border-slate-50 hover:bg-slate-50/80">
                  <td className="px-6 py-3 font-medium text-slate-900">{r.name}</td>
                  <td className="px-6 py-3 text-right font-semibold">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {churrasqueira.length === 0 && <p className="p-8 text-center text-slate-500">Nenhum item no setor churrasqueira.</p>}
        </div>
      )}

      {tab === 'garcom' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
            <h2 className="font-bold text-slate-900">Por garçom — {periodLabel}</h2>
            <p className="mt-1 text-sm text-slate-500">Faturamento total por comanda atribuída.</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="px-6 py-3 text-left">Garçom</th>
                <th className="px-4 py-3 text-right">Comandas</th>
                <th className="px-6 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {porGarcom.map((r) => (
                <tr key={r.waiter_name} className="border-b border-slate-50 hover:bg-slate-50/80">
                  <td className="px-6 py-3 font-medium text-slate-900">{r.waiter_name}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{r.comandas_count}</td>
                  <td className="px-6 py-3 text-right font-bold text-amber-700">{formatMoney(r.total_faturamento)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {porGarcom.length === 0 && <p className="p-8 text-center text-slate-500">Nenhuma comanda.</p>}
        </div>
      )}

      {tab === 'cancelamentos' && cancelamentos && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
            <h2 className="font-bold text-slate-900">Cancelamentos — {periodLabel}</h2>
            <p className="mt-1 text-sm text-slate-500">Por data de atualização ou criação do pedido (não usa virada 01:00).</p>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-2">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-bold uppercase text-amber-900">Linhas canceladas</p>
              <p className="mt-2 text-2xl font-black text-amber-950">{cancelamentos.resumo?.linhas_canceladas ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase text-slate-600">Valor de referência</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{formatMoney(cancelamentos.resumo?.valor_cancelado)}</p>
            </div>
          </div>
          <div className="border-t border-slate-100 px-6 pb-6">
            <h3 className="mb-3 text-sm font-bold uppercase text-slate-500">Por item</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 text-left">Item</th>
                  <th className="py-2 text-right">Qtd</th>
                  <th className="py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {(cancelamentos.porItem || []).map((r, i) => (
                  <tr key={`${r.name}-${i}`} className="border-b border-slate-50">
                    <td className="py-2 font-medium text-slate-900">{r.name}</td>
                    <td className="py-2 text-right text-slate-600">{r.total_quantity}</td>
                    <td className="py-2 text-right">{formatMoney(r.total_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(cancelamentos.porItem || []).length === 0 && <p className="py-4 text-center text-slate-500">Nenhum cancelamento neste período.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
