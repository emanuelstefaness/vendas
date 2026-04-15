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
    const f = (payload) => on(payload);
    const fNovo = (payload) => on(payload, 'novo-pedido-online');
    s.on('comandas', f);
    s.on('pedidos', f);
    s.on('novo-pedido-online', fNovo);
    s.on('orders', f);
    return () => {
      s.off('comandas', f);
      s.off('pedidos', f);
      s.off('novo-pedido-online', fNovo);
      s.off('orders', f);
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
