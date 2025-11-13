// usage: node client-delete device_id 1002
const { PORT, HOST } = require('./config');
const WebSocket = require('ws');

// --- READ ARGUMENTS ---
const DEVICE_ID = process.argv[2] ? process.argv[2].trim() : null;
const ENROLL_ID = process.argv[3] ? parseInt(process.argv[3]) : null;

if (!DEVICE_ID || !ENROLL_ID || isNaN(ENROLL_ID)) {
    console.error('❌ Usage: node client-delete <device_id> <enroll_id>');
    process.exit(1);
}

// --- CONSTANT ---
const FIXED_BACKUPNUM = 13; // 13 = delete all user info

// --- CONNECT TO WEBSOCKET SERVER ---
const ws = new WebSocket(`ws://${HOST}:${PORT}/?type=client`);

ws.on('open', () => {
    const deletePayload = {
        cmd: 'deleteuser',
        targets: [DEVICE_ID], // send to specific device
        enrollid: ENROLL_ID,  // dynamic Enroll ID
        backupnum: FIXED_BACKUPNUM
    };

    console.log(`✅ Connected. Requesting delete for Enroll ID ${ENROLL_ID} on Device ${DEVICE_ID}...`);
    ws.send(JSON.stringify(deletePayload));
});

ws.on('message', (data) => {
    try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'ack') {
            console.log(`ACK ${msg.cmd} ->`, msg.targets, `count=${msg.count}`);
            return;
        }

        if (msg.type === 'done') {
            console.log(`✅ ${msg.cmd} complete.`);
            return;
        }

        if (msg.type === 'user_delete_result' || msg.ret === 'deleteuser') {
            const status = msg.result ? '✅ OK' : '❌ FAIL';
            console.log(`🗑️ Terminal ${msg.sn || 'Unknown'} → ${status}`);
            return;
        }

        console.log('Server:', msg);
    } catch {
        console.log('Server (raw):', data.toString());
    }
});

ws.on('error', (e) => console.error('❌ WS error:', e.message));
ws.on('close', () => console.log('🔌 Client disconnected.'));
