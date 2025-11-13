// server.js
const { PORT, HOST } = require('./config');
const WebSocket = require('ws');
const fs = require('fs');
const url = require('url');
const { saveLogsAsJson, logRaw, flushQueue, pushPendingIfAny } = require('./helpers');
const { deleteUser, uploadUsers } = require('./functions');

const terminals = new Map();

let pendingForAll = null;
const pendingById = new Map();

// --- Server ---
const wss = new WebSocket.Server({ host: HOST, port: PORT });

console.log(`WebSocket Server listening on ws://${HOST}:${PORT}`);

wss.on('connection', (ws, req) => {
  const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const { query } = url.parse(req.url, true);
  const type = (query.type || 'terminal').toLowerCase(); // "client" | "terminal"

  if (type === 'client') {
    console.log(`\n--- Upload Client Connected (${clientIP}) ---`);
    ws.send(JSON.stringify({ msg: 'Connected as client', terminals: [...terminals.keys()] }));

    ws.on('message', async (buf) => {
      const raw = buf.toString('utf8').trim();
      logRaw(`CLIENT ${clientIP} | ${raw}`);
      let msg;
      try { msg = JSON.parse(raw); } catch (e) { return ws.send(JSON.stringify({ error: 'invalid_json' })); }

      // { cmd:"list" }
      if (msg.cmd === 'list') {
        return ws.send(JSON.stringify({
          type: 'terminals',
          terminals: [...terminals.entries()].map(([id, t]) => ({ id, ready: t.ready, meta: t.meta || {} }))
        }));
      }

      // { cmd:"clear_pending" }  -> clears pendingForAll and pendingById
      if (msg.cmd === 'clear_pending') {
        pendingForAll = null;
        pendingById.clear();
        return ws.send(JSON.stringify({ type: 'done', cmd: 'clear_pending' }));
      }

      if (msg.cmd === 'deleteuser') {
        return deleteUser(ws, msg);
      }

      // { cmd:"upload_users", targets:"all"|[ids], users?:[...] }
      if (msg.cmd === 'upload_users') {
        return uploadUsers(ws, msg);
      }

      ws.send(JSON.stringify({ error: 'unknown_cmd' }));
    });

    ws.on('close', () => console.log(`Client disconnected (${clientIP})`));
    ws.on('error', (e) => console.error('Client socket error:', e.message));
    return;
  }

  // Terminal connection
  const initialId = query.sn || `${clientIP}-${Date.now()}`;
  terminals.set(initialId, { ws, ready: false, queue: [], meta: { ip: clientIP, sn: query.sn || null, connected_at: new Date().toISOString() } });
  console.log(`\n--- Terminal Connected: ${initialId} (${clientIP}) ---`);

  ws.on('message', async (buf) => {
    const raw = buf.toString('utf8').trim();
    logRaw(`TERM ${clientIP} | ${raw}`);

    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    const cmd = msg.cmd || msg.ret;

    // Terminal registration
    if (cmd === 'reg') {
      // learn SN from the message to re-key the map (if available)
      const sn = msg.sn || msg.sncode || msg.deviceid || msg.sncode1;
      let termId = initialId;
      let termEntry = terminals.get(initialId);

      if (sn) {
        if (!termEntry) {
          // unlikely, but guard
          termEntry = { ws, ready: false, queue: [], meta: { ip: clientIP } };
          terminals.set(sn, termEntry);
        }
        if (initialId !== sn) {
          terminals.delete(initialId);
          terminals.set(sn, termEntry);
          termEntry.meta = { ...(termEntry.meta || {}), sn };
          termId = sn;
          console.log(`   • Terminal ID set to SN: ${sn}`);
        }
      }

      // reply to reg
      try {
        ws.send(JSON.stringify({
          ret: 'reg',
          result: true,
          cloudtime: new Date().toISOString().replace('T', ' ').substring(0, 19),
          nosenduser: true // do NOT auto-upload on reg
        }));
      } catch { }

      // mark ready + flush own queue, then push any pending (global/per-id)
      termEntry = terminals.get(sn || initialId);
      if (termEntry) {
        termEntry.ready = true;
        flushQueue(termEntry);
        await pushPendingIfAny(sn || initialId, termEntry);
      }

      console.log(' - Replied reg (nosenduser=true, ready=true, queues flushed)');
      return;
    }

    // Terminal sends logs
    if (cmd === 'sendlog') {
      saveLogsAsJson(msg.record || []);
      try {
        ws.send(JSON.stringify({
          ret: 'sendlog',
          result: true,
          count: msg.count || 0,
          logindex: msg.logindex,
          cloudtime: new Date().toISOString().replace('T', ' ').substring(0, 19),
          access: 1
        }));
      } catch { }
      console.log(' - Replied sendlog ok');
      return;
    }

    // Terminal replies to setuserinfo
    if (cmd === 'setuserinfo' && msg.ret) {
      const sn = msg.sn || msg.deviceid || 'unknown';
      const result = msg.result === true;

      let r = { type: 'response', cmd: 'upload_users', msg: result ? `✅ User uploaded: ${sn}` : ` ❌ User not uploaded: ${sn}` }

      ws.send(JSON.stringify(r));

    }

  });

  ws.on('close', () => {
    for (const [id, t] of terminals.entries()) {
      if (t.ws === ws) {
        terminals.delete(id);
        console.log(`Terminal disconnected: ${id}`);
        break;
      }
    }
  });

  ws.on('error', (e) => console.error('Terminal socket error:', e.message));
});
