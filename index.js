/**
 * Werewolf WhatsApp Bot
 * Menggunakan @whiskeysockets/baileys
 * Deploy-ready untuk Railway
 */

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
} = require("@whiskeysockets/baileys")
const pino = require("pino")
const qrcode = require("qrcode-terminal")
const path = require("path")
const fs = require("fs")

const {
    emoji_role,
    sesi,
    playerOnGame,
    playerOnRoom,
    playerExit,
    dataPlayer,
    dataPlayerById,
    getPlayerById,
    getPlayerById2,
    killWerewolf,
    killww,
    dreamySeer,
    sorcerer,
    protectGuardian,
    roleShuffle,
    roleChanger,
    roleAmount,
    roleGenerator,
    addTimer,
    startGame,
    playerHidup,
    playerMati,
    vote,
    voteResult,
    clearAllVote,
    getWinner,
    win,
    pagi,
    malam,
    skill,
    voteStart,
    voteDone,
    voting,
    run,
    run_vote,
    run_malam,
    run_pagi,
} = require("./game/werewolf")

// ==================== DATA STORE (In-Memory) ====================
// data[groupId] = { room state }
const data = {}

// ==================== LOGGER ====================
const logger = pino({ level: "silent" })

// ==================== AUTH STATE PATH ====================
const AUTH_PATH = path.join(__dirname, "auth_info")

// ==================== KONEKSI WHATSAPP ====================
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_PATH)
    const { version } = await fetchLatestBaileysVersion()

    const conn = makeWASocket({
        version,
        logger,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        printQRInTerminal: false, // kita handle manual biar bisa kirim ke WA juga
        browser: ["WerewolfBot", "Chrome", "1.0.0"],
    })

    // ==================== QR CODE HANDLER ====================
    conn.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update

        if (qr) {
            // Tampilkan QR di terminal
            console.log("\n======================================")
            console.log("  Scan QR Code berikut di WhatsApp:")
            console.log("======================================\n")
            qrcode.generate(qr, { small: true })
            console.log("\n(QR akan expire dalam ~60 detik, refresh otomatis)\n")
        }

        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode
            const shouldReconnect = reason !== DisconnectReason.loggedOut

            console.log(
                `Koneksi terputus. Alasan: ${reason}. Reconnect: ${shouldReconnect}`
            )

            if (shouldReconnect) {
                console.log("Mencoba reconnect dalam 5 detik...")
                setTimeout(startBot, 5000)
            } else {
                console.log("Bot logout. Hapus folder auth_info lalu restart.")
            }
        }

        if (connection === "open") {
            console.log("\n✅ Bot berhasil terhubung ke WhatsApp!\n")
        }
    })

    conn.ev.on("creds.update", saveCreds)

    // ==================== MESSAGE HANDLER ====================
    conn.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return

        for (const msg of messages) {
            try {
                await handleMessage(conn, msg)
            } catch (err) {
                console.error("Error handle message:", err)
            }
        }
    })

    return conn
}

// ==================== HELPER SEND MESSAGE ====================
async function reply(conn, from, text, mentions = []) {
    return conn.sendMessage(from, { text, mentions })
}

