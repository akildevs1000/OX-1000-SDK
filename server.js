// server.js
const { PORT, HOST } = require('./config');
const WebSocket = require('ws');
const url = require('url');
const { logRaw, flushQueue, pushPendingIfAny, getDevices, addLogsToQueue, getAddress } = require('./helpers');
const { deleteUser, uploadUsers } = require('./functions');

async function main() {
  try {
    const devices = await getDevices();
    init(devices)
  } catch (err) {
    console.error("Failed to get devices:", err);
  }
}

main();

function init(devices) {

  const terminals = new Map();

  let pendingForAll = null;
  let activeUploadClientWs = null; // <<< NEW: Variable to hold the client's WebSocket
  let activeLogClientWs = null; // 👈 NEW: Variable to hold the client's log WebSocket

  const pendingById = new Map();
  const processedReplies = new Set();

  // --- Server ---
  const wss = new WebSocket.Server({ host: HOST, port: PORT });

  console.log(`WebSocket Server listening on ws://${HOST}:${PORT}`);

  wss.on('connection', (ws, req) => {
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const { query } = url.parse(req.url, true);
    const type = (query.type || 'terminal').toLowerCase(); // "client" | "terminal"

    if (type === 'client') {
      activeUploadClientWs = ws; // <<< FIX: Store the client's socket
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

        if (msg.cmd === 'clear_pending') {
          pendingForAll = null;
          pendingById.clear();
          return ws.send(JSON.stringify({ type: 'done', cmd: 'clear_pending' }));
        }

        if (msg.cmd === 'deleteuser') {
          return deleteUser(ws, msg, terminals, pendingById);
        }

        if (msg.cmd === 'upload_users') {
          return uploadUsers(ws, msg, pendingForAll, pendingById, terminals);
        }

        ws.send(JSON.stringify({ error: 'unknown_cmd' }));
      });

      ws.on('close', () => {
        console.log(`Client disconnected (${clientIP})`);
        activeUploadClientWs = null; // <<< FIX: Clear the socket reference on disconnect
      });
      ws.on('error', (e) => console.error('Client socket error:', e.message));
      return;
    } else if (type === 'log') { // 👈 NEW: Log client connection logic
      activeLogClientWs = ws;
      console.log(`\n--- Log Client Connected (${clientIP}) ---`);
      ws.send(JSON.stringify({ msg: 'Connected as log client', terminals: [...terminals.keys()] }));

      // Handle disconnection for log client
      ws.on('close', () => {
        console.log(`Log Client disconnected (${clientIP})`);
        if (activeLogClientWs === ws) { // Check if this is the active one
          activeLogClientWs = null;
        }
      });
      ws.on('error', (e) => console.error('Log client socket error:', e.message));
      return; // Stop processing further client logic for this connection
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
        // ... (existing registration logic) ...
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
            console.log(`   • Terminal ID set to SN: ${sn}`);
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
          await pushPendingIfAny(pendingForAll, pendingById, sn || initialId, termEntry);
        }

        console.log(' - Replied reg (nosenduser=true, ready=true, queues flushed)');

        return;
      }

      // Terminal sends logs
      if (cmd === 'sendlog') {

        (async () => {
          let DeviceID = `${msg.sn}-Mobile`
          const company_id = devices[DeviceID];

          // Build stamped logs with reverse geocoding
          const stamped = await Promise.all(
            (msg.record || []).map(async (r) => {
              // Safely parse lat/lon from r.note.location (e.g. "25.21,55.39")
              let lat = null;
              let lon = null;

              if (r.note && typeof r.note.location === 'string') {
                const parts = r.note.location.split(',');
                lat = parts[0]?.trim() || null;
                lon = parts[1]?.trim() || null;
              }

              // Reverse geocode if we have coordinates
              let gps_location = null;
              if (lat && lon) {
                gps_location = await getAddress(lat, lon);
                console.log('Reverse Geocoded Result:', gps_location);
              }

              return {
                company_id: company_id,
                UserID: r.enrollid,
                DeviceID: DeviceID,
                LogTime: r.time,
                SerialNumber: 0,
                status: "Allowed",
                mode: { 1: "Fing", 2: "Pin", 3: "Card", 8: "Face" }[r.mode] || "Unknown",
                reason: "---",
                log_date_time: r.time,
                index_serial_number: null,
                log_date: (r.time || '').split(" ")[0] || null,
                lat: lat,
                lon: lon,
                gps_location: gps_location
              };
            })
          );

          console.log(stamped);

          // Add to queue
          addLogsToQueue(stamped);

          // 🟢 Send logs to the active client (if connected)
          if (activeLogClientWs && activeLogClientWs.readyState === WebSocket.OPEN) {
            try {
              activeLogClientWs.send(JSON.stringify({
                type: 'log_event', // Use a distinct type for client filtering
                logs: stamped
              }));
            } catch (e) {
              console.error('Error sending log broadcast:', e);
            }
          }

          // Reply to device
          try {
            ws.send(JSON.stringify({
              ret: 'sendlog',
              result: true,
              count: msg.count || 0,
              logindex: msg.logindex,
              cloudtime: new Date().toISOString().replace('T', ' ').substring(0, 19),
              access: 1
            }));
          } catch (e) {
            console.error('Error replying sendlog:', e);
          }

          console.log(' - Replied sendlog ok');
        })();

        return;
      }


      // server.js (inside 'connection', Terminal message handler)

      // Terminal replies to setuserinfo
      if (cmd === 'setuserinfo' && msg.ret) {
        console.log(msg);

        // Find terminal entry for this websocket
        let termEntry = null;
        let termId = 'unknown';
        for (const [id, t] of terminals.entries()) {
          if (t.ws === ws) {
            termEntry = t;
            termId = id;
            break;
          }
        }

        // Try to get enrollid/name from the device reply; if not present, use the pendingUploads queue
        let pendingItem = null;
        if (termEntry && Array.isArray(termEntry.pendingUploads) && termEntry.pendingUploads.length) {
          pendingItem = termEntry.pendingUploads.shift();
        }

        const enrollid = msg.enrollid || (pendingItem && pendingItem.enrollid) || 'unknown';
        const name = msg.name || (pendingItem && pendingItem.name) || null;
        const result = msg.result === true;

        // --- DEBOUNCE LOGIC ---
        const replyKey = `${termId}:${enrollid}:${cmd}`;

        if (processedReplies.has(replyKey)) {
          console.log(`⚠️ Ignored duplicate reply from ${termId} (${enrollid}): ${cmd}`);
          return;
        }
        processedReplies.add(replyKey);
        setTimeout(() => processedReplies.delete(replyKey), 500);
        // ----------------------

        const pretty = name ? `${name} with id of ${enrollid}` : `user with id of ${enrollid}`;
        const r = {
          type: 'response',
          cmd: 'upload_users',
          result: result,
          status: result,
          enrollid,
          name,
          msg: result ? `${pretty} has been uploaded` : `${pretty} was not uploaded`
        };
        console.log(r);

        // Send response to the browser client
        if (activeUploadClientWs && activeUploadClientWs.readyState === WebSocket.OPEN) {
          activeUploadClientWs.send(JSON.stringify(r));
        } else {
          console.warn(`Client response for ${enrollid} dropped: Upload client not available.`);
        }
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
}
