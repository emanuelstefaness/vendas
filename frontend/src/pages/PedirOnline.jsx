import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getApiBase } from '../devApiBase'

const API = getApiBase()
const BEBIDAS_SLUGS = ['bebidas', 'caipirinhas']
const HIDDEN_CATEGORY_SLUGS = ['chopp-cerveja', 'drinks', 'doses']
const IMAGE_FILE_BY_ITEM_NAME = {
  'churraspao': 'churraspao.jpg',
  'coracao de frango': 'coração.png',
  'entrevero': 'entrevero',
  'gado com bacon': 'gadobacon.png',
  'medalhao suino': 'medalhaosuino.png',
  'pao de alho': 'pao de alho.png',
  'prato feito do bosque': 'pratofeito.png',
  'queijo coalho': 'queijocoalho.png',
  'salada do bosque': 'salada do bosque.jpg',
  'x-bosque': 'xbosque.jpg'
}

const formatPrice = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const normalize = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const bySort = (a, b) => (a.sort_order || 0) - (b.sort_order || 0)

const slugOrder = ['espetinhos', 'lanches', 'pratos', 'porcoes']

function isPratoFeitoItem(item) {
  if (!item) return false
  // API/SQLite pode mandar 1, "1", true; comparação solta cobre todos
  if (item.is_prato_feito == 1 || item.is_prato_feito === true) return true
  const n = normalize(item.name)
  return n.includes('prato') && n.includes('feito')
}

function getItemImageUrl(apiBase, itemName) {
  const fileName = IMAGE_FILE_BY_ITEM_NAME[normalize(itemName)]
  if (!fileName) return null
  return `${apiBase}/api/public/cardapio-img/${encodeURIComponent(fileName)}`
}

