/** `false` = pedidos online desligados (site mostra aviso e não aceita pedidos). */
export const PEDIDOS_ONLINE_ATIVO = true;

export const MENSAGEM_ONLINE_FECHADO =
  'Pedidos online indisponíveis hoje. Obrigado pela compreensão — volte em breve!';

export function isPedidosOnlineAtivo() {
  const env = process.env.PEDIDOS_ONLINE_ATIVO;
  if (env !== undefined && String(env).trim() !== '') {
    const v = String(env).trim().toLowerCase();
    if (v === '0' || v === 'false' || v === 'off' || v === 'nao' || v === 'não') return false;
    if (v === '1' || v === 'true' || v === 'on' || v === 'sim') return true;
  }
  return PEDIDOS_ONLINE_ATIVO;
}

export function statusPedidosOnline() {
  const online_ativo = isPedidosOnlineAtivo();
  return {
    online_ativo,
    mensagem_fechado: online_ativo ? null : MENSAGEM_ONLINE_FECHADO,
  };
}
