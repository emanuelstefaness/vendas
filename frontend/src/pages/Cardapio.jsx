import { useState, useEffect, useRef } from 'react'
import {
  getCategories,
  getItems,
  createCategory,
  updateCategory,
  deleteCategory,
  createItem,
  updateItem,
  deleteItem
} from '../api'

export default function Cardapio() {
  const [categories, setCategories] = useState([])
  const [items, setItems] = useState([])
  const [tab, setTab] = useState('categorias') // categorias | itens
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalCat, setModalCat] = useState(null) // null | { type: 'new' } | { type: 'edit', id, name, slug, sort_order }
  const [modalItem, setModalItem] = useState(null) // null | { type: 'new' } | { type: 'edit', item }
  const [filterCategoryId, setFilterCategoryId] = useState('') // '' = todas
  const [itemModalKey, setItemModalKey] = useState(0)
  const itemsFetchSeq = useRef(0)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [cats, itens] = await Promise.all([getCategories(), getItems()])
      setCategories(cats)
      setItems(itens)
    } catch (e) {
      setError(e.message || 'Falha ao carregar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const loadItems = async () => {
    const seq = ++itemsFetchSeq.current
    try {
      const list = await getItems(filterCategoryId ? Number(filterCategoryId) : undefined)
      if (seq !== itemsFetchSeq.current) return
      setItems(list)
    } catch (e) {
      if (seq !== itemsFetchSeq.current) return
      setError(e.message || 'Falha ao carregar itens')
    }
  }

  useEffect(() => {
    if (tab === 'itens') void loadItems()
  }, [tab, filterCategoryId])

  const handleSaveCategory = async (payload) => {
    setError('')
    try {
      if (modalCat.type === 'new') await createCategory(payload)
      else await updateCategory(modalCat.id, payload)
      setModalCat(null)
      await load()
    } catch (e) {
      setError(e.message || 'Erro ao salvar categoria')
    }
  }

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Excluir esta categoria? Itens devem estar em outra categoria ou excluídos antes.')) return
    setError('')
    try {
      await deleteCategory(id)
      setModalCat(null)
      await load()
    } catch (e) {
      setError(e.message || 'Erro ao excluir')
    }
  }

  const handleSaveItem = async (payload) => {
    setError('')
    try {
      const p = {
        category_id: payload.category_id,
        name: payload.name,
        price: Number(payload.price),
        description: payload.description || null,
        requires_meat_point: !!payload.requires_meat_point,
        is_grill: !!payload.is_grill,
        is_kitchen: !!payload.is_kitchen,
        is_bar: !!payload.is_bar,
        is_side: !!payload.is_side,
        is_prato_feito: !!payload.is_prato_feito
      }
      if (modalItem.type === 'new') await createItem(p)
      else await updateItem(modalItem.item.id, p)
      setModalItem(null)
      await loadItems()
      await load()
    } catch (e) {
      setError(e.message || 'Erro ao salvar item')
    }
  }

  const handleDeleteItem = async (id) => {
    if (!window.confirm('Excluir este item do cardápio?')) return
    setError('')
    try {
      await deleteItem(id)
      setModalItem(null)
      await loadItems()
      await load()
    } catch (e) {
      setError(e.message || 'Erro ao excluir')
    }
  }

  if (loading && categories.length === 0) return <div className="p-4 text-slate-500">Carregando...</div>

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-slate-800">Cadastro do cardápio</h1>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mb-4 flex gap-2 border-b border-slate-200">
        <button
          type="button"
          className={`px-3 py-2 text-sm font-medium ${tab === 'categorias' ? 'border-b-2 border-amber-500 text-amber-600' : 'text-slate-600 hover:text-slate-800'}`}
          onClick={() => setTab('categorias')}
        >
          Categorias
        </button>
        <button
          type="button"
          className={`px-3 py-2 text-sm font-medium ${tab === 'itens' ? 'border-b-2 border-amber-500 text-amber-600' : 'text-slate-600 hover:text-slate-800'}`}
          onClick={() => setTab('itens')}
        >
          Itens
        </button>
      </div>

      {tab === 'categorias' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 p-3">
            <h2 className="font-semibold text-slate-800">Categorias ({categories.length})</h2>
            <button type="button" className="btn btn-primary" onClick={() => setModalCat({ type: 'new' })}>
              Nova categoria
            </button>
          </div>
          <ul className="divide-y divide-slate-100">
            {categories.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div>
                  <span className="font-medium text-slate-800">{c.name}</span>
                  <span className="ml-2 text-sm text-slate-500">({c.slug})</span>
                  {c.sort_order != null && <span className="ml-2 text-xs text-slate-400">ordem: {c.sort_order}</span>}
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-info text-sm" onClick={() => setModalCat({ type: 'edit', id: c.id, name: c.name, slug: c.slug, sort_order: c.sort_order ?? 0 })}>
                    Editar
                  </button>
                  <button type="button" className="btn btn-danger text-sm" onClick={() => handleDeleteCategory(c.id)}>
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'itens' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-3">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-slate-800">Itens</h2>
              <select
                value={filterCategoryId}
                onChange={(e) => setFilterCategoryId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800"
              >
                <option value="">Todas as categorias</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setItemModalKey((k) => k + 1)
                setModalItem({ type: 'new' })
              }}
            >
              Novo item
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="p-2 font-medium">Nome</th>
                  <th className="p-2 font-medium">Categoria</th>
                  <th className="p-2 font-medium">Preço</th>
                  <th className="p-2 font-medium">Setores</th>
                  <th className="p-2 font-medium w-28">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-b border-slate-100">
                    <td className="p-2 font-medium text-slate-800">{i.name}</td>
                    <td className="p-2 text-slate-600">{i.category_name || '-'}</td>
                    <td className="p-2">R$ {Number(i.price).toFixed(2)}</td>
                    <td className="p-2 text-xs text-slate-500">
                      {[i.is_grill && 'Churrasq.', i.is_kitchen && 'Cozinha', i.is_bar && 'Bar'].filter(Boolean).join(', ') || '-'}
                      {i.requires_meat_point ? ' · Ponto' : ''}
                      {i.is_prato_feito ? ' · Prato Feito' : ''}
                    </td>
                    <td className="p-2">
                      <button type="button" className="btn btn-info text-sm mr-2" onClick={() => setModalItem({ type: 'edit', item: i })}>Editar</button>
                      <button type="button" className="btn btn-danger text-sm" onClick={() => handleDeleteItem(i.id)}>Excluir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {items.length === 0 && <p className="p-4 text-center text-slate-500">Nenhum item.</p>}
        </div>
      )}

      {modalCat && (
        <ModalCategoria
          modal={modalCat}
          onClose={() => setModalCat(null)}
          onSave={handleSaveCategory}
        />
      )}

      {modalItem && (
        <ModalItem
          key={modalItem.type === 'edit' ? `item-edit-${modalItem.item.id}` : `item-new-${itemModalKey}`}
          modal={modalItem}
          categories={categories}
          onClose={() => setModalItem(null)}
          onSave={handleSaveItem}
        />
      )}
    </div>
  )
}