function ProductCard({ item, badges = [], highlight, onOpen }) {
  return (
    <article
      onClick={() => onOpen(item)}
      className="group cursor-pointer border-b border-slate-200 bg-white py-4"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xl font-semibold text-slate-900">{item.name}</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">
            {item.description || 'Delicioso, preparado na hora com ingredientes selecionados.'}
          </p>
          {badges.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {badges.map((b) => (
                <span key={b} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                  {b}
                </span>
              ))}
            </div>
          )}
          <p className="mt-2 text-lg font-semibold text-slate-800">{formatPrice(item.price)}</p>
        </div>
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100">
          {item.image ? (
            <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
              <span className="text-3xl font-bold text-slate-400">{item.name?.charAt(0) || '🍽️'}</span>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function ComboCard({ combo, onRequestAddCombo }) {
  return (
    <article className="rounded-2xl border border-amber-200 bg-combo p-4 shadow-card">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-black text-[hsl(var(--menu-fg))]">{combo.emoji} {combo.name}</h3>
          <p className="text-sm text-slate-700">{combo.description}</p>
        </div>
        {combo.badge && <span className="rounded-lg bg-emerald-100 px-2 py-1 text-xs font-bold text-savings">{combo.badge}</span>}
      </div>
      <ul className="mb-3 space-y-1 text-sm text-slate-700">
        {combo.items.map((i) => <li key={i} className="before:mr-2 before:text-red-500 before:content-['•']">{i}</li>)}
      </ul>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <p className="text-sm text-slate-500 line-through">{formatPrice(combo.originalPrice)}</p>
          <p className="font-display text-2xl font-black text-[hsl(var(--menu-primary))]">{formatPrice(combo.price)}</p>
        </div>
        <button
          type="button"
          onClick={() => onRequestAddCombo(combo)}
          className="rounded-xl bg-[hsl(var(--menu-primary))] px-4 py-3 font-bold text-white transition hover:brightness-95 active:scale-95"
        >
          Adicionar combo
        </button>
      </div>
    </article>
  )
}

export default function PedirOnline() {
  const [step, setStep] = useState('menu')
  const [menu, setMenu] = useState({ categories: [], items: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [lastOrder, setLastOrder] = useState(null)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [modalProduct, setModalProduct] = useState(null)
  const [modalQty, setModalQty] = useState(1)
  const [modalObs, setModalObs] = useState('')
  const [modalPfEspetinhoId, setModalPfEspetinhoId] = useState('')
  const [comboModal, setComboModal] = useState(null)
  const [comboPfSelections, setComboPfSelections] = useState({})
  const [lastSuggestedAddedId, setLastSuggestedAddedId] = useState(null)
  const [cart, setCart] = useState([])
  const [activeCatId, setActiveCatId] = useState(null)
  const [checkout, setCheckout] = useState({
    tipo: 'retirada',
    cliente_nome: '',
    cliente_telefone: '',
    cliente_email: '',
    observacoes: '',
    endereco_rua: '',
    endereco_numero: '',
    endereco_complemento: '',
    endereco_bairro: '',
    endereco_referencia: '',
  })

  const apiBase = API || (typeof window !== 'undefined' ? window.location.origin : '')

  const loadMenu = () => {
    setLoading(true)
    setError('')
    fetch(`${apiBase}/api/public/menu`)
      .then((r) => {
        if (!r.ok) throw new Error(`Não foi possível carregar o cardápio (${r.status})`)
        return r.json()
      })
      .then((data) => {
        const items = (data.items || []).map((it) => ({
          ...it,
          image: getItemImageUrl(apiBase, it.name)
        }))
        setMenu({ ...data, items })
      })
      .catch((err) => setError(err.message || 'Erro ao carregar cardápio'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadMenu() }, [])

  const categoriesBySlug = useMemo(() => {
    const m = {}
    for (const c of menu.categories || []) {
      if (HIDDEN_CATEGORY_SLUGS.includes(c.slug)) continue
      m[c.slug] = c
    }
    return m
  }, [menu.categories])

  const itemsByCategory = useMemo(() => {
    const map = new Map()
    for (const it of menu.items || []) {
      const cat = (menu.categories || []).find((c) => c.id === it.category_id)
      if (cat && HIDDEN_CATEGORY_SLUGS.includes(cat.slug)) continue
      const list = map.get(it.category_id) || []
      list.push(it)
      map.set(it.category_id, list)
    }
    return map
  }, [menu.items, menu.categories])

  const orderedCategories = useMemo(() => {
    const fixed = slugOrder
      .map((slug) => categoriesBySlug[slug])
      .filter(Boolean)
    const filteredCategories = (menu.categories || []).filter((c) => !HIDDEN_CATEGORY_SLUGS.includes(c.slug))
    const bebidas = filteredCategories.filter((c) => BEBIDAS_SLUGS.includes(c.slug)).sort(bySort)
    const rest = filteredCategories.filter((c) => !fixed.find((x) => x.id === c.id) && !BEBIDAS_SLUGS.includes(c.slug)).sort(bySort)
    return [...fixed, ...rest, ...bebidas]
  }, [menu.categories, categoriesBySlug])

  const espetinhosOnline = useMemo(() => {
    const espetinhosCat = (menu.categories || []).find((c) => c.slug === 'espetinhos')
    if (!espetinhosCat) return []
    return (menu.items || [])
      .filter((i) => i.category_id === espetinhosCat.id)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
  }, [menu.categories, menu.items])

  useEffect(() => {
    if (!activeCatId && orderedCategories.length > 0) {
      setActiveCatId(orderedCategories[0].id)
    }
  }, [orderedCategories, activeCatId])

  const highlightItems = useMemo(() => {
    const all = menu.items || []
    const espetoTop = all.find((i) => normalize(i.name).includes('gado') && normalize(i.name).includes('bacon'))
    const pratoFeito = all.find((i) => normalize(i.name).includes('prato') && normalize(i.name).includes('feito'))
    const churraspao = all.find((i) => normalize(i.name).includes('churraspao') || normalize(i.name).includes('churras pao'))
    return [espetoTop, pratoFeito, churraspao].filter(Boolean)
  }, [menu.items])

  const combos = useMemo(() => {
    const all = menu.items || []
    const pratoFeito = all.find((i) => normalize(i.name).includes('prato') && normalize(i.name).includes('feito'))
    const churraspao = all.find((i) => normalize(i.name).includes('churraspao') || normalize(i.name).includes('churras pao'))
    const coca = all.find((i) => normalize(i.name).includes('coca')) || all.find((i) => normalize(i.name).includes('refrigerante'))

    const makeCombo = (id, name, emoji, products, discountPercent) => {
      if (products.some((p) => !p)) return null
      // Índices no combo onde entra o mesmo item do "Prato Feito" do cardápio (não depende só de is_prato_feito no JSON)
      const pfSlots = []
      if (pratoFeito) {
        products.forEach((p, i) => {
          if (p && Number(p.id) === Number(pratoFeito.id)) pfSlots.push(i)
        })
      }
      const original = products.reduce((s, p) => s + Number(p.price || 0), 0)
      const rawDiscounted = Number((original * (1 - discountPercent / 100)).toFixed(2))
      const maxSavings = 8
      const minAllowedPrice = Number((original - maxSavings).toFixed(2))
      const discounted = Math.max(rawDiscounted, minAllowedPrice)
      const save = Number((original - discounted).toFixed(2))
      return {
        id,
        name,
        emoji,
        products,
        pfSlots,
        description: 'Preço especial no combo para aumentar seu custo-benefício.',
        items: products.map((p) => p.name),
        originalPrice: original,
        price: discounted,
        badge: save > 0 ? `Economize ${formatPrice(save)}` : null,
      }
    }

    return [
      makeCombo('combo-pf-churraspao', 'Combo PF + Churraspão + Coca', '🔥', [pratoFeito, churraspao, coca], 12),
      makeCombo('combo-2-churraspao', 'Combo 2 Churraspão + 2 Coca', '🥖', [churraspao, churraspao, coca, coca], 15),
      makeCombo('combo-2-pf', 'Combo 2 PF + 2 Coca', '🍛', [pratoFeito, pratoFeito, coca, coca], 15),
    ].filter(Boolean)
  }, [menu.items, categoriesBySlug])

  const totalItems = cart.reduce((s, i) => s + i.quantity, 0)
  const totalPrice = cart.reduce((s, i) => s + i.price * i.quantity, 0)

  const suggestedItems = useMemo(() => {
    if (!modalProduct) return []
    const all = menu.items || []
    const selectedName = normalize(modalProduct.name)
    const coca = all.find((i) => normalize(i.name).includes('coca')) || all.find((i) => normalize(i.name).includes('refrigerante'))
    const batata = all.find((i) => normalize(i.name).includes('batata'))
    const molho = all.find((i) => normalize(i.name).includes('molho'))
    const churraspao = all.find((i) => normalize(i.name).includes('churraspao') || normalize(i.name).includes('churras pao'))
    const pratoFeito = all.find((i) => normalize(i.name).includes('prato') && normalize(i.name).includes('feito'))

    let picks = [coca, batata, molho]
    if (selectedName.includes('churraspao')) picks = [coca, batata, pratoFeito]
    if (selectedName.includes('prato') && selectedName.includes('feito')) picks = [coca, batata, churraspao]
    if (selectedName.includes('espetinho') || selectedName.includes('gado')) picks = [coca, batata, molho]
    return picks.filter(Boolean).filter((i) => i.id !== modalProduct.id).slice(0, 3)
  }, [modalProduct, menu.items])

  useEffect(() => {
    if (!modalProduct) return
    setModalQty(1)
    setModalObs('')
    setModalPfEspetinhoId('')
  }, [modalProduct])

  const addItem = (item, quantity = 1, observations = null, fixedPrice = null, pratoFeitoEspetinhoId = null) => {
    setCart((prev) => {
      const idx = prev.findIndex((x) =>
        x.id === item.id &&
        (x.observations || '') === (observations || '') &&
        Number(x.prato_feito_espetinho_id || 0) === Number(pratoFeitoEspetinhoId || 0)
      )
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity }
        return next
      }
      const pfSelected = Number(pratoFeitoEspetinhoId)
      const pfItem = pfSelected > 0 ? espetinhosOnline.find((e) => Number(e.id) === pfSelected) : null
      const obsMerged = pfItem
        ? `${observations ? `${observations} • ` : ''}PF com ${pfItem.name}`
        : (observations || null)
      return [...prev, {
        id: item.id,
        name: item.name,
        quantity,
        price: fixedPrice ?? Number(item.price),
        observations: obsMerged,
        prato_feito_espetinho_id: pfSelected > 0 ? pfSelected : null
      }]
    })
  }

  const addFromModal = () => {
    if (!modalProduct) return
    const isPratoFeito = isPratoFeitoItem(modalProduct)
    if (isPratoFeito && !Number(modalPfEspetinhoId)) {
      setError('Selecione o espetinho que acompanha o Prato Feito.')
      return
    }
    setError('')
    const obs = modalObs.trim()
    const composed = obs || null
    addItem(modalProduct, modalQty, composed, null, isPratoFeito ? Number(modalPfEspetinhoId) : null)
    setModalProduct(null)
    setModalQty(1)
    setModalObs('')
    setModalPfEspetinhoId('')
  }

  const addSuggested = (item) => {
    if (!modalProduct) return
    addItem(item, 1, null)
    setLastSuggestedAddedId(item.id)
    setTimeout(() => setLastSuggestedAddedId(null), 900)
  }

  const getCartQtyById = (itemId) => cart
    .filter((c) => c.id === itemId)
    .reduce((sum, c) => sum + c.quantity, 0)

  const addComboInternal = (combo, pfEspByIndex) => {
    const original = combo.products.reduce((s, p) => s + Number(p.price || 0), 0)
    const factor = original > 0 ? combo.price / original : 1
    combo.products.forEach((p, idx) => {
      const adjusted = Number((Number(p.price || 0) * factor).toFixed(2))
      let espOk = null
      if (pfEspByIndex && isPratoFeitoItem(p)) {
        const e = Number(pfEspByIndex[idx])
        if (Number.isFinite(e) && e > 0) espOk = e
      }
      addItem(p, 1, `Combo: ${combo.name}`, adjusted, espOk)
    })
  }

  const requestAddCombo = (combo) => {
    const pfIndices = Array.isArray(combo.pfSlots) && combo.pfSlots.length > 0
      ? combo.pfSlots
      : combo.products.map((p, i) => i).filter((i) => isPratoFeitoItem(combo.products[i]))
    if (pfIndices.length === 0) {
      addComboInternal(combo, null)
      return
    }
    const initial = {}
    pfIndices.forEach((i) => { initial[i] = '' })
    setError('')
    setComboPfSelections(initial)
    setComboModal(combo)
  }

  const confirmComboModal = () => {
    if (!comboModal) return
    const pfIndices = Array.isArray(comboModal.pfSlots) && comboModal.pfSlots.length > 0
      ? comboModal.pfSlots
      : comboModal.products.map((p, i) => i).filter((i) => isPratoFeitoItem(comboModal.products[i]))
    for (const i of pfIndices) {
      const v = comboPfSelections[i]
      if (!v || !Number(v)) {
        setError('Selecione o espetinho para cada Prato Feito do combo.')
        return
      }
    }
    setError('')
    const map = {}
    pfIndices.forEach((idx) => { map[idx] = Number(comboPfSelections[idx]) })
    addComboInternal(comboModal, map)
    setComboModal(null)
    setComboPfSelections({})
  }

  const updateQty = (id, observations, pratoFeitoEspetinhoId, delta) => {
    setCart((prev) => {
      const idx = prev.findIndex((x) =>
        x.id === id &&
        (x.observations || '') === (observations || '') &&
        Number(x.prato_feito_espetinho_id || 0) === Number(pratoFeitoEspetinhoId || 0)
      )
      if (idx < 0) return prev
      const next = [...prev]
      const q = next[idx].quantity + delta
      if (q <= 0) return prev.filter((_, i) => i !== idx)
      next[idx] = { ...next[idx], quantity: q }
      return next
    })
  }

  const clearCart = () => setCart([])

  const handleSubmitOrder = async (e) => {
    e.preventDefault()
    if (!checkout.cliente_nome.trim() || !checkout.cliente_telefone.trim()) {
      setError('Nome e telefone são obrigatórios.')
      return
    }
    if (checkout.tipo === 'delivery' && (!checkout.endereco_rua.trim() || !checkout.endereco_numero.trim() || !checkout.endereco_bairro.trim())) {
      setError('Para delivery, informe rua, número e bairro.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const r = await fetch(`${apiBase}/api/public/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: checkout.tipo,
          cliente_nome: checkout.cliente_nome.trim(),
          cliente_telefone: checkout.cliente_telefone.trim(),
          cliente_email: checkout.cliente_email.trim() || undefined,
          observacoes: checkout.observacoes.trim() || undefined,
          endereco_rua: checkout.tipo === 'delivery' ? checkout.endereco_rua.trim() : undefined,
          endereco_numero: checkout.tipo === 'delivery' ? checkout.endereco_numero.trim() : undefined,
          endereco_complemento: checkout.tipo === 'delivery' ? checkout.endereco_complemento.trim() : undefined,
          endereco_bairro: checkout.tipo === 'delivery' ? checkout.endereco_bairro.trim() : undefined,
          endereco_referencia: checkout.tipo === 'delivery' ? checkout.endereco_referencia.trim() : undefined,
          items: cart.map((c) => ({
            item_id: c.id,
            quantity: c.quantity,
            observations: c.observations || null,
            prato_feito_espetinho_id: c.prato_feito_espetinho_id || null
          })),
        }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data.error || `Falha ao enviar pedido (${r.status})`)
      setLastOrder(data)
      setStep('done')
      setIsCartOpen(false)
    } catch (err) {
      setError(err.message || 'Erro ao enviar pedido.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="menu-bg flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <div className="mx-auto mb-3 h-11 w-11 animate-spin rounded-full border-4 border-[hsl(var(--menu-primary))] border-t-transparent" />
          <p className="font-display text-lg font-extrabold text-[hsl(var(--menu-fg))]">Carregando cardápio...</p>
        </div>
      </div>
    )
  }

  if (step === 'done' && lastOrder) {
    return (
      <div className="menu-bg min-h-screen p-5">
        <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-card">
          <h1 className="text-3xl font-bold text-slate-900">Pedido confirmado</h1>
          <p className="mt-2 text-slate-700">Pedido #{lastOrder.id}</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{formatPrice(lastOrder.valor_total)}</p>
          <p className="mt-3 text-slate-600">{lastOrder.message}</p>
          <button
            type="button"
            onClick={() => { setStep('menu'); setLastOrder(null); setCart([]) }}
            className="mt-5 w-full rounded-xl bg-[hsl(var(--menu-primary))] py-3 font-bold text-white"
          >
            Fazer outro pedido
          </button>
          <Link to="/" className="mt-3 block text-sm text-slate-600 hover:underline">Voltar ao início</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-50 pb-28 text-slate-900">
      <div className="sticky top-0 z-40 w-full border-b border-slate-800 bg-black shadow-lg">
        <header className="px-4 py-4 text-white">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
            <h1 className="text-lg font-semibold tracking-wide">Bosque da Carne</h1>
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="shrink-0 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium"
            >
              Carrinho ({totalItems})
            </button>
          </div>
          <p className="mx-auto mt-1 w-full max-w-5xl text-xs text-slate-300">Pedidos online</p>
        </header>
        {step === 'menu' && (
          <nav className="no-scrollbar mx-auto flex w-full max-w-5xl gap-5 overflow-x-auto border-t border-slate-200 bg-white px-4 py-3">
            {orderedCategories.map((c) => (
              <a
                key={c.id}
                href={`#cat-${c.id}`}
                onClick={() => setActiveCatId(c.id)}
                className={`shrink-0 border-b-2 pb-1 text-sm font-semibold ${activeCatId === c.id ? 'border-red-600 text-red-600' : 'border-transparent text-slate-700'}`}
              >
                {c.name}
              </a>
            ))}
          </nav>
        )}
      </div>

      {step === 'menu' && (
        <main className="mx-auto mt-5 w-full max-w-5xl px-4">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
              <button type="button" onClick={loadMenu} className="ml-2 rounded bg-red-100 px-2 py-1 font-semibold">Tentar novamente</button>
            </div>
          )}

          <section className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <span>⭐</span>
              <h2 className="text-xl font-semibold">Destaque da Casa</h2>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3">
              {highlightItems.map((item) => (
                <ProductCard
                  key={`highlight-${item.id}`}
                  item={item}
                  highlight
                  badges={normalize(item.name).includes('bacon') ? ['🔥 MAIS PEDIDO', '⭐ FAVORITO'] : ['⭐ FAVORITO']}
                  onOpen={setModalProduct}
                />
              ))}
            </div>
          </section>

          {combos.length > 0 && (
            <section className="mb-8">
              <div className="mb-3 flex items-center gap-2">
                <span>📦</span>
                <h2 className="text-xl font-semibold">Combos</h2>
              </div>
              <div className="space-y-3">
                {combos.map((combo) => <ComboCard key={combo.id} combo={combo} onRequestAddCombo={requestAddCombo} />)}
              </div>
            </section>
          )}

          {orderedCategories.map((cat) => {
            const items = itemsByCategory.get(cat.id) || []
            if (items.length === 0) return null
            return (
              <section id={`cat-${cat.id}`} key={cat.id} className="mb-6 scroll-mt-20">
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="text-xl font-semibold">{cat.name}</h2>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3">
                  {items.map((item) => {
                    const n = normalize(item.name)
                    const badges = []
                    if (n.includes('gado') && n.includes('bacon')) badges.push('🔥 MAIS PEDIDO')
                    if (n.includes('churraspao') || n.includes('prato feito')) badges.push('⭐ FAVORITO')
                    return <ProductCard key={item.id} item={item} badges={badges} highlight={n.includes('churraspao') || n.includes('prato feito')} onOpen={setModalProduct} />
                  })}
                </div>
              </section>
            )
          })}
        </main>
      )}

      {step === 'checkout' && (
        <main className="mx-auto mt-5 w-full max-w-5xl px-4">
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
            <h3 className="text-xl font-semibold">Seu Pedido ({totalItems})</h3>
            <ul className="mt-2 space-y-2 text-sm text-slate-700">
              {cart.map((c, i) => (
                <li key={`${c.id}-${c.observations || ''}-${i}`} className="flex justify-between gap-2">
                  <span>{c.quantity}x {c.name}</span>
                  <span className="font-semibold">{formatPrice(c.quantity * c.price)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t pt-3 text-lg font-bold">Total: {formatPrice(totalPrice)}</p>
          </div>

          <form onSubmit={handleSubmitOrder} className="space-y-4">
            {error && <p className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{error}</p>}
            <input className="w-full rounded-xl border px-4 py-3" placeholder="Nome completo *" required value={checkout.cliente_nome} onChange={(e) => setCheckout((c) => ({ ...c, cliente_nome: e.target.value }))} />
            <input className="w-full rounded-xl border px-4 py-3" placeholder="Telefone / WhatsApp *" required value={checkout.cliente_telefone} onChange={(e) => setCheckout((c) => ({ ...c, cliente_telefone: e.target.value }))} />
            <input className="w-full rounded-xl border px-4 py-3" placeholder="E-mail (opcional)" value={checkout.cliente_email} onChange={(e) => setCheckout((c) => ({ ...c, cliente_email: e.target.value }))} />

            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setCheckout((c) => ({ ...c, tipo: 'retirada' }))} className={`rounded-xl border px-4 py-3 font-semibold ${checkout.tipo === 'retirada' ? 'border-[hsl(var(--menu-primary))] bg-orange-50' : 'border-slate-300 bg-white'}`}>Retirada</button>
              <button type="button" onClick={() => setCheckout((c) => ({ ...c, tipo: 'delivery' }))} className={`rounded-xl border px-4 py-3 font-semibold ${checkout.tipo === 'delivery' ? 'border-[hsl(var(--menu-primary))] bg-orange-50' : 'border-slate-300 bg-white'}`}>Delivery</button>
            </div>

            {checkout.tipo === 'delivery' && (
              <div className="space-y-2 rounded-2xl border bg-white p-4">
                <input className="w-full rounded-xl border px-4 py-3" placeholder="Rua *" value={checkout.endereco_rua} onChange={(e) => setCheckout((c) => ({ ...c, endereco_rua: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <input className="w-full rounded-xl border px-4 py-3" placeholder="Número *" value={checkout.endereco_numero} onChange={(e) => setCheckout((c) => ({ ...c, endereco_numero: e.target.value }))} />
                  <input className="w-full rounded-xl border px-4 py-3" placeholder="Complemento" value={checkout.endereco_complemento} onChange={(e) => setCheckout((c) => ({ ...c, endereco_complemento: e.target.value }))} />
                </div>
                <input className="w-full rounded-xl border px-4 py-3" placeholder="Bairro *" value={checkout.endereco_bairro} onChange={(e) => setCheckout((c) => ({ ...c, endereco_bairro: e.target.value }))} />
                <input className="w-full rounded-xl border px-4 py-3" placeholder="Referência" value={checkout.endereco_referencia} onChange={(e) => setCheckout((c) => ({ ...c, endereco_referencia: e.target.value }))} />
              </div>
            )}

            <input className="w-full rounded-xl border px-4 py-3" placeholder="Observações (opcional)" value={checkout.observacoes} onChange={(e) => setCheckout((c) => ({ ...c, observacoes: e.target.value }))} />

            <button type="submit" disabled={submitting} className="w-full rounded-xl bg-black py-4 text-lg font-semibold text-white disabled:opacity-70">
              {submitting ? 'Enviando...' : `Confirmar pedido - ${formatPrice(totalPrice)}`}
            </button>
          </form>
        </main>
      )}

      {modalProduct && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center"
          onClick={() => {
            setModalProduct(null)
            setModalQty(1)
            setModalObs('')
            setModalPfEspetinhoId('')
          }}
        >
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-float sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-semibold">{modalProduct.name}</h3>
            {modalProduct.description && <p className="mt-1 text-sm text-slate-600">{modalProduct.description}</p>}
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatPrice(modalProduct.price)}</p>

            {isPratoFeitoItem(modalProduct) && (
              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-700">Escolha o espetinho do Prato Feito *</label>
                <select
                  className="w-full rounded-xl border px-4 py-3"
                  value={modalPfEspetinhoId}
                  onChange={(e) => setModalPfEspetinhoId(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {espetinhosOnline.map((esp) => (
                    <option key={esp.id} value={esp.id}>{esp.name}</option>
                  ))}
                </select>
              </div>
            )}

            <input className="mt-4 w-full rounded-xl border px-4 py-3" placeholder="Ponto da carne / observações" value={modalObs} onChange={(e) => setModalObs(e.target.value)} />

            {suggestedItems.length > 0 && (
              <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50/60 p-3">
                <p className="mb-2 text-sm font-semibold text-orange-800">Combina com</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedItems.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); addSuggested(s) }}
                      className="rounded-full border border-orange-200 bg-white px-3 py-1.5 text-sm font-semibold text-orange-700"
                    >
                      + {s.name} ({formatPrice(s.price)}) {getCartQtyById(s.id) > 0 ? `• ${getCartQtyById(s.id)}x` : ''} {lastSuggestedAddedId === s.id ? '✓' : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center gap-3">
              <div className="flex items-center rounded-xl border">
                <button type="button" className="h-10 w-10 font-bold" onClick={() => setModalQty((q) => Math.max(1, q - 1))}>-</button>
                <span className="w-10 text-center font-bold">{modalQty}</span>
                <button type="button" className="h-10 w-10 font-bold" onClick={() => setModalQty((q) => q + 1)}>+</button>
              </div>
              <button type="button" onClick={addFromModal} className="flex-1 rounded-xl bg-black py-3 font-semibold text-white">
                Adicionar - {formatPrice(modalProduct.price * modalQty)}
              </button>
            </div>
          </div>
        </div>
      )}

      {comboModal && (() => {
        const pfIdx = Array.isArray(comboModal.pfSlots) && comboModal.pfSlots.length > 0
          ? comboModal.pfSlots
          : comboModal.products.map((p, i) => i).filter((i) => isPratoFeitoItem(comboModal.products[i]))
        return (
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 sm:items-center"
            onClick={() => { setComboModal(null); setComboPfSelections({}) }}
          >
            <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-float sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-2xl font-semibold">{comboModal.emoji} {comboModal.name}</h3>
              <p className="mt-1 text-sm text-slate-600">Para cada Prato Feito do combo, escolha o espetinho (obrigatório no caixa).</p>
              {pfIdx.map((productIndex, j) => (
                <div key={productIndex} className="mt-4">
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Espetinho do Prato Feito{pfIdx.length > 1 ? ` (${j + 1}/${pfIdx.length})` : ''} *
                  </label>
                  <select
                    className="w-full rounded-xl border px-4 py-3"
                    value={comboPfSelections[productIndex] ?? ''}
                    onChange={(e) => setComboPfSelections((s) => ({ ...s, [productIndex]: e.target.value }))}
                  >
                    <option value="">Selecione</option>
                    {espetinhosOnline.map((esp) => (
                      <option key={esp.id} value={esp.id}>{esp.name}</option>
                    ))}
                  </select>
                </div>
              ))}
              {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-slate-300 py-3 font-semibold text-slate-700"
                  onClick={() => { setError(''); setComboModal(null); setComboPfSelections({}) }}
                >
                  Cancelar
                </button>
                <button type="button" className="flex-1 rounded-xl bg-black py-3 font-semibold text-white" onClick={confirmComboModal}>
                  Adicionar combo - {formatPrice(comboModal.price)}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/45" onClick={() => setIsCartOpen(false)}>
          <aside className="absolute right-0 top-0 h-full w-full max-w-md bg-white p-4 shadow-float" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-2xl font-semibold">Seu Pedido ({totalItems})</h3>
              <button type="button" onClick={() => setIsCartOpen(false)} className="rounded-lg border px-3 py-1">X</button>
            </div>
            {cart.length === 0 && <p className="text-slate-600">Carrinho vazio.</p>}
            {cart.length > 0 && (
              <>
                <div className="space-y-2">
                  {cart.map((item, i) => (
                    <div key={`${item.id}-${item.observations || ''}-${i}`} className="rounded-xl border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold">{item.name}</p>
                        <p className="font-bold">{formatPrice(item.price * item.quantity)}</p>
                      </div>
                      {item.observations && <p className="mt-1 text-xs text-slate-500">{item.observations}</p>}
                      <div className="mt-2 flex items-center gap-2">
                        <button type="button" className="h-9 w-9 rounded-full border font-bold" onClick={() => updateQty(item.id, item.observations, item.prato_feito_espetinho_id, -1)}>-</button>
                        <span className="w-8 text-center font-bold">{item.quantity}</span>
                        <button type="button" className="h-9 w-9 rounded-full border font-bold" onClick={() => updateQty(item.id, item.observations, item.prato_feito_espetinho_id, 1)}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t pt-4">
                  <p className="text-xl font-semibold">Total: {formatPrice(totalPrice)}</p>
                  <button type="button" onClick={() => { setIsCartOpen(false); setStep('checkout') }} className="mt-3 w-full rounded-xl bg-black py-3 font-semibold text-white">
                    Finalizar pedido
                  </button>
                  <button type="button" onClick={clearCart} className="mt-2 w-full rounded-xl border border-slate-300 py-2.5 font-semibold text-slate-700">
                    Limpar carrinho
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      {step === 'menu' && totalItems > 0 && (
        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          className="fixed bottom-4 left-4 right-4 z-40 rounded-2xl bg-black px-4 py-3 text-left text-white shadow-float"
        >
          <span className="text-sm font-semibold">{totalItems} itens</span>
          <div className="mt-0.5 flex items-center justify-between">
            <span className="text-lg font-semibold">Ver carrinho</span>
            <span className="text-lg font-semibold">{formatPrice(totalPrice)}</span>
          </div>
        </button>
      )}
    </div>
  )
}
