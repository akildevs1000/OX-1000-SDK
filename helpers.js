const JSON_LOG_FILE = 'structured_logs.json';
const RAW_LOG_FILE = 'device_messages.log';
const fs = require('fs');
const WebSocket = require('ws');
const axios = require('axios');
const https = require('https');
const { BACKEND_ENDPOINT } = require('./config');

// Create HTTPS agent that ignores SSL errors
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

let logQueue = [];

let devices = [];
let isReady = null; // Promise to notify when loaded
let loadPromise = null;

function loadDevices() {
    if (!loadPromise) {
        loadPromise = axios
            .get(`${BACKEND_ENDPOINT}/devices-array`, {
                httpsAgent,
                headers: { Accept: "application/json" },
            })
            .then((res) => {
                devices = res.data;

                fs.writeFileSync("devices.json", JSON.stringify(devices, null, 2));

                return devices;
            })
            .catch((err) => {
                throw err.response?.data || err.message;
            });
    }

    return loadPromise;
}
// Export ONE single function
function getDevices() {
    return loadDevices(); // always returns a Promise
}



function addLogsToQueue(stamped) {
    if (!Array.isArray(stamped) || stamped.length === 0) return;
    logQueue.push(...stamped);
}

async function flushLogs() {
    if (logQueue.length === 0) return;

    const batch = [...logQueue];
    logQueue = []; // clear queue before sending

    try {
        await sendAttendanceLogs(`${BACKEND_ENDPOINT}/store-logs-from-nodesdk`, batch);
        console.log(`Sent ${batch.length} logs to Laravel`);
    } catch (err) {
        console.error('Error sending logs, re-queueing', err);
        logQueue.unshift(...batch); // put them back in queue if failed
    }
}

setInterval(flushLogs, 10000);

async function sendAttendanceLogs(url, logs) {

    try {
        const response = await axios.post(url, logs, {
            headers: { 'Content-Type': 'application/json' },
            httpsAgent
        });
        console.log('Response from Laravel:', response.data);

        saveLogsAsJson(logs);

    } catch (error) {
        console.error('Error sending logs:', error.response?.data || error.message);
    }
}

function saveLogsAsJson(stamped) {
    if (!Array.isArray(stamped) || stamped.length === 0) return;
    let existing = [];
    try {
        if (fs.existsSync(JSON_LOG_FILE)) {
            const data = fs.readFileSync(JSON_LOG_FILE, 'utf8');
            if (data.trim()) existing = JSON.parse(data);
        }
    } catch { }

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
    // Ensure terminal has a pendingUploads queue for matching replies
    if (!term.pendingUploads) term.pendingUploads = [];

    for (const { modes = [], ...base } of usersArray) {
        for (const mode of modes) {
            const payload = { ...base, ...mode }; // includes cmd:"setuserinfo"
            // Record the logical item we sent so we can match a later reply
            term.pendingUploads.push({ enrollid: base.enrollid, name: base.name, backupnum: mode.backupnum });
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


async function broadcastUpload({ pendingForAll, pendingById, targets = 'all', usersArray, terminals }) {
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

async function getAddress(lat, lon) {
    const API_KEY = process.env.LOCATIONIQ_KEY;
    const url = "https://us1.locationiq.com/v1/reverse.php";

    try {
        const { data } = await axios.get(url, {
            params: {
                key: API_KEY,
                lat,
                lon,
                format: "json",
                normalizeaddress: 1,
                "accept-language": "en",
            },
        });

        const address = data.address || {};

        const road = address.road || "";
        const neighbourhood = address.neighbourhood || "";
        const suburb = address.suburb || "";
        const city = address.city || address.town || address.village || "";
        const country = address.country || "";
        const countryCode = (address.country_code || "").toUpperCase();

        // Build clean formatted string (no "undefined" or extra spaces)
        const parts = [road, neighbourhood, suburb, city, country]
            .filter(Boolean)               // remove empty values
            .join(", ");

        return `${parts}`;

    } catch (error) {
        console.error("❌ LocationIQ Error:", error.response?.data || error.message);
        return null;
    }
}
// (async () => {
//     const latitude = 25.260731917286243;
//     const longitude = 55.291596602128244;

//     const result = await getAddress(latitude, longitude);

//     console.log("Reverse Geocoded Result:");
//     console.log(result);
// })();

module.exports = {
    saveLogsAsJson,
    logRaw,
    safeSendToTerminal,
    flushQueue,
    uploadUsersToTerminal,
    pushPendingIfAny,
    broadcastUpload,
    getDevices,
    sendAttendanceLogs,
    addLogsToQueue,
    getAddress
}