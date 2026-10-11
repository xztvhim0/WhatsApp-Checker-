const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

let waSock = null;
let isWaReady = false;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
    
    waSock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false
    });

    waSock.ev.on('creds.update', saveCreds);

    waSock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            isWaReady = true;
            console.log('✅ WhatsApp Checker berhasil terhubung!');
        } else if (connection === 'close') {
            isWaReady = false;
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('⚠️ Koneksi WhatsApp terputus, menghubungkan ulang...', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        }
    });

    return waSock;
}

function getSock() {
    return waSock;
}

function getIsReady() {
    return isWaReady;
}

module.exports = {
    connectToWhatsApp,
    getSock,
    getIsReady
};
