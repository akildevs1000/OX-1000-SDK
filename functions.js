const { broadcastUpload } = require("./helpers");

function deleteUser(ws, msg, terminals, pendingById) {

    const { targets, enrollid, backupnum } = msg;

    if (!enrollid || backupnum === undefined) {
        return ws.send(JSON.stringify({ error: 'missing_delete_params' }));
    }

    const terminalPayload = JSON.stringify({
        cmd: 'deleteuser',
        enrollid: enrollid,
        backupnum: backupnum
    });

    const targetIDs = targets === 'all'
        ? [...terminals.keys()]
        : Array.isArray(targets) ? targets : [targets];

    // --- 2. LOOP, SEND, AND CALCULATE COUNT ---
    let sentCount = 0; // Initialize sentCount correctly
    let targetCount = 0; // Total targets processed (needed for a complete ACK/DONE)

    for (const sn of targetIDs) {
        targetCount++; // Increment total count for ACK/DONE
        const termEntry = terminals.get(sn);
        if (termEntry && termEntry.ready) {
            termEntry.ws.send(terminalPayload);
            sentCount++; // Increment successfully SENT count
        } else {
            // Logic to queue command for offline terminals is crucial here
            const queue = pendingById.get(sn) || [];
            queue.push(terminalPayload);
            pendingById.set(sn, queue);
        }
    }

    // --- 3. SEND ACK AND DONE ---

    // Acknowledge the client immediately (ACK). Use targetCount for total number of targets found.
    ws.send(JSON.stringify({
        type: 'ack',
        cmd: 'deleteuser',
        targets: targets,
        count: targetCount || sentCount // Use the total targets or sent count for a better log
    }));

    // Send DONE back to the client
    return ws.send(JSON.stringify({ type: 'done', cmd: 'deleteuser', sentCount: targetCount }));
}

async function uploadUsers(ws, msg, pendingForAll, pendingById, terminals) {
    const targets = msg.targets || 'all';
    const usersArray = Array.isArray(msg.users) && msg.users.length ? msg.users : [];
    ws.send(JSON.stringify({ type: 'ack', cmd: 'upload_users', targets, count: usersArray.length }));
    await broadcastUpload({ pendingForAll, pendingById, targets, usersArray, terminals });
    return ws.send(JSON.stringify({ type: 'done', cmd: 'upload_users' }));
}

module.exports = { deleteUser, uploadUsers }
