import { io, Socket } from 'socket.io-client';

export const createSocket = (apiUrl: string) => {
  const origin = new URL(apiUrl).origin;
  return io(origin, {
    transports: ['websocket'],
    secure: origin.startsWith('https://'),
  });
};

export type SocketClient = Socket;
