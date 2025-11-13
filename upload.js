// upload.js
const { PORT, HOST } = require('./config');
const WebSocket = require('ws');
const { users } = require('./demo-users/users');

// --- Read terminal ID from CLI ---
const TERMINAL_ID = process.argv[2] ? process.argv[2].trim() : null;

if (!TERMINAL_ID) {
    console.error('❌ Usage: node upload.js <terminal_id>');
    process.exit(1);
}

const ws = new WebSocket(`ws://${HOST}:${PORT}/?type=client`);

ws.on('open', () => {
    const payload = {
        cmd: 'upload_users',
        targets: [TERMINAL_ID],
        users
    };

    console.log(`✅ Connected. Uploading ${users.length} users to terminal "${TERMINAL_ID}"...`);
    ws.send(JSON.stringify(payload));
});

ws.on('message', (data) => {
    try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'ack') {
            console.log(`ACK ${msg.cmd} ->`, msg.targets, `count=${msg.count}`);
            return;
        }

        if (msg.type === 'done' && msg.cmd === 'upload_users') {
            console.log(`✅ Upload complete for terminal "${TERMINAL_ID}".`);
            return;
        }

        if (msg.type === 'user_upload_result' || msg.cmd === 'upload_users') {
            const status = msg.result ? '✅ OK' : '❌ FAIL';
            console.log(`📩 Terminal ${msg.sn || TERMINAL_ID} → ${status}`);
            return;
        }

        console.log('Server:', msg);
    } catch {
        console.log('Server (raw):', data.toString());
    }
});

ws.on('error', (e) => console.error('❌ WS error:', e.message));
ws.on('close', () => console.log('🔌 Client disconnected.'));