// ==================== MAIN MESSAGE HANDLER ====================
async function handleMessage(conn, msg) {
    if (!msg.message) return
    if (msg.key.fromMe) return

    const from = msg.key.remoteJid
    const sender = msg.key.participant || from // participant = di grup, from = DM
    const isGroup = from.endsWith("@g.us")

    // Ambil teks pesan
    const msgType = Object.keys(msg.message)[0]
    let text = ""
    if (msgType === "conversation") {
        text = msg.message.conversation
    } else if (msgType === "extendedTextMessage") {
        text = msg.message.extendedTextMessage.text
    } else {
        return
    }

    text = text.trim()
    const lower = text.toLowerCase()
    const args = text.split(" ")
    const cmd = args[0].toLowerCase()

    // ==================== COMMANDS ====================

    // ── .wwhelp ─ Daftar perintah
    if (cmd === ".wwhelp") {
        const helpText =
            `*🐺 WEREWOLF BOT - BANTUAN*\n\n` +
            `*Perintah Grup:*\n` +
            `• *.ww create* - Buat room game baru\n` +
            `• *.ww join* - Bergabung ke room\n` +
            `• *.ww leave* - Keluar dari room\n` +
            `• *.ww start* - Mulai game (min. 4 pemain)\n` +
            `• *.ww stop* - Hentikan game\n` +
            `• *.ww player* - Lihat daftar pemain\n` +
            `• *.ww vote [nomor]* - Vote untuk eksekusi\n\n` +
            `*Perintah Private (DM ke bot):*\n` +
            `• *.wwpc kill [nomor]* - Werewolf: bunuh player\n` +
            `• *.wwpc dreamy [nomor]* - Seer: lihat role player\n` +
            `• *.wwpc deff [nomor]* - Guardian: lindungi player\n` +
            `• *.wwpc sorcerer [nomor]* - Sorcerer: buka identitas\n\n` +
            `*Min. 4 pemain, maks. 15 pemain*`
        return reply(conn, from, helpText)
    }

    // ==================== GRUP COMMANDS ====================
    if (isGroup) {
        // .ww create - Buat room
        if (cmd === ".ww" && args[1] === "create") {
            if (sesi(from, data)) {
                return reply(conn, from, "❌ Sudah ada room aktif di grup ini!")
            }
            if (playerOnGame(sender, data)) {
                return reply(conn, from, "❌ Kamu sudah berada di room lain!")
            }

            // Ambil nama pengirim
            const senderName = msg.pushName || sender.replace("@s.whatsapp.net", "")

            data[from] = {
                room: from,
                status: false,
                time: "pagi",
                day: 1,
                iswin: null,
                voting: false,
                seer: false,
                dead: [],
                guardian: [],
                player: [
                    {
                        id: sender,
                        name: senderName,
                        number: 1,
                        role: false,
                        vote: 0,
                        isvote: false,
                        isdead: false,
                        effect: [],
                        status: true,
                        sesi: from,
                    },
                ],
            }

            return reply(
                conn,
                from,
                `✅ Room Werewolf berhasil dibuat!\n\n@${sender.replace(
                    "@s.whatsapp.net",
                    ""
                )} bergabung sebagai pemain #1\n\nKetik *.ww join* untuk bergabung\nKetik *.ww start* untuk memulai game (min. 4 pemain)`,
                [sender]
            )
        }

        // .ww join - Bergabung ke room
        if (cmd === ".ww" && args[1] === "join") {
            const room = sesi(from, data)
            if (!room) {
                return reply(conn, from, "❌ Tidak ada room aktif. Ketik *.ww create* untuk membuat room.")
            }
            if (room.status === true) {
                return reply(conn, from, "❌ Game sudah berlangsung, tidak bisa bergabung!")
            }
            if (playerOnRoom(sender, from, data)) {
                return reply(conn, from, "❌ Kamu sudah berada di room ini!")
            }
            if (playerOnGame(sender, data)) {
                return reply(conn, from, "❌ Kamu sudah berada di room lain!")
            }
            if (room.player.length >= 15) {
                return reply(conn, from, "❌ Room penuh! (maks. 15 pemain)")
            }

            const senderName = msg.pushName || sender.replace("@s.whatsapp.net", "")
            const number = room.player.length + 1

            room.player.push({
                id: sender,
                name: senderName,
                number,
                role: false,
                vote: 0,
                isvote: false,
                isdead: false,
                effect: [],
                status: true,
                sesi: from,
            })

            return reply(
                conn,
                from,
                `✅ @${sender.replace("@s.whatsapp.net", "")} bergabung sebagai pemain #${number}\n\nTotal pemain: ${room.player.length}/15`,
                [sender]
            )
        }

        // .ww leave - Keluar dari room
        if (cmd === ".ww" && args[1] === "leave") {
            const room = sesi(from, data)
            if (!room) return reply(conn, from, "❌ Tidak ada room aktif.")
            if (!playerOnRoom(sender, from, data)) {
                return reply(conn, from, "❌ Kamu tidak berada di room ini.")
            }
            if (room.status === true) {
                return reply(conn, from, "❌ Tidak bisa keluar saat game berlangsung!")
            }

            playerExit(from, sender, data)

            // Re-number players
            if (data[from]) {
                data[from].player.forEach((p, i) => {
                    p.number = i + 1
                })
            }

            return reply(
                conn,
                from,
                `👋 @${sender.replace("@s.whatsapp.net", "")} keluar dari room.\nTotal pemain: ${data[from]?.player.length || 0}`,
                [sender]
            )
        }

        // .ww player - Lihat daftar pemain
        if (cmd === ".ww" && args[1] === "player") {
            const room = sesi(from, data)
            if (!room) return reply(conn, from, "❌ Tidak ada room aktif.")

            let list = `*🎮 DAFTAR PEMAIN (${room.player.length} orang)*\n\n`
            const ment = []
            for (const p of room.player) {
                list += `*${p.number}.* @${p.id.replace("@s.whatsapp.net", "")}${room.status ? (p.isdead ? " - *💀 mati*" : " - *✅ hidup*") : ""}\n`
                ment.push(p.id)
            }
            if (room.status) {
                list += `\n*Hari ke ${room.day}* | *${room.time}*`
            } else {
                list += `\nStatus: *Menunggu pemain* (min. 4)`
            }
            return reply(conn, from, list, ment)
        }

        // .ww start - Mulai game
        if (cmd === ".ww" && args[1] === "start") {
            const room = sesi(from, data)
            if (!room) return reply(conn, from, "❌ Tidak ada room aktif.")
            if (room.status === true) return reply(conn, from, "❌ Game sudah berlangsung!")
            if (!playerOnRoom(sender, from, data)) {
                return reply(conn, from, "❌ Kamu bukan anggota room ini!")
            }
            if (room.player.length < 4) {
                return reply(conn, from, `❌ Pemain kurang! Butuh minimal 4 pemain. Saat ini: ${room.player.length}`)
            }

            // Generate role & mulai
            roleGenerator(from, data)
            startGame(from, data)
            addTimer(from, data)

            // Kirim role ke masing-masing pemain via DM
            const ment = []
            let intro = `*🐺 GAME WEREWOLF DIMULAI!*\n\n*${room.player.length} pemain:*\n`
            for (const p of room.player) {
                intro += `*${p.number}.* @${p.id.replace("@s.whatsapp.net", "")}\n`
                ment.push(p.id)

                // Kirim role via DM
                const roleEmoji = emoji_role(p.role)
                let roleMsg = `🎭 *ROLE KAMU*\n\nKamu mendapatkan role: *${p.role.toUpperCase()}* ${roleEmoji}\n\n`

                if (p.role === "werewolf") {
                    const teammates = room.player
                        .filter((x) => x.role === "werewolf" && x.id !== p.id)
                        .map((x) => `@${x.id.replace("@s.whatsapp.net", "")}`)
                        .join(", ")
                    roleMsg += `Kamu adalah *Werewolf*! Tujuanmu adalah membunuh semua warga.\n`
                    if (teammates) roleMsg += `Sesama Werewolf: ${teammates}`
                    else roleMsg += `Kamu satu-satunya Werewolf, berburu sendirian!`
                } else if (p.role === "seer") {
                    roleMsg += `Kamu adalah *Seer (Peramal)*! Setiap malam kamu bisa melihat role salah satu pemain.`
                } else if (p.role === "guardian") {
                    roleMsg += `Kamu adalah *Guardian (Malaikat Pelindung)*! Setiap malam kamu bisa melindungi 1 pemain dari serangan Werewolf.`
                } else if (p.role === "sorcerer") {
                    roleMsg += `Kamu adalah *Sorcerer (Penyihir)*! Kamu berpihak ke Werewolf. Setiap malam kamu bisa mengintip role pemain.`
                } else {
                    roleMsg += `Kamu adalah *Warga* biasa. Gunakan pikiranmu untuk mengungkap siapa Werewolf-nya!`
                }

                roleMsg += `\n\n*Ketik .wwhelp untuk melihat daftar perintah*`

                try {
                    await conn.sendMessage(p.id, { text: roleMsg })
                } catch (e) {
                    console.error(`Gagal DM ke ${p.id}:`, e.message)
                }
            }

            intro += `\n*Role sudah dikirim via pesan pribadi!*\nGame dimulai dalam 5 detik...`
            await reply(conn, from, intro, ment)

            // Mulai game loop
            setTimeout(() => {
                run(conn, from, data).catch(console.error)
            }, 5000)

            return
        }

        // .ww stop - Hentikan game
        if (cmd === ".ww" && args[1] === "stop") {
            if (!sesi(from, data)) return reply(conn, from, "❌ Tidak ada room aktif.")
            delete data[from]
            return reply(conn, from, "🛑 Game dihentikan paksa.")
        }

        // .ww vote [nomor] - Voting
        if (cmd === ".ww" && args[1] === "vote") {
            const room = sesi(from, data)
            if (!room) return reply(conn, from, "❌ Tidak ada game aktif.")
            if (!room.voting) return reply(conn, from, "❌ Sedang tidak ada sesi voting.")
            if (!playerOnRoom(sender, from, data)) {
                return reply(conn, from, "❌ Kamu bukan anggota room ini.")
            }

            const playerData = dataPlayer(sender, data)
            if (!playerData) return reply(conn, from, "❌ Data kamu tidak ditemukan.")
            if (playerData.isdead) return reply(conn, from, "❌ Kamu sudah mati, tidak bisa voting!")
            if (playerData.isvote) return reply(conn, from, "❌ Kamu sudah vote!")

            const targetNum = parseInt(args[2])
            if (isNaN(targetNum)) return reply(conn, from, "❌ Format: *.ww vote [nomor]*")

            const target = room.player.find((p) => p.number === targetNum)
            if (!target) return reply(conn, from, "❌ Nomor pemain tidak ditemukan.")
            if (target.isdead) return reply(conn, from, "❌ Pemain itu sudah mati!")
            if (target.id === sender) return reply(conn, from, "❌ Tidak bisa vote diri sendiri!")

            vote(from, targetNum, sender, data)

            return reply(
                conn,
                from,
                `🗳️ @${sender.replace("@s.whatsapp.net", "")} vote untuk #${targetNum} @${target.id.replace("@s.whatsapp.net", "")}`,
                [sender, target.id]
            )
        }
    }

    // ==================== PRIVATE MESSAGE COMMANDS ====================
    if (!isGroup) {
        const playerInfo = dataPlayer(sender, data)

        // .wwpc kill [nomor] - Werewolf membunuh
        if (cmd === ".wwpc" && args[1] === "kill") {
            if (!playerInfo) return reply(conn, from, "❌ Kamu tidak sedang dalam game.")
            if (playerInfo.role !== "werewolf") return reply(conn, from, "❌ Hanya Werewolf yang bisa menggunakan perintah ini.")
            if (playerInfo.isdead) return reply(conn, from, "❌ Kamu sudah mati!")
            if (playerInfo.status) return reply(conn, from, "❌ Bukan waktu kamu beraksi.")

            const targetNum = parseInt(args[2])
            if (isNaN(targetNum)) return reply(conn, from, "❌ Format: *.wwpc kill [nomor]*")

            const room = sesi(playerInfo.sesi, data)
            if (!room) return reply(conn, from, "❌ Room tidak ditemukan.")
            const target = room.player.find((p) => p.number === targetNum)
            if (!target) return reply(conn, from, "❌ Pemain tidak ditemukan.")
            if (target.isdead) return reply(conn, from, "❌ Pemain itu sudah mati!")
            if (target.id === sender) return reply(conn, from, "❌ Tidak bisa membunuh diri sendiri!")

            killWerewolf(sender, targetNum, data)
            playerInfo.status = true

            return reply(conn, from, `✅ Kamu memilih @${target.id.replace("@s.whatsapp.net", "")} sebagai target malam ini!`, [target.id])
        }

        // .wwpc dreamy [nomor] - Seer melihat role
        if (cmd === ".wwpc" && args[1] === "dreamy") {
            if (!playerInfo) return reply(conn, from, "❌ Kamu tidak sedang dalam game.")
            if (playerInfo.role !== "seer") return reply(conn, from, "❌ Hanya Seer yang bisa menggunakan perintah ini.")
            if (playerInfo.isdead) return reply(conn, from, "❌ Kamu sudah mati!")
            if (playerInfo.status) return reply(conn, from, "❌ Bukan waktu kamu beraksi.")

            const targetNum = parseInt(args[2])
            if (isNaN(targetNum)) return reply(conn, from, "❌ Format: *.wwpc dreamy [nomor]*")

            const room = sesi(playerInfo.sesi, data)
            if (!room) return reply(conn, from, "❌ Room tidak ditemukan.")
            const target = room.player.find((p) => p.number === targetNum)
            if (!target) return reply(conn, from, "❌ Pemain tidak ditemukan.")

            const role = dreamySeer(sender, targetNum, data)
            if (!role) return reply(conn, from, "❌ Gagal melihat role.")

            playerInfo.status = true
            return reply(
                conn,
                from,
                `🔮 Kamu melihat dalam mimpi...\n\n@${target.id.replace("@s.whatsapp.net", "")} adalah seorang *${role.toUpperCase()}* ${emoji_role(role)}`,
                [target.id]
            )
        }

        // .wwpc deff [nomor] - Guardian melindungi
        if (cmd === ".wwpc" && args[1] === "deff") {
            if (!playerInfo) return reply(conn, from, "❌ Kamu tidak sedang dalam game.")
            if (playerInfo.role !== "guardian") return reply(conn, from, "❌ Hanya Guardian yang bisa menggunakan perintah ini.")
            if (playerInfo.isdead) return reply(conn, from, "❌ Kamu sudah mati!")
            if (playerInfo.status) return reply(conn, from, "❌ Bukan waktu kamu beraksi.")

            const targetNum = parseInt(args[2])
            if (isNaN(targetNum)) return reply(conn, from, "❌ Format: *.wwpc deff [nomor]*")

            const room = sesi(playerInfo.sesi, data)
            if (!room) return reply(conn, from, "❌ Room tidak ditemukan.")
            const target = room.player.find((p) => p.number === targetNum)
            if (!target) return reply(conn, from, "❌ Pemain tidak ditemukan.")
            if (target.isdead) return reply(conn, from, "❌ Pemain itu sudah mati!")

            protectGuardian(sender, targetNum, data)
            playerInfo.status = true

            return reply(
                conn,
                from,
                `🛡️ Kamu melindungi @${target.id.replace("@s.whatsapp.net", "")} malam ini!`,
                [target.id]
            )
        }

        // .wwpc sorcerer [nomor] - Sorcerer mengintip role
        if (cmd === ".wwpc" && args[1] === "sorcerer") {
            if (!playerInfo) return reply(conn, from, "❌ Kamu tidak sedang dalam game.")
            if (playerInfo.role !== "sorcerer") return reply(conn, from, "❌ Hanya Sorcerer yang bisa menggunakan perintah ini.")
            if (playerInfo.isdead) return reply(conn, from, "❌ Kamu sudah mati!")
            if (playerInfo.status) return reply(conn, from, "❌ Bukan waktu kamu beraksi.")

            const targetNum = parseInt(args[2])
            if (isNaN(targetNum)) return reply(conn, from, "❌ Format: *.wwpc sorcerer [nomor]*")

            const room = sesi(playerInfo.sesi, data)
            if (!room) return reply(conn, from, "❌ Room tidak ditemukan.")
            const target = room.player.find((p) => p.number === targetNum)
            if (!target) return reply(conn, from, "❌ Pemain tidak ditemukan.")

            const role = sorcerer(sender, targetNum, data)
            if (!role) return reply(conn, from, "❌ Gagal melihat role.")

            playerInfo.status = true
            return reply(
                conn,
                from,
                `🔯 Ilmu hitammu bekerja...\n\n@${target.id.replace("@s.whatsapp.net", "")} adalah seorang *${role.toUpperCase()}* ${emoji_role(role)}`,
                [target.id]
            )
        }
    }
}

// ==================== START ====================
console.log("🐺 Memulai Werewolf WhatsApp Bot...")
console.log("📁 Auth path:", AUTH_PATH)

startBot().catch((err) => {
    console.error("Error fatal:", err)
    process.exit(1)
})
