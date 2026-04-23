import { useState, useEffect, useMemo } from 'react'
import { getCategories, getItems, getEspetinhos, createPedido } from '../api'
import {
  lancheComOpcionaisAdicionais,
  itemAceitaCebolaCaramelizada,
  itemAceitaHamburguerExtra,
  PRECO_CEbola_CARAMELIZADA,
  PRECO_HAMBURGUER_EXTRA
} from '../utils/lancheAddons'

const CAIXA_SLUGS = [
  'espetinhos', 'porcoes', 'lanches', 'bebidas', 'caipirinhas', 'chopp-cerveja',
  'acompanhamentos', 'doses', 'pratos', 'sobremesas', 'drinks',
]
const MEAT_POINTS = ['mal passado', 'ao ponto', 'bem passado']
const DOSE_STANDALONE = new Set(['Red Bull', 'Coca-Cola 350ml'])
const DOSE_ACCOMP = ['Gelo de coco']

/**
 * Lançamento rápido no card de pagamento do caixa (sem ir à tela Garçom).
 */
export default function CaixaQuickAdd({ comandaId, comandaStatus, onItemAdded }) {
  const closed = String(comandaStatus || '').toLowerCase() === 'closed'
  const [categories, setCategories] = useState([])
  const [catId, setCatId] = useState(null)
  const [slug, setSlug] = useState('')
  const [items, setItems] = useState([])
  const [espetinhos, setEspetinhos] = useState([])
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [modal, setModal] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    getCategories().then((l) => setCategories(l.filter((c) => CAIXA_SLUGS.includes(c.slug))))
    getEspetinhos().then(setEspetinhos)
  }, [])

  useEffect(() => {
    if (!catId) {
      setItems([])
      return
    }
    getItems(catId).then(setItems)
  }, [catId])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) => String(i.name || '').toLowerCase().includes(q))
  }, [items, search])

  const submit = async (opts) => {
    const { item, quantity = 1, meat_point, caipirinha_base, caipirinha_picole, dose_accompaniment, prato_feito_espetinho_id, extra_caramelized_onion, extra_hamburger } = opts
    const cid = Number(comandaId)
    if (!Number.isFinite(cid)) return
    setBusy(true)
    setErr('')
    try {
      await createPedido({
        comanda_id: cid,
        item_id: item.id,
        quantity: Math.max(1, Math.min(999, Number(quantity) || 1)),
        meat_point: meat_point || undefined,
        caipirinha_base: caipirinha_base || undefined,
        caipirinha_picole: caipirinha_picole ? 1 : 0,
        dose_accompaniment: dose_accompaniment || undefined,
        prato_feito_espetinho_id: prato_feito_espetinho_id != null ? Number(prato_feito_espetinho_id) || undefined : undefined,
        extra_caramelized_onion: extra_caramelized_onion ? 1 : 0,
        extra_hamburger: extra_hamburger ? 1 : 0
      })
      setModal(null)
      await onItemAdded()
    } catch (e) {
      setErr(e?.message || 'Falha ao lançar')
    } finally {
      setBusy(false)
    }
  }

  const pickCategory = (c) => {
    setCatId(c.id)
    setSlug(String(c.slug || ''))
    setSearch('')
  }

  const onItemClick = (item) => {
    if (closed) return
    const needPf = Number(item.is_prato_feito) === 1
    const needMeat = Number(item.requires_meat_point) === 1 || slug === 'lanches'
    const needCai = slug === 'caipirinhas'
    const needDose = slug === 'doses' && !DOSE_STANDALONE.has(item.name)
    if (needPf) {
      setModal({ item, step: 'prato', pfId: null })
      return
    }
    if (needMeat) {
      if (lancheComOpcionaisAdicionais(item, slug)) {
        setModal({
          item,
          step: 'meat',
          meat: 'ao ponto',
          extra_caramelized_onion: false,
          extra_hamburger: false
        })
      } else {
        setModal({ item, step: 'meat', meat: 'ao ponto' })
      }
      return
    }
    if (needCai) {
      void submit({ item, caipirinha_base: 'Cachaça', caipirinha_picole: 0 })
      return
    }
    if (needDose) {
      setModal({ item, step: 'dose', dose: DOSE_ACCOMP[0] })
      return
    }
    void submit({ item })
  }

  if (closed) return null

  return (
    <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-white p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between text-left"
      >
        <span>
          <span className="text-sm font-bold text-emerald-900">Lançar produtos</span>
          <span className="ml-2 text-xs text-emerald-700/90">(caixa — sem ir em Garçom)</span>
        </span>
        <span className="text-emerald-700">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <div className="mt-3 space-y-3 border-t border-emerald-100 pt-3">
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => pickCategory(c)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                  catId === c.id ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
          {catId && (
            <>
              <input
                type="search"
                placeholder="Buscar produto…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
              />
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-100 bg-white p-1">
                {filteredItems.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onItemClick(item)}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-emerald-50 disabled:opacity-50"
                    >
                      <span className="text-slate-800">{item.name}</span>
                      <span className="shrink-0 text-xs text-slate-500">
                        {Number(item.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </button>
                  </li>
                ))}
                {filteredItems.length === 0 && <li className="px-2 py-3 text-center text-xs text-slate-500">Nenhum item</li>}
              </ul>
            </>
          )}
        </div>
      )}

      {modal?.step === 'meat' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h4 className="font-semibold text-slate-800">{modal.item.name}</h4>
            <p className="mt-1 text-xs text-slate-500">Ponto da carne</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {MEAT_POINTS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModal({ ...modal, meat: m })}
                  className={`rounded-lg px-3 py-2 text-sm ${modal.meat === m ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-800'}`}
                >
                  {m}
                </button>
              ))}
            </div>
            {lancheComOpcionaisAdicionais(modal.item, slug) && (
              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                {itemAceitaCebolaCaramelizada(modal.item) && (
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={!!modal.extra_caramelized_onion}
                      onChange={(e) => setModal((prev) => (prev ? { ...prev, extra_caramelized_onion: e.target.checked } : null))}
                    />
                    <span>Cebola caramelizada (+ R$ {PRECO_CEbola_CARAMELIZADA.toFixed(2).replace('.', ',')})</span>
                  </label>
                )}
                {itemAceitaHamburguerExtra(modal.item) && (
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={!!modal.extra_hamburger}
                      onChange={(e) => setModal((prev) => (prev ? { ...prev, extra_hamburger: e.target.checked } : null))}
                    />
                    <span>Hambúrguer extra (+ R$ {PRECO_HAMBURGUER_EXTRA.toFixed(2).replace('.', ',')})</span>
                  </label>
                )}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button type="button" className="btn btn-secondary flex-1" onClick={() => setModal(null)} disabled={busy}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1"
                disabled={busy}
                onClick={() =>
                  submit({
                    item: modal.item,
                    meat_point: modal.meat,
                    extra_caramelized_onion: modal.extra_caramelized_onion,
                    extra_hamburger: modal.extra_hamburger
                  })
                }
              >
                Lançar
              </button>
            </div>
          </div>
        </div>
      )}

      {(modal?.step === 'prato' || modal?.step === 'meat_pf') && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="flex max-h-[min(90vh,520px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-100 p-4">
              <h4 className="font-semibold text-slate-800">{modal.item.name}</h4>
              <p className="text-xs text-slate-500">
                {modal.step === 'meat_pf' ? 'Ponto do espetinho do prato feito' : 'Escolha o espetinho do prato feito'}
              </p>
            </div>
            {modal.step === 'prato' && (
              <ul className="min-h-0 flex-1 overflow-y-auto p-2">
                {espetinhos.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm ${Number(modal.pfId) === e.id ? 'bg-amber-100 font-medium' : 'hover:bg-slate-50'}`}
                      onClick={() => setModal({ ...modal, pfId: e.id })}
                    >
                      {e.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {modal.step === 'meat_pf' && (
              <div className="p-4">
                <div className="mb-3 flex flex-wrap gap-2">
                  {MEAT_POINTS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModal({ ...modal, meat: m })}
                      className={`rounded-lg px-3 py-2 text-sm ${modal.meat === m ? 'bg-amber-500 text-white' : 'bg-slate-100'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 border-t border-slate-100 p-4">
              {modal.step === 'prato' ? (
                <>
                  <button type="button" className="btn btn-secondary flex-1" onClick={() => setModal(null)} disabled={busy}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary flex-1"
                    disabled={busy || !modal.pfId}
                    onClick={() => {
                      const esp = espetinhos.find((e) => Number(e.id) === Number(modal.pfId))
                      if (esp && Number(esp.requires_meat_point) === 1) {
                        setModal({ ...modal, step: 'meat_pf', meat: 'ao ponto' })
                      } else {
                        void submit({ item: modal.item, prato_feito_espetinho_id: modal.pfId })
                      }
                    }}
                  >
                    Continuar
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-secondary flex-1" onClick={() => setModal({ ...modal, step: 'prato' })} disabled={busy}>
                    Voltar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary flex-1"
                    disabled={busy}
                    onClick={() =>
                      submit({
                        item: modal.item,
                        prato_feito_espetinho_id: modal.pfId,
                        meat_point: modal.meat,
                      })
                    }
                  >
                    Lançar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {modal?.step === 'dose' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h4 className="font-semibold text-slate-800">{modal.item.name}</h4>
            <p className="mt-2 text-xs text-slate-500">Acompanhamento da dose</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {DOSE_ACCOMP.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setModal({ ...modal, dose: d })}
                  className={`rounded-lg px-3 py-2 text-sm ${modal.dose === d ? 'bg-amber-500 text-white' : 'bg-slate-100'}`}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" className="btn btn-secondary flex-1" onClick={() => setModal(null)} disabled={busy}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1"
                disabled={busy}
                onClick={() => submit({ item: modal.item, dose_accompaniment: modal.dose })}
              >
                Lançar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
