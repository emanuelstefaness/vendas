import { io } from 'socket.io-client';
import { getApiBase } from './devApiBase';

let socket = null;

export function getSocket() {
  if (!socket) {
    const url = getApiBase();
    socket = io(url || undefined, { path: '/socket.io', transports: ['websocket', 'polling'] });
  }
  return socket;
}

export function useSocket(on) {
  const s = getSocket();
  if (on) {
    const fComandas = (payload) => on(payload, 'comandas');
    const fPedidos = (payload) => on(payload, 'pedidos');
    const fNovo = (payload) => on(payload, 'novo-pedido-online');
    const fOrders = (payload) => on(payload, 'orders');
    s.on('comandas', fComandas);
    s.on('pedidos', fPedidos);
    s.on('novo-pedido-online', fNovo);
    s.on('orders', fOrders);
    return () => {
      s.off('comandas', fComandas);
      s.off('pedidos', fPedidos);
      s.off('novo-pedido-online', fNovo);
      s.off('orders', fOrders);
    };
  }
  return s;
}

export function joinRoom(room) {
  getSocket().emit('join-room', room);
}

export function leaveRoom(room) {
  getSocket().emit('leave-room', room);
}