function ModalCategoria({ modal, onClose, onSave }) {
  const [name, setName] = useState(modal.type === 'edit' ? modal.name : '')
  const [slug, setSlug] = useState(modal.type === 'edit' ? modal.slug : '')
  const [sortOrder, setSortOrder] = useState(modal.type === 'edit' ? String(modal.sort_order ?? '0') : '0')

  const submit = (e) => {
    e.preventDefault()
    onSave({ name: name.trim(), slug: slug.trim() || undefined, sort_order: parseInt(sortOrder, 10) || 0 })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <h3 className="mb-3 text-lg font-bold text-slate-800">{modal.type === 'new' ? 'Nova categoria' : 'Editar categoria'}</h3>
        <form onSubmit={submit}>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="mb-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800" required />
          <label className="block text-sm font-medium text-slate-700 mb-1">Slug (identificador único)</label>
          <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} className="mb-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800" placeholder="ex: bebidas" />
          <label className="block text-sm font-medium text-slate-700 mb-1">Ordem</label>
          <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="mb-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800" />
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary flex-1" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary flex-1">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function firstCategoryId(cats) {
  if (!cats || !cats.length) return ''
  const id = cats[0].id
  return id != null ? String(id) : ''
}

function ModalItem({ modal, categories, onClose, onSave }) {
  const isEdit = modal.type === 'edit'
  const item = isEdit ? modal.item : null
  const [name, setName] = useState('')
  const [category_id, setCategory_id] = useState('')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [requires_meat_point, setRequires_meat_point] = useState(false)
  const [is_grill, setIs_grill] = useState(false)
  const [is_kitchen, setIs_kitchen] = useState(false)
  const [is_bar, setIs_bar] = useState(false)
  const [is_side, setIs_side] = useState(false)
  const [is_prato_feito, setIs_prato_feito] = useState(false)

  useEffect(() => {
    if (isEdit && item) {
      setName(item.name || '')
      setCategory_id(item.category_id != null ? String(item.category_id) : '')
      setPrice(item.price != null && item.price !== '' ? String(item.price) : '')
      setDescription(item.description || '')
      setRequires_meat_point(!!item.requires_meat_point)
      setIs_grill(!!item.is_grill)
      setIs_kitchen(!!item.is_kitchen)
      setIs_bar(!!item.is_bar)
      setIs_side(!!item.is_side)
      setIs_prato_feito(!!item.is_prato_feito)
      return
    }
    setName('')
    setPrice('')
    setDescription('')
    setRequires_meat_point(false)
    setIs_grill(false)
    setIs_kitchen(false)
    setIs_bar(false)
    setIs_side(false)
    setIs_prato_feito(false)
    setCategory_id(firstCategoryId(categories))
  }, [isEdit, item?.id, modal.type])

  useEffect(() => {
    if (isEdit || !categories.length) return
    setCategory_id((prev) => {
      if (prev && categories.some((c) => String(c.id) === prev)) return prev
      return firstCategoryId(categories)
    })
  }, [isEdit, categories])

  const submit = (e) => {
    e.preventDefault()
    const catId = parseInt(String(category_id), 10)
    const p = parseFloat(String(price).replace(',', '.'))
    if (!Number.isFinite(catId) || catId < 1 || Number.isNaN(p) || p < 0) {
      return
    }
    onSave({ category_id: catId, name: name.trim(), price: p, description: description.trim() || null, requires_meat_point, is_grill, is_kitchen, is_bar, is_side, is_prato_feito })
  }

  const categoryValid = categories.some((c) => String(c.id) === String(category_id))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl my-4">
        <h3 className="mb-3 text-lg font-bold text-slate-800">{isEdit ? 'Editar item' : 'Novo item'}</h3>
        <form onSubmit={submit}>
          <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
          <select
            value={categoryValid ? String(category_id) : ''}
            onChange={(e) => setCategory_id(e.target.value)}
            className="mb-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
            required
            disabled={!categories.length}
          >
            {!categories.length ? (
              <option value="">Carregando categorias…</option>
            ) : (
              categories.map((c) => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))
            )}
          </select>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="mb-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800" required />
          <label className="block text-sm font-medium text-slate-700 mb-1">Preço (R$)</label>
          <input type="text" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="mb-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800" placeholder="0,00" required />
          <label className="block text-sm font-medium text-slate-700 mb-1">Descrição (opcional)</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="mb-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800" />
          <div className="mb-4 space-y-2">
            <label className="flex items-center gap-2"><input type="checkbox" checked={requires_meat_point} onChange={(e) => setRequires_meat_point(e.target.checked)} /> Pede ponto da carne</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={is_grill} onChange={(e) => setIs_grill(e.target.checked)} /> Churrasqueira</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={is_kitchen} onChange={(e) => setIs_kitchen(e.target.checked)} /> Cozinha</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={is_bar} onChange={(e) => setIs_bar(e.target.checked)} /> Bar</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={is_side} onChange={(e) => setIs_side(e.target.checked)} /> Acompanhamento</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={is_prato_feito} onChange={(e) => setIs_prato_feito(e.target.checked)} /> Prato Feito</label>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary flex-1" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary flex-1" disabled={!categories.length || !categoryValid}>
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
