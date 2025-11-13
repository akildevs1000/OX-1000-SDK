// usage: node client-delete all 1002
const { PORT, HOST } = require('./config');
const WebSocket = require('ws');

// Command Line Arguments
// Usage: node client.js [targets] [enrollid]
const arg1 = (process.argv[2] || '').trim().toLowerCase(); // Targets or command (list/clear)
const arg2 = process.argv[3] ? parseInt(process.argv[3]) : null; // New: Enroll ID argument

// --- CONSTANT VALUES ---
// The Backup Number (13) is still fixed as per original logic.
const FIXED_BACKUPNUM = 13; // 13 means delete all user info

// --- NEW: DYNAMIC ENROLL ID ---
// Use the argument if it's a valid number, otherwise default to the old hardcoded value (1003).
const ENROLL_ID = (arg2 && !isNaN(arg2)) ? arg2 : 1003;


const ws = new WebSocket(`ws://${HOST}:${PORT}/?type=client`);

ws.on('open', () => {
    // --- 1. Handle Utility Commands (Single Argument) ---
    // Utility commands (list/clear) don't require the Enroll ID.
    if (arg1 === 'list') {
        console.log('✅ Connected. Requesting terminal list...');
        ws.send(JSON.stringify({ cmd: 'list' }));
        return;
    }
    if (arg1 === 'clear') {
        console.log('✅ Connected. Requesting pending queue clear...');
        ws.send(JSON.stringify({ cmd: 'clear_pending' }));
        return;
    }
    
    // --- 2. Handle Delete Command (Default action) ---
    
    // Determine targets: If no arg1, or arg1 is 'all', use 'all'. Otherwise, use the list provided.
    const targets = !arg1 || arg1.toLowerCase() === 'all'
        ? 'all'
        : arg1.split(',').map(s => s.trim()).filter(Boolean);

    // Payload uses the new dynamic ENROLL_ID
    const deletePayload = {
        cmd: 'deleteuser',
        targets: targets,
        enrollid: ENROLL_ID, // <--- MODIFIED: Use the dynamic ENROLL_ID
        backupnum: FIXED_BACKUPNUM
    };

    console.log(`✅ Connected. Requesting user deletion for Enroll ID **${ENROLL_ID}**...`, deletePayload);
    ws.send(JSON.stringify(deletePayload));
});

ws.on('message', (data) => {
    try {
        const msg = JSON.parse(data.toString());
        
        // --- General/Existing Handlers ---
        if (msg.type === 'terminals') {
            console.log('Connected terminals:', msg.terminals);
            return;
        }
        if (msg.type === 'ack') {
            console.log(`ACK ${msg.cmd} ->`, msg.targets, `count=${msg.count}`);
            return;
        }
        if (msg.type === 'done') {
            console.log(`✅ ${msg.cmd} complete.`);
            return;
        }
        if (msg.type === 'response') {
             console.log('Server response:', msg);
             return;
        }
        
        // --- Specific Result Handlers ---
        if (msg.type === 'user_delete_result' || msg.ret === 'deleteuser') { 
             const status = msg.result ? '✅ OK' : '❌ FAIL';
             console.log(`🗑️ Terminal ${msg.sn || 'Unknown'} → ${status} (Delete)`);
             return;
        }
        
        // --- Fallback/Error ---
        console.log('Server:', msg);
        
    } catch {
        console.log('Server (raw):', data.toString());
    }
});

ws.on('error', (e) => console.error('❌ WS error:', e.message));
ws.on('close', () => console.log('🔌 Client disconnected.'));