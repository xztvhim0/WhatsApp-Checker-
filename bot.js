require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { connectToWhatsApp, getSock, getIsReady } = require('./whatsapp');

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
    console.error('❌ Error: TELEGRAM_BOT_TOKEN belum diisi di file .env!');
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// Inisialisasi koneksi WhatsApp saat bot berjalan
connectToWhatsApp();

console.log('🤖 Bot Telegram sedang berjalan...');

// Command /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 
        "🤖 **Bot Checker OTP WhatsApp (Pairing Mode)**\n\n" +
        "📌 **Panduan Penggunaan:**\n" +
        "1. Hubungkan nomor WhatsApp mesin checker:\n`/pair 628xxxxxxxxxx`\n" +
        "2. Cek status nomor tujuan:\n`/check 628xxxxxxxxxx`", 
        { parse_mode: 'Markdown' }
    );
});

// Command /pair <nomor>
bot.onText(/\/pair (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const phoneNumber = match[1].trim().replace(/[^0-9]/g, '');
    const sock = getSock();

    if (!sock) {
        return bot.sendMessage(chatId, "⚠️ Sesi Baileys sedang diinisialisasi, coba beberapa saat lagi.");
    }

    if (sock.authState.creds.registered) {
        return bot.sendMessage(chatId, "✅ Sesi WhatsApp ini sudah terdaftar/terhubung sebelumnya.");
    }

    if (!/^\d{10,15}$/.test(phoneNumber)) {
        return bot.sendMessage(chatId, "❌ Format nomor salah. Masukkan nomor tanpa `+` (Contoh: `/pair 6281234567890`)");
    }

    const processingMsg = await bot.sendMessage(chatId, `⏳ Meminta pairing code untuk nomor \`+${phoneNumber}\`...`, { parse_mode: 'Markdown' });

    try {
        await new Promise(resolve => setTimeout(resolve, 3000));

        const code = await sock.requestPairingCode(phoneNumber);
        const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;

        bot.editMessageText(
            `🔑 **Pairing Code WhatsApp Berhasil Dibuat!**\n\n` +
            `• Nomor: \`+${phoneNumber}\`\n` +
            `• Kode: \`${formattedCode}\`\n\n` +
            `**Cara Menautkan di HP:**\n` +
            `1. Buka WhatsApp > **Setelan** > **Perangkat Tertaut**.\n` +
            `2. Pilih **Tautkan Perangkat** > **Tautkan dengan nomor telepon saja**.\n` +
            `3. Masukkan kode 8 digit di atas.`,
            {
                chat_id: chatId,
                message_id: processingMsg.message_id,
                parse_mode: 'Markdown'
            }
        );
    } catch (error) {
        console.error(error);
        bot.editMessageText(`❌ Gagal mendapatkan pairing code: ${error.message}`, {
            chat_id: chatId,
            message_id: processingMsg.message_id
        });
    }
});

// Command /check <nomor>
bot.onText(/\/check (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const phoneNumber = match[1].trim().replace(/[^0-9]/g, '');
    const sock = getSock();
    const isReady = getIsReady();

    if (!isReady) {
        return bot.sendMessage(chatId, "⚠️ Sesi WhatsApp belum terhubung. Silakan lakukan pairing terlebih dahulu menggunakan `/pair <nomor>`.");
    }

    if (!/^\d{10,15}$/.test(phoneNumber)) {
        return bot.sendMessage(chatId, "❌ Format nomor salah. Contoh: `/check 6281234567890`");
    }

    const processingMsg = await bot.sendMessage(chatId, `🔍 Mengecek nomor \`${phoneNumber}\`...`, { parse_mode: 'Markdown' });

    try {
        const jid = `${phoneNumber}@s.whatsapp.net`;
        const [result] = await sock.onWhatsApp(jid);

        if (!result || !result.exists) {
            return bot.editMessageText(`📱 Nomor: \`+${phoneNumber}\`\n❌ Status: **Tidak terdaftar / Tidak aktif di WhatsApp**`, {
                chat_id: chatId,
                message_id: processingMsg.message_id,
                parse_mode: 'Markdown'
            });
        }

        bot.editMessageText(`📱 Nomor: \`+${phoneNumber}\`\n🟢 Status: **Terdaftar di WhatsApp (Aman / Valid)**`, {
            chat_id: chatId,
            message_id: processingMsg.message_id,
            parse_mode: 'Markdown'
        });

    } catch (error) {
        console.error(error);
        bot.editMessageText(`❌ Terjadi kesalahan: ${error.message}`, {
            chat_id: chatId,
            message_id: processingMsg.message_id
        });
    }
});
