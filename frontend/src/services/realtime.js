import { io } from 'socket.io-client';

let socket;

export function getSocket() {
  if (!socket) {
    const token = localStorage.getItem('token');
    socket = io('/', { // CRA proxy will forward to backend
      path: '/socket.io',
      transports: ['websocket'],
      auth: token ? { token } : undefined,
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = undefined;
  }
}




