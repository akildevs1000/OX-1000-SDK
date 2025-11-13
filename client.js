// client.js
const { PORT, HOST } = require('./config');
const WebSocket = require('ws');
const { users } = require("./demo-users/users");

// Usage:
//   node client.js              -> upload to ALL connected terminals + remember for future
//   node client.js list         -> list terminals
//   node client.js clear        -> clear pending queues
//   node client.js SN1,SN2,...  -> upload to specific IDs (queues if offline)

const arg = (process.argv[2] || '').trim();

const ws = new WebSocket(`ws://${HOST}:${PORT}/?type=client`);

ws.on('open', () => {
    if (arg === 'list') {
        ws.send(JSON.stringify({ cmd: 'list' }));
        return;
    }
    if (arg === 'clear') {
        ws.send(JSON.stringify({ cmd: 'clear_pending' }));
        return;
    }

    const targets = !arg || arg.toLowerCase() === 'all'
        ? 'all'
        : arg.split(',').map(s => s.trim()).filter(Boolean);

    console.log('✅ Connected. Requesting upload...', { targets, count: users.length });
    ws.send(JSON.stringify({ cmd: 'upload_users', targets, users }));
});

ws.on('message', (data) => {
    try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'terminals') {
            console.log('Connected terminals:', msg.terminals);
            return;
        }
        if (msg.type === 'ack') {
            console.log(`ACK ${msg.cmd} ->`, msg.targets, `count=${msg.count}`);
            return;
        }
        if (msg.type === 'done' && (msg.cmd === 'upload_users' || msg.cmd === 'clear_pending')) {
            console.log(`✅ ${msg.cmd} complete.`);
        }
        if (msg.type === 'response' && (msg.cmd === 'upload_users')) {
            console.log(msg);
        }


        console.log('Server:', msg);
        if (msg.type === 'user_upload_result') {
            const status = msg.result ? '✅ OK' : '❌ FAIL';
            console.log(`📩 Terminal ${msg.sn} → ${status}`);
            return;
        }
    } catch {
        console.log('Server:', data.toString());
    }
});

ws.on('error', (e) => console.error('❌ WS error:', e.message));
ws.on('close', () => console.log('🔌 Client disconnected.'));