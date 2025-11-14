// log-viewer.js
const { PORT, HOST } = require('./config');
const WebSocket = require('ws');

// Connect as a log client using the new 'type=log' parameter
const ws = new WebSocket(`ws://${HOST}:${PORT}/?type=log`);

ws.on('open', () => {
    console.log(`✅ Log Client Connected to ws://${HOST}:${PORT}`);
    console.log('--- Awaiting Real-Time Logs from Terminals ---');
});

ws.on('message', (data) => {
    try {
        const raw = data.toString();
        const msg = JSON.parse(raw);

        // Check for the custom 'log_event' type
        if (msg.type === 'log_event' && Array.isArray(msg.logs)) {

            msg.logs.forEach(log => {
                console.log(`  [${log.DeviceID} | ${log.LogTime}] User ${log.UserID} accessed via ${log.mode}.`);
            });

        } else {
            // Handle initial connection message or other server responses
            console.log('Server (Other Message):', msg);
        }

    } catch {
        console.log('Server (Raw):', data.toString());
    }
});

ws.on('error', (e) => console.error('❌ Log Client WS error:', e.message));
ws.on('close', () => console.log('🔌 Log Client disconnected.'));