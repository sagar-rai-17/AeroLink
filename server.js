const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

io.on('connection', (sock) => {
  sock.on('join', (room) => {
    const clients = io.sockets.adapter.rooms.get(room);
    const num = clients ? clients.size : 0;

    if (num === 0) {
      sock.join(room);
      sock.emit('created', room);
    } else if (num === 1) {
      sock.join(room);
      sock.emit('joined', room);
      sock.to(room).emit('ready');
    } else {
      sock.emit('full', room);
    }
  });

  sock.on('offer', (room, desc) => {
    sock.to(room).emit('offer', desc);
  });

  sock.on('answer', (room, desc) => {
    sock.to(room).emit('answer', desc);
  });

  sock.on('ice-candidate', (room, data) => {
    sock.to(room).emit('ice-candidate', data);
  });
});

server.listen(3000, () => {
  console.log('Listening on 3000');
});