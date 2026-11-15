import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const rooms = new Map();
const clients = new WeakMap();
const MAX_MESSAGE_BYTES = 32 * 1024;
const MAX_MESSAGES_PER_SECOND = 150;

const httpServer = createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ service: 'robot-arena-server', status: 'ok', rooms: rooms.size }));
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });

httpServer.on('upgrade', (req, socket, head) => {
  if (req.url !== '/ws') {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
});

function send(ws, message) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}
function error(ws, message) { send(ws, { type: 'error', message }); }
function makeRoomId() {
  let id;
  do { id = randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(id));
  return id;
}
function makePassword() { return randomBytes(12).toString('base64url'); }
function passwordMatches(actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string') return false;
  const a = Buffer.from(actual), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
function detach(ws, notify = true) {
  const client = clients.get(ws);
  if (!client) return;
  const room = client.roomId ? rooms.get(client.roomId) : null;
  if (room) {
    if (client.role === 'host') {
      if (notify) send(room.guest, { type: 'opponent_left' });
      rooms.delete(room.id);
      if (room.guest) clients.delete(room.guest);
    } else if (client.role === 'guest' && room.guest === ws) {
      room.guest = null;
      if (notify) send(room.host, { type: 'opponent_left' });
    }
  }
  clients.delete(ws);
}
function attach(ws, room, role) {
  const client = clients.get(ws) || { count: 0, windowStart: Date.now() };
  client.roomId = room.id;
  client.role = role;
  clients.set(ws, client);
}
function rateAllowed(ws) {
  const client = clients.get(ws) || { count: 0, windowStart: Date.now() };
  const now = Date.now();
  if (now - client.windowStart >= 1000) {
    client.count = 0;
    client.windowStart = now;
  }
  client.count++;
  clients.set(ws, client);
  return client.count <= MAX_MESSAGES_PER_SECOND;
}
function finiteControl(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(-1, Math.min(1, n)) : 0;
}

wss.on('connection', ws => {
  clients.set(ws, { count: 0, windowStart: Date.now(), roomId: null, role: null });
  ws.on('message', raw => {
    if (!rateAllowed(ws)) {
      error(ws, 'Trop de messages. Ralentis les commandes réseau.');
      ws.close(1008, 'Rate limit');
      return;
    }
    let msg;
    try { msg = JSON.parse(raw.toString()); }
    catch { error(ws, 'Message JSON invalide.'); return; }
    if (!msg || typeof msg.type !== 'string') { error(ws, 'Type de message manquant.'); return; }

    const client = clients.get(ws);
    const room = client?.roomId ? rooms.get(client.roomId) : null;

    switch (msg.type) {
      case 'net_ping':
        send(ws, { type: 'net_pong', sentAt: Number(msg.sentAt) || Date.now() });
        break;

      case 'create': {
        if (client?.roomId) detach(ws);
        const id = makeRoomId();
        const password = makePassword();
        const created = { id, password, host: ws, guest: null };
        rooms.set(id, created);
        attach(ws, created, 'host');
        send(ws, { type: 'created', roomId: id, password });
        break;
      }

      case 'join': {
        if (client?.roomId) detach(ws);
        const id = String(msg.roomId || '').trim().toUpperCase();
        const target = rooms.get(id);
        if (!target) { error(ws, 'Lobby introuvable ou fermé.'); break; }
        if (!passwordMatches(target.password, msg.password)) { error(ws, 'Mot de passe incorrect.'); break; }
        if (target.guest && target.guest.readyState === WebSocket.OPEN) { error(ws, 'Ce lobby est déjà complet.'); break; }
        if (target.host.readyState !== WebSocket.OPEN) { rooms.delete(id); error(ws, 'L’hôte est déconnecté.'); break; }
        target.guest = ws;
        attach(ws, target, 'guest');
        send(ws, { type: 'joined', roomId: id });
        send(target.host, { type: 'opponent_joined' });
        break;
      }

      case 'start':
        if (!room || client.role !== 'host' || !room.guest) { error(ws, 'Seul l’hôte peut lancer une partie avec deux joueurs.'); break; }
        send(room.guest, { type: 'start', mode: msg.mode, difficulty: msg.difficulty, puckGlide: msg.puckGlide, puckBounce: msg.puckBounce, startAt: msg.startAt, duration: msg.duration, networkHz: msg.networkHz });
        break;

      case 'input':
        if (!room || client.role !== 'guest' || !room.host) break;
        send(room.host, { type: 'remote_input', throttle: finiteControl(msg.throttle), steering: finiteControl(msg.steering), action: !!msg.action });
        break;

      case 'state':
        if (!room || client.role !== 'host' || !room.guest) break;
        send(room.guest, { type: 'state', state: msg.state });
        break;

      case 'end':
        if (!room || client.role !== 'host' || !room.guest) break;
        send(room.guest, { type: 'end', winner: String(msg.winner || 'NUL').slice(0, 16), detail: String(msg.detail || 'Fin du match').slice(0, 160) });
        break;

      case 'leave':
        if (room) {
          const role = client.role;
          detach(ws);
          send(ws, { type: 'left' });
          if (role === 'host') send(room.guest, { type: 'opponent_left' });
        }
        break;

      default:
        error(ws, 'Type de message non pris en charge.');
    }
  });
  ws.on('close', () => detach(ws));
  ws.on('error', () => detach(ws));
});

httpServer.listen(PORT, HOST, () => {
  console.log(`Robot Arena server listening on http://${HOST}:${PORT}`);
  console.log('WebSocket endpoint: /ws · health endpoint: /health');
});
