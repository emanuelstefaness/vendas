let ioInstance = null;

export function setIo(io) {
  ioInstance = io;
}

export function broadcastAll(event, data) {
  if (ioInstance) ioInstance.emit(event, data);
}

export function broadcastToRoom(room, event, data) {
  if (ioInstance) ioInstance.to(room).emit(event, data);
}
