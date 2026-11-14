'use strict';
const http = require('http');
const crypto = require('crypto');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.PORT || 3000);
const rooms = new Map();
const clients = new Set();
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function code(length) {
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[crypto.randomInt(alphabet.length)];
  return out;
}
function passwordHash(value) {
  return crypto.createHash('sha256').update(String(value)).digest();
}
function samePassword(a, b) {
  return crypto.timingSafeEqual(passwordHash(a), passwordHash(b));
}
function send(ws, type, data = {}) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type, ...data }));
}
function broadcast(room, except, type, data = {}) {
  for (const ws of room.players) if (ws !== except) send(ws, type, data);
}
function removeFromRoom(ws) {
  const room = ws.room;
  if (!room) return;
  room.players.delete(ws);
  ws.room = null;
  if (room.players.size === 0) {
    clearTimeout(room.expiry);
    rooms.delete(room.id);
  } else {
    broadcast(room, ws, 'opponent_left');
    room.host = [...room.players][0];
    if (room.host) room.host.role = 'host';
  }
}
function validOrigin(origin) {
  if (!origin) return true;
  try {
    const u = new URL(origin);
    return u.hostname === 'florfar51.github.io' ||
      u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  } catch { return false; }
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: true, service: 'robot-arena', rooms: rooms.size, players: clients.size }));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Robot Arena multiplayer server is running. WebSocket endpoint: /ws\n');
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
server.on('upgrade', (req, socket, head) => {
  if (req.url !== '/ws' || !validOrigin(req.headers.origin)) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
});

wss.on('connection', ws => {
  clients.add(ws);
  ws.isAlive = true;
  ws.joinAttempts = 0;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return send(ws, 'error', { message: 'Message invalide.' }); }
    if (!msg || typeof msg.type !== 'string') return;
    if (msg.type === 'create') {
      if (ws.room) removeFromRoom(ws);
      let id;
      do { id = code(6); } while (rooms.has(id));
      const password = String(msg.password || code(6)).slice(0, 32);
      const room = { id, passwordHash: passwordHash(password), players: new Set([ws]), host: ws, createdAt: Date.now(), expiry: null };
      rooms.set(id, room);
      ws.room = room;
      ws.role = 'host';
      send(ws, 'created', { roomId: id, password });
      return;
    }
    if (msg.type === 'join') {
      ws.joinAttempts++;
      if (ws.joinAttempts > 12) return send(ws, 'error', { message: 'Trop de tentatives. Reconnecte-toi pour réessayer.' });
      const id = String(msg.roomId || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      const room = rooms.get(id);
      if (!room) return send(ws, 'error', { message: 'Lobby introuvable ou fermé.' });
      if (!samePassword(msg.password || '', room.passwordHash)) return send(ws, 'error', { message: 'Mot de passe incorrect.' });
      if (room.players.size >= 2) return send(ws, 'error', { message: 'Ce lobby est déjà complet.' });
      if (ws.room) removeFromRoom(ws);
      room.players.add(ws);
      ws.room = room;
      ws.role = 'guest';
      send(ws, 'joined', { roomId: id, role: 'guest' });
      broadcast(room, ws, 'opponent_joined');
      return;
    }
    const room = ws.room;
    if (!room) return send(ws, 'error', { message: 'Rejoins ou crée un lobby avant cette action.' });
    if (msg.type === 'start') {
      if (ws !== room.host) return send(ws, 'error', { message: 'Seul l’hôte peut lancer le match.' });
      broadcast(room, ws, 'start', {
        mode: ['combat', 'sumo', 'hockey'].includes(msg.mode) ? msg.mode : 'combat',
        difficulty: ['easy', 'normal', 'hard'].includes(msg.difficulty) ? msg.difficulty : 'normal',
        duration: 120
      });
      return;
    }
    if (msg.type === 'input') {
      if (ws.role !== 'guest') return;
      const input = {
        throttle: Math.max(0, Math.min(1, Number(msg.throttle) || 0)),
        steering: Math.max(-1, Math.min(1, Number(msg.steering) || 0)),
        action: !!msg.action
      };
      if (room.host) send(room.host, 'remote_input', input);
      return;
    }
    if (msg.type === 'state') {
      if (ws !== room.host || !room.players.size) return;
      broadcast(room, ws, 'state', msg.state || {});
      return;
    }
    if (msg.type === 'end') {
      if (ws !== room.host) return;
      broadcast(room, ws, 'end', { winner: String(msg.winner || 'NUL'), detail: String(msg.detail || '') });
      return;
    }
    if (msg.type === 'leave') {
      removeFromRoom(ws);
      send(ws, 'left');
    }
  });
  ws.on('close', () => {
    clients.delete(ws);
    removeFromRoom(ws);
  });
  ws.on('error', () => {});
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 25000);

server.listen(PORT, '0.0.0.0', () => {
  console.log('Robot Arena server listening on http://localhost:' + PORT);
  console.log('WebSocket endpoint: ws://localhost:' + PORT + '/ws');
});
server.on('close', () => clearInterval(heartbeat));
process.on('SIGINT', () => { clearInterval(heartbeat); server.close(() => process.exit(0)); });
