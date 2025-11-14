require('dotenv').config();
const PORT = process.env.PORT || 7788;
const HOST = process.env.HOST || '139.59.69.241';
const BACKEND_ENDPOINT = process.env.BACKEND_ENDPOINT || 'https://backend.mytime2cloud.com/api';
console.log('🔹 Loading environment variables...');
console.log({
    HOST,
    PORT,
    BACKEND_ENDPOINT
});
console.log('✅ Environment variables loaded successfully.');
module.exports = { HOST, PORT, BACKEND_ENDPOINT }
