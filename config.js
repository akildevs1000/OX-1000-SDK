require('dotenv').config();
const PORT = process.env.PORT || 7788;
const HOST = process.env.HOST || '139.59.69.241';
module.exports = { HOST, PORT }
