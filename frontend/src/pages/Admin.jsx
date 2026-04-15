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

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-slate-800">Relatórios</h1>

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm font-medium text-slate-700">Período do relatório</p>
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
        <p className="mt-3 text-sm text-slate-600">
          <span className="font-medium text-slate-800">{periodLabel}</span>
          {' — '}
          todas as abas usam este período (comandas fechadas no caixa, exceto cancelamentos de itens).
        </p>
        <button type="button" className="btn btn-primary mt-3" onClick={load}>
          Atualizar
        </button>
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {[
          ['faturamento', 'Resumo'],
          ['comandas', 'Comandas'],
          ['evolucao', 'Por dia'],
          ['itens', 'Itens'],
          ['categoria', 'Categorias'],
          ['churrasqueira', 'Churrasqueira'],
          ['garcom', 'Garçons'],
          ['cancelamentos', 'Cancelamentos']
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`px-3 py-2 text-sm text-slate-700 ${tab === id ? 'border-b-2 border-amber-500 font-semibold text-amber-600' : 'hover:text-slate-900'}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'faturamento' && faturamento && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-800">Resumo — {periodLabel}</h2>
          <p className="text-2xl font-bold text-amber-600">Faturamento: {formatMoney(faturamento.faturamento)}</p>
          <ul className="mt-3 space-y-1 text-slate-600">
            <li>Composição: itens + taxa de serviço ({formatMoney(faturamento.taxaServico)}) + couvert ({formatMoney(faturamento.couvert)})</li>
            <li>Comandas finalizadas: {faturamento.comandasCount ?? 0}</li>
            <li>Pessoas (soma de couverts): {faturamento.totalPessoas ?? 0}</li>
            <li>Ticket médio por comanda: {formatMoney(faturamento.ticketMedio)}</li>
            <li>Ticket médio por pessoa: {formatMoney(faturamento.ticketPorPessoa)}</li>
          </ul>
        </div>
      )}

      {tab === 'comandas' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-800">Comandas — {periodLabel}</h2>
          <p className="mb-3 text-sm text-slate-500">
            Valores por comanda: itens + taxa de serviço + couvert (igual ao resumo).
          </p>
          <ul className="space-y-3 text-slate-700">
            {vendasComandas.map((c) => (
              <li
                key={c.comanda_id}
                className="flex flex-col gap-1 border-b border-slate-100 pb-3 last:border-0 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <span className="font-medium">Comanda {c.comanda_id}</span>
                  <span className="text-slate-500"> — Mesa {c.mesa ?? '—'}</span>
                  <div className="text-xs text-slate-500">
                    Fech. {c.closed_at ? formatDateBR(c.closed_at.slice(0, 10)) : '—'}{' '}
                    {c.closed_at && c.closed_at.length > 10 ? c.closed_at.slice(11, 16) : ''}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Itens {formatMoney(c.subtotal)} · Couvert {formatMoney(c.couvert_valor)} · Taxa{' '}
                    {formatMoney(c.taxa_servico_valor)}
                  </div>
                </div>
                <span className="font-semibold text-amber-700">{formatMoney(c.total)}</span>
              </li>
            ))}
            {vendasComandas.length === 0 && <li className="text-slate-500">Nenhuma comanda neste período.</li>}
          </ul>
        </div>
      )}

      {tab === 'evolucao' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-800">Faturamento por dia de fechamento — {periodLabel}</h2>
          {from === to && (
            <p className="mb-2 text-sm text-slate-500">Um único dia: uma linha abaixo corresponde ao resumo.</p>
          )}
          <ul className="space-y-2 text-slate-700">
            {vendasPorDia.map((r) => (
              <li key={r.dia} className="flex justify-between border-b border-slate-50 py-1">
                <span>{formatDateBR(r.dia)}</span>
                <span className="font-medium">{formatMoney(r.total)}</span>
              </li>
            ))}
            {vendasPorDia.length === 0 && <li className="text-slate-500">Nenhum dado neste período.</li>}
          </ul>
        </div>
      )}

      {tab === 'itens' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-800">Itens mais vendidos — {periodLabel}</h2>
          <p className="mb-3 text-sm text-slate-500">Somente itens de comandas fechadas no caixa neste período.</p>
          <ul className="space-y-2 text-slate-700">
            {itensMaisVendidos.map((r, i) => (
              <li key={`${r.name}-${i}`} className="flex justify-between">
                <span>
                  {r.name} <span className="text-slate-500">(qtd {r.total_quantity})</span>
                </span>
                <span>{formatMoney(r.total_value)}</span>
              </li>
            ))}
            {itensMaisVendidos.length === 0 && <li className="text-slate-500">Nenhum item.</li>}
          </ul>
        </div>
      )}

      {tab === 'categoria' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-800">Vendas por categoria — {periodLabel}</h2>
          <ul className="space-y-2 text-slate-700">
            {porCategoria.map((r) => (
              <li key={r.category_name} className="flex justify-between">
                <span>{r.category_name}</span>
                <span>{formatMoney(r.total)}</span>
              </li>
            ))}
            {porCategoria.length === 0 && <li className="text-slate-500">Nenhuma venda.</li>}
          </ul>
        </div>
      )}

      {tab === 'churrasqueira' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-800">Produção churrasqueira — {periodLabel}</h2>
          <ul className="space-y-2 text-slate-700">
            {churrasqueira.map((r) => (
              <li key={r.name} className="flex justify-between">
                <span>{r.name}</span>
                <span>{r.total} un.</span>
              </li>
            ))}
            {churrasqueira.length === 0 && <li className="text-slate-500">Nenhum item no setor churrasqueira.</li>}
          </ul>
        </div>
      )}

      {tab === 'garcom' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-800">Por garçom — {periodLabel}</h2>
          <p className="mb-3 text-sm text-slate-500">Faturamento total (itens + taxa + couvert) por comanda atribuída.</p>
          <ul className="space-y-2 text-slate-700">
            {porGarcom.map((r) => (
              <li key={r.waiter_name} className="flex justify-between">
                <span>
                  {r.waiter_name}{' '}
                  <span className="text-slate-500">({r.comandas_count} comandas)</span>
                </span>
                <span className="font-medium">{formatMoney(r.total_faturamento)}</span>
              </li>
            ))}
            {porGarcom.length === 0 && <li className="text-slate-500">Nenhuma comanda.</li>}
          </ul>
        </div>
      )}

      {tab === 'cancelamentos' && cancelamentos && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-800">Itens cancelados — {periodLabel}</h2>
          <p className="mb-3 text-sm text-slate-500">
            Linhas de pedido com status cancelado, filtradas pela data de atualização (ou criação) do registro.
          </p>
          <div className="mb-4 rounded-lg bg-amber-50/80 p-3 text-slate-800">
            <p>
              <strong>{cancelamentos.resumo?.linhas_canceladas ?? 0}</strong> linhas canceladas · Valor de referência:{' '}
              <strong>{formatMoney(cancelamentos.resumo?.valor_cancelado)}</strong>
            </p>
          </div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Por item</h3>
          <ul className="space-y-2 text-slate-700">
            {(cancelamentos.porItem || []).map((r, i) => (
              <li key={`${r.name}-${i}`} className="flex justify-between text-sm">
                <span>
                  {r.name} <span className="text-slate-500">(qtd {r.total_quantity})</span>
                </span>
                <span>{formatMoney(r.total_value)}</span>
              </li>
            ))}
            {(cancelamentos.porItem || []).length === 0 && (
              <li className="text-slate-500">Nenhum cancelamento neste período.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
