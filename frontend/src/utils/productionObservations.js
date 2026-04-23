/**
 * Remove da observação o que não é instrução útil na cozinha/produção:
 * rótulos de combo ("Combo: …") e linhas automáticas "PF com …" (espetinho já vem no pedido).
 * Mantém texto livre do cliente (ex.: ponto, observações).
 */
export function observacaoParaProducao(raw) {
  if (raw == null) return ''
  const s = String(raw).trim()
  if (!s) return ''
  const parts = s.split(/\s*•\s*/).map((x) => x.trim()).filter(Boolean)
  const kept = parts.filter((part) => {
    if (/^combo\s*:/i.test(part)) return false
    if (/^pf\s+com\s+/i.test(part)) return false
    return true
  })
  return kept.join(' • ').trim()
}
