import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  getFinanceDaily,
  getFinanceEntries,
  postFinanceExpense,
  postFinanceIncomeManual,
  deleteFinanceExpense,
  deleteFinanceIncomeManual,
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

function localDateFromISO(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

function isoFromLocalDate(d) {
  const yy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** Segunda-feira da semana que contém a data local. */
function startOfWeekMonday(localDate) {
  const d = new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate())
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function addDaysLocal(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

function defaultWeekMondayISO() {
  return isoFromLocalDate(startOfWeekMonday(new Date()))
}

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function Financeiro() {
  const [periodMode, setPeriodMode] = useState('range')
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

  const periodLabel = from === to ? formatDateBR(from) : `${formatDateBR(from)} a ${formatDateBR(to)}`

  const [data, setData] = useState(null)
  const [entries, setEntries] = useState(null)
  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(true)

  const [expBd, setExpBd] = useState(todayISO)
  const [expDesc, setExpDesc] = useState('')
  const [expVal, setExpVal] = useState('')
  const [incBd, setIncBd] = useState(todayISO)
  const [incDesc, setIncDesc] = useState('')
  const [incVal, setIncVal] = useState('')
  const [saving, setSaving] = useState(false)

  const [weekMondayISO, setWeekMondayISO] = useState(defaultWeekMondayISO)
  const [weeklyData, setWeeklyData] = useState(null)
  const [weeklyLoading, setWeeklyLoading] = useState(true)
  const [weeklyErr, setWeeklyErr] = useState(null)

  const weekSundayISO = useMemo(() => isoFromLocalDate(addDaysLocal(localDateFromISO(weekMondayISO), 6)), [weekMondayISO])

  const fetchWeekly = useCallback(async () => {
    const from = weekMondayISO
    const to = weekSundayISO
    setWeeklyLoading(true)
    setWeeklyErr(null)
    try {
      const d = await getFinanceDaily(from, to)
      setWeeklyData(d)
    } catch (e) {
      setWeeklyErr(e?.message || 'Erro ao carregar relatório semanal')
      setWeeklyData(null)
    } finally {
      setWeeklyLoading(false)
    }
  }, [weekMondayISO, weekSundayISO])

  useEffect(() => {
    void fetchWeekly()
  }, [fetchWeekly])

  const weeklyDaily = weeklyData?.daily || []
  const weeklyTotals = weeklyData?.totals

  const weeklyChartMax = useMemo(() => {
    let m = 1
    for (const r of weeklyDaily) {
      m = Math.max(m, r.entradas_total || 0, r.expenses || 0)
    }
    return m
  }, [weeklyDaily])

  const load = async () => {
    setLoading(true)
    setErr(null)
    try {
      const [d, e] = await Promise.all([getFinanceDaily(from, to), getFinanceEntries(from, to)])
      setData(d)
      setEntries(e)
    } catch (e) {
      setErr(e?.message || 'Erro ao carregar')
      setData(null)
      setEntries(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [from, to])

  const daily = data?.daily || []
  const totals = data?.totals

  const chartMax = useMemo(() => {
    let m = 1
    for (const r of daily) {
      m = Math.max(m, r.entradas_total || 0, r.expenses || 0)
    }
    return m
  }, [daily])

  const addExpense = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    try {
      await postFinanceExpense({
        business_date: expBd,
        description: expDesc,
        amount: Number(String(expVal).replace(',', '.')),
      })
      setExpDesc('')
      setExpVal('')
      await load()
      await fetchWeekly()
    } catch (er) {
      setErr(er.message)
    } finally {
      setSaving(false)
    }
  }

  const addIncome = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    try {
      await postFinanceIncomeManual({
        business_date: incBd,
        description: incDesc,
        amount: Number(String(incVal).replace(',', '.')),
      })
      setIncDesc('')
      setIncVal('')
      await load()
      await fetchWeekly()
    } catch (er) {
      setErr(er.message)
    } finally {
      setSaving(false)
    }
  }

  const removeExpense = async (id) => {
    if (!window.confirm('Excluir esta despesa?')) return
    try {
      await deleteFinanceExpense(id)
      await load()
      await fetchWeekly()
    } catch (er) {
      setErr(er.message)
    }
  }

  const removeIncome = async (id) => {
    if (!window.confirm('Excluir esta entrada manual?')) return
    try {
      await deleteFinanceIncomeManual(id)
      await load()
      await fetchWeekly()
    } catch (er) {
      setErr(er.message)
    }
  }

  const goWeek = (deltaWeeks) => {
    const mon = localDateFromISO(weekMondayISO)
    setWeekMondayISO(isoFromLocalDate(addDaysLocal(mon, deltaWeeks * 7)))
  }

  const goCurrentWeek = () => {
    setWeekMondayISO(defaultWeekMondayISO())
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12">
      <header className="border-b border-slate-200 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Gestão financeira</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
          <strong>Faturamento</strong> (caixa + online entregue + entradas manuais), <strong>despesas</strong> e <strong>lucro</strong>{' '}
          (entradas − despesas). Dia operacional com virada às <strong>01:00</strong> — igual ao relatório de vendas.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Período</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${periodMode === 'day' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            onClick={() => setPeriodMode('day')}
          >
            Um dia
          </button>
          <button
            type="button"
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${periodMode === 'range' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            onClick={() => setPeriodMode('range')}
          >
            Intervalo
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          {periodMode === 'day' ? (
            <label className="text-sm text-slate-700">
              Data operacional
              <input
                type="date"
                value={dateSingle}
                onChange={(e) => setDateSingle(e.target.value)}
                className="mt-1 block rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
          ) : (
            <>
              <label className="text-sm text-slate-700">
                De
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2" />
              </label>
              <label className="text-sm text-slate-700">
                Até
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2" />
              </label>
            </>
          )}
          <button
            type="button"
            className="btn btn-primary mt-5 sm:mt-0"
            onClick={() => {
              void load()
              void fetchWeekly()
            }}
            disabled={loading}
          >
            {loading ? 'Carregando…' : 'Atualizar'}
          </button>
        </div>
        <p className="mt-3 text-sm font-medium text-slate-800">{periodLabel}</p>
        {data?.business_day_note && <p className="mt-2 text-xs text-slate-500">{data.business_day_note}</p>}
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      </section>

      <section className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/90 via-white to-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-800">Relatório semanal</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">Semana operacional (segunda a domingo)</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Soma de <strong>faturamento</strong> (caixa + online entregue + entradas manuais), <strong>despesas</strong> e <strong>lucro</strong> nos 7 dias, com a mesma
              regra de <strong>dia operacional (virada 01:00)</strong> do restante do financeiro.
            </p>
            <p className="mt-2 text-sm font-semibold text-indigo-950">
              {formatDateBR(weekMondayISO)} a {formatDateBR(weekSundayISO)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => goWeek(-1)}>
              ← Semana anterior
            </button>
            <button type="button" className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500" onClick={goCurrentWeek}>
              Semana atual
            </button>
            <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => goWeek(1)}>
              Próxima semana →
            </button>
            <label className="flex flex-col text-xs font-medium text-slate-600">
              Semana que contém
              <input
                type="date"
                className="mt-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-800"
                onChange={(e) => {
                  const v = e.target.value
                  if (!v || v.length < 10) return
                  setWeekMondayISO(isoFromLocalDate(startOfWeekMonday(localDateFromISO(v))))
                }}
              />
            </label>
          </div>
        </div>

        {weeklyErr && <p className="mt-4 text-sm text-red-600">{weeklyErr}</p>}
        {weeklyLoading && <p className="mt-4 text-sm text-slate-500">Carregando semana…</p>}

        {!weeklyLoading && weeklyTotals && (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-emerald-100 bg-white/90 p-4 shadow-sm">
                <p className="text-xs font-bold uppercase text-emerald-800">Faturamento na semana</p>
                <p className="mt-1 text-xl font-black text-emerald-900">{formatMoney(weeklyTotals.entradas_total)}</p>
                <p className="mt-1 text-[11px] text-slate-500">Caixa + online + manual</p>
              </div>
              <div className="rounded-xl border border-rose-100 bg-white/90 p-4 shadow-sm">
                <p className="text-xs font-bold uppercase text-rose-800">Despesas na semana</p>
                <p className="mt-1 text-xl font-black text-rose-900">{formatMoney(weeklyTotals.expenses)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-white shadow-sm sm:col-span-2">
                <p className="text-xs font-bold uppercase text-white/70">Lucro da semana</p>
                <p className="mt-1 text-2xl font-black tracking-tight">{formatMoney(weeklyTotals.lucro)}</p>
                <p className="mt-1 text-xs text-white/75">Entradas da semana − despesas da semana</p>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto rounded-xl border border-slate-100 bg-white">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                    <th className="px-4 py-3">Dia</th>
                    <th className="px-4 py-3 text-right">Faturamento</th>
                    <th className="px-4 py-3 text-right">Despesas</th>
                    <th className="px-4 py-3 text-right">Lucro</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyDaily.map((row) => {
                    const wd = WEEKDAY_SHORT[localDateFromISO(row.business_date).getDay()]
                    return (
                      <tr key={row.business_date} className="border-b border-slate-50 hover:bg-slate-50/80">
                        <td className="px-4 py-2.5">
                          <span className="font-semibold text-slate-900">{wd}</span>
                          <span className="ml-2 text-slate-600">{formatDateBR(row.business_date)}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-emerald-800">{formatMoney(row.entradas_total)}</td>
                        <td className="px-4 py-2.5 text-right text-rose-700">{formatMoney(row.expenses)}</td>
                        <td className={`px-4 py-2.5 text-right font-bold ${(row.lucro || 0) < 0 ? 'text-rose-700' : 'text-slate-900'}`}>{formatMoney(row.lucro)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-bold text-slate-800">Semana — entradas × despesas por dia</h3>
              <div className="mt-3 overflow-x-auto pb-2">
                <div className="flex min-h-[180px] min-w-[280px] items-end gap-1.5 border-b border-slate-100 px-1 pt-4">
                  {weeklyDaily.map((d) => {
                    const hEnt = Math.round(((d.entradas_total || 0) / weeklyChartMax) * 100)
                    const hExp = Math.round(((d.expenses || 0) / weeklyChartMax) * 100)
                    return (
                      <div key={d.business_date} className="flex min-w-[36px] flex-1 flex-col items-center gap-1">
                        <div className="flex h-40 w-full items-end justify-center gap-0.5">
                          <div
                            className="w-1/2 max-w-[14px] rounded-t bg-emerald-500"
                            style={{ height: `${Math.max(hEnt, d.entradas_total > 0 ? 4 : 0)}%` }}
                            title={`Entradas ${formatMoney(d.entradas_total)}`}
                          />
                          <div
                            className="w-1/2 max-w-[14px] rounded-t bg-rose-500"
                            style={{ height: `${Math.max(hExp, d.expenses > 0 ? 4 : 0)}%` }}
                            title={`Despesas ${formatMoney(d.expenses)}`}
                          />
                        </div>
                        <span className="text-center text-[9px] font-medium text-slate-600">{WEEKDAY_SHORT[localDateFromISO(d.business_date).getDay()]}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {!loading && totals && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase text-emerald-800">Faturamento caixa</p>
              <p className="mt-2 text-2xl font-black text-emerald-900">{formatMoney(totals.sales_comandas)}</p>
            </div>
            <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase text-teal-800">Online (entregue)</p>
              <p className="mt-2 text-2xl font-black text-teal-900">{formatMoney(totals.sales_online)}</p>
            </div>
            <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase text-sky-800">Entradas manuais</p>
              <p className="mt-2 text-2xl font-black text-sky-900">{formatMoney(totals.income_manual)}</p>
            </div>
            <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase text-rose-800">Despesas</p>
              <p className="mt-2 text-2xl font-black text-rose-900">{formatMoney(totals.expenses)}</p>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-900 p-6 text-white shadow-lg">
              <p className="text-xs font-bold uppercase text-white/70">Entradas totais no período</p>
              <p className="mt-2 text-3xl font-black tracking-tight">{formatMoney(totals.entradas_total)}</p>
              <p className="mt-2 text-sm text-white/80">Caixa + online + manual</p>
            </div>
            <div className="rounded-2xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-600 to-emerald-800 p-6 text-white shadow-lg">
              <p className="text-xs font-bold uppercase text-emerald-100">Lucro estimado</p>
              <p className="mt-2 text-3xl font-black tracking-tight">{formatMoney(totals.lucro)}</p>
              <p className="mt-2 text-sm text-emerald-100">Entradas totais − despesas</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Entradas × despesas por dia</h2>
            <p className="mt-1 text-xs text-slate-500">Verde = entradas do dia · Vermelho = despesas (afeta o lucro nos gráficos acima)</p>
            {daily.length === 0 ? (
              <p className="mt-6 text-sm text-slate-500">Sem dados no período.</p>
            ) : (
              <div className="mt-6 overflow-x-auto pb-2">
                <div className="flex min-h-[220px] min-w-[320px] items-end gap-2 border-b border-slate-100 px-1 pt-4">
                  {daily.map((d) => {
                    const hEnt = Math.round(((d.entradas_total || 0) / chartMax) * 100)
                    const hExp = Math.round(((d.expenses || 0) / chartMax) * 100)
                    return (
                      <div key={d.business_date} className="flex min-w-[40px] flex-1 flex-col items-center gap-2">
                        <div className="flex h-44 w-full items-end justify-center gap-1">
                          <div
                            className="w-1/2 max-w-[18px] rounded-t bg-emerald-500"
                            style={{ height: `${Math.max(hEnt, d.entradas_total > 0 ? 4 : 0)}%` }}
                            title={`Entradas ${formatMoney(d.entradas_total)}`}
                          />
                          <div
                            className="w-1/2 max-w-[18px] rounded-t bg-rose-500"
                            style={{ height: `${Math.max(hExp, d.expenses > 0 ? 4 : 0)}%` }}
                            title={`Despesas ${formatMoney(d.expenses)}`}
                          />
                        </div>
                        <span className="text-center text-[10px] font-medium text-slate-600">{formatDateBR(d.business_date).slice(0, 5)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Lucro por dia</h2>
            {daily.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">Sem dados.</p>
            ) : (
              <div className="mt-6 overflow-x-auto">
                <div className="flex min-h-[160px] min-w-[320px] items-end gap-2 border-b border-slate-50 px-1 pt-4">
                  {daily.map((d) => {
                    const maxLucro = Math.max(...daily.map((x) => Math.abs(x.lucro)), 1)
                    const neg = d.lucro < 0
                    const h = Math.round((Math.abs(d.lucro) / maxLucro) * 100)
                    return (
                      <div key={d.business_date} className="flex min-w-[40px] flex-1 flex-col items-center gap-2">
                        <div className="flex h-32 w-full items-end justify-center">
                          <div
                            className={`w-2/3 max-w-[22px] rounded-t ${neg ? 'bg-rose-600' : 'bg-emerald-600'}`}
                            style={{ height: `${Math.max(h, d.lucro !== 0 ? 6 : 0)}%` }}
                            title={`${formatDateBR(d.business_date)}: ${formatMoney(d.lucro)}`}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500">{formatDateBR(d.business_date).slice(0, 5)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        </>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={addExpense} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-bold text-slate-900">Nova despesa</h3>
          <p className="mt-1 text-xs text-slate-500">Integrada aos totais e gráficos desta página.</p>
          <label className="mt-4 block text-sm text-slate-700">
            Dia operacional
            <input type="date" value={expBd} onChange={(e) => setExpBd(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" required />
          </label>
          <label className="mt-3 block text-sm text-slate-700">
            Descrição
            <input value={expDesc} onChange={(e) => setExpDesc(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" placeholder="Ex.: Fornecedor, aluguel…" required />
          </label>
          <label className="mt-3 block text-sm text-slate-700">
            Valor (R$)
            <input type="number" min="0" step="0.01" value={expVal} onChange={(e) => setExpVal(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" required />
          </label>
          <button type="submit" className="btn btn-primary mt-4 w-full font-semibold" disabled={saving}>
            Salvar despesa
          </button>
        </form>

        <form onSubmit={addIncome} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-bold text-slate-900">Outra entrada (manual)</h3>
          <p className="mt-1 text-xs text-slate-500">Eventos fora do caixa, etc.</p>
          <label className="mt-4 block text-sm text-slate-700">
            Dia operacional
            <input type="date" value={incBd} onChange={(e) => setIncBd(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" required />
          </label>
          <label className="mt-3 block text-sm text-slate-700">
            Descrição
            <input value={incDesc} onChange={(e) => setIncDesc(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" required />
          </label>
          <label className="mt-3 block text-sm text-slate-700">
            Valor (R$)
            <input type="number" min="0" step="0.01" value={incVal} onChange={(e) => setIncVal(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" required />
          </label>
          <button type="submit" className="btn btn-primary mt-4 w-full font-semibold" disabled={saving}>
            Salvar entrada
          </button>
        </form>
      </section>

      {entries && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900">Lançamentos manuais no período</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-3 pr-3">Tipo</th>
                  <th className="py-3 pr-3">Data</th>
                  <th className="py-3 pr-3">Descrição</th>
                  <th className="py-3 pr-3 text-right">Valor</th>
                  <th className="py-3" />
                </tr>
              </thead>
              <tbody>
                {entries.expenses?.map((row) => (
                  <tr key={`e-${row.id}`} className="border-b border-slate-100">
                    <td className="py-2.5 pr-3 font-medium text-rose-700">Despesa</td>
                    <td className="py-2.5 pr-3 text-slate-700">{formatDateBR(row.business_date)}</td>
                    <td className="py-2.5 pr-3 text-slate-800">{row.description}</td>
                    <td className="py-2.5 pr-3 text-right font-semibold">{formatMoney(row.amount)}</td>
                    <td className="py-2.5 text-right">
                      <button type="button" className="text-xs font-medium text-red-600 hover:underline" onClick={() => void removeExpense(row.id)}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
                {entries.income_manual?.map((row) => (
                  <tr key={`i-${row.id}`} className="border-b border-slate-100">
                    <td className="py-2.5 pr-3 font-medium text-emerald-700">Entrada</td>
                    <td className="py-2.5 pr-3 text-slate-700">{formatDateBR(row.business_date)}</td>
                    <td className="py-2.5 pr-3 text-slate-800">{row.description}</td>
                    <td className="py-2.5 pr-3 text-right font-semibold">{formatMoney(row.amount)}</td>
                    <td className="py-2.5 text-right">
                      <button type="button" className="text-xs font-medium text-red-600 hover:underline" onClick={() => void removeIncome(row.id)}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
                {!entries.expenses?.length && !entries.income_manual?.length && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-500">
                      Nenhum lançamento manual neste período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {loading && !totals && <p className="text-slate-500">Carregando…</p>}
    </div>
  )
}
