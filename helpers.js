const JSON_LOG_FILE = 'structured_logs.json';
const RAW_LOG_FILE = 'device_messages.log';
const WebSocket = require('ws');

function saveLogsAsJson(newRecords) {
    if (!Array.isArray(newRecords) || newRecords.length === 0) return;
    let existing = [];
    try {
        if (fs.existsSync(JSON_LOG_FILE)) {
            const data = fs.readFileSync(JSON_LOG_FILE, 'utf8');
            if (data.trim()) existing = JSON.parse(data);
        }
    } catch { }
    const stamped = newRecords.map(r => ({ ...r, received_at: new Date().toISOString() }));
    fs.writeFileSync(JSON_LOG_FILE, JSON.stringify(existing.concat(stamped), null, 2));
}

function logRaw(line) {
    try {
        fs.appendFileSync(RAW_LOG_FILE, `[${new Date().toISOString()}] ${line}\n`);
    } catch { }
}

function safeSendToTerminal(term, payload) {
    if (term.ready && term.ws.readyState === WebSocket.OPEN) {
        term.ws.send(JSON.stringify(payload));
    } else {
        term.queue.push(payload);
    }
}

function flushQueue(term) {
    while (term.queue.length && term.ws.readyState === WebSocket.OPEN) {
        const p = term.queue.shift();
        term.ws.send(JSON.stringify(p));
    }
}

// --- Upload helpers ---
async function uploadUsersToTerminal(term, usersArray) {
    const delay = ms => new Promise(r => setTimeout(r, ms));
    for (const { modes = [], ...base } of usersArray) {
        for (const mode of modes) {
            const payload = { ...base, ...mode }; // includes cmd:"setuserinfo"
            safeSendToTerminal(term, payload);
            await delay(30); // gentle pacing
        }
    }
}


// Push any pending batches to this terminal (called on reg/ready)
async function pushPendingIfAny(pendingForAll, pendingById, termId, term) {
    // Per-ID pending
    if (pendingById.has(termId)) {
        const arr = pendingById.get(termId);
        console.log(`   • Flushing per-ID pending for ${termId}`);
        await uploadUsersToTerminal(term, arr);
        pendingById.delete(termId);
    }
    // Global pending-for-all
    if (pendingForAll) {
        console.log(`   • Flushing global pending to ${termId}`);
        await uploadUsersToTerminal(term, pendingForAll);
    }
}


async function broadcastUpload({ pendingForAll, targets = 'all', usersArray, terminals }) {
    const ids = targets === 'all'
        ? [...terminals.keys()]
        : Array.isArray(targets) ? targets : [];

    console.log(`→ Upload request to ${ids.length} terminal(s).`);

    // For any IDs not currently connected/known, remember to send later
    if (targets !== 'all') {
        for (const id of ids) {
            if (!terminals.has(id)) {
                pendingById.set(id, usersArray);
                console.log(`   • Queued for future terminal: ${id}`);
            }
        }
    } else {
        // For ALL, remember for any future terminals too
        pendingForAll = usersArray;
        console.log('   • Global pending upload set (will apply to future terminals)');
    }

    for (const id of ids) {
        const term = terminals.get(id);
        if (term && term.ws.readyState === WebSocket.OPEN) {
            console.log(`   • Uploading to ${id} (ready=${term.ready})`);
            await uploadUsersToTerminal(term, usersArray);
        } else if (targets === 'all') { }
    }
}

module.exports = {
    saveLogsAsJson,
    logRaw,
    safeSendToTerminal,
    flushQueue,
    uploadUsersToTerminal,
    pushPendingIfAny,
    broadcastUpload
}