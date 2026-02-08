const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Configuration
const PORT = process.env.PORT || 5000;
const MESSAGE_DELAY = 2 * 60 * 1000; // 2 minutes en millisecondes

// État global
let whatsappClient = null;
let isReady = false;
let currentQR = null;
let messageQueue = [];
let isProcessing = false;

// Initialiser le client WhatsApp
const initWhatsApp = () => {
    whatsappClient = new Client({
        authStrategy: new LocalAuth({
            dataPath: './whatsapp-session'
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ]
        }
    });

    // Événement : QR Code généré
    whatsappClient.on('qr', async (qr) => {
        console.log('📱 QR Code généré !');
        currentQR = await qrcode.toDataURL(qr);
    });

    // Événement : Client prêt
    whatsappClient.on('ready', () => {
        console.log('✅ WhatsApp connecté et prêt !');
        isReady = true;
        currentQR = null;
    });

    // Événement : Authentification réussie
    whatsappClient.on('authenticated', () => {
        console.log('🔐 Authentification réussie');
    });

    // Événement : Erreur d'authentification
    whatsappClient.on('auth_failure', (msg) => {
        console.error('❌ Échec authentification:', msg);
        isReady = false;
    });

    // Événement : Déconnexion
    whatsappClient.on('disconnected', (reason) => {
        console.log('⚠️ WhatsApp déconnecté:', reason);
        isReady = false;
        currentQR = null;
    });

    // Initialiser la connexion
    whatsappClient.initialize();
};

// Formater le numéro de téléphone pour WhatsApp
const formatPhoneNumber = (phone) => {
    // Enlever tous les caractères non numériques sauf le +
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // Enlever le + si présent
    if (cleaned.startsWith('+')) {
        cleaned = cleaned.substring(1);
    }
    
    // Ajouter @c.us pour WhatsApp
    return `${cleaned}@c.us`;
};

// Envoyer un message WhatsApp
const sendWhatsAppMessage = async (phone, message) => {
    if (!isReady) {
        throw new Error('WhatsApp non connecté');
    }

    const formattedNumber = formatPhoneNumber(phone);
    
    try {
        await whatsappClient.sendMessage(formattedNumber, message);
        console.log(`✅ Message envoyé à ${phone}`);
        return true;
    } catch (error) {
        console.error(`❌ Erreur envoi à ${phone}:`, error);
        throw error;
    }
};

// Traiter la file de messages
const processMessageQueue = async () => {
    if (isProcessing || messageQueue.length === 0) {
        return;
    }

    isProcessing = true;
    console.log(`🔄 Traitement de la file (${messageQueue.length} message(s))`);

    while (messageQueue.length > 0) {
        const msgData = messageQueue.shift();
        
        try {
            await sendWhatsAppMessage(msgData.phone, msgData.message);
            console.log(`✅ Message envoyé pour commande ${msgData.commandId}`);
        } catch (error) {
            console.error(`❌ Échec envoi commande ${msgData.commandId}:`, error);
        }

        // Attendre 2 minutes avant le prochain message (si il y en a d'autres)
        if (messageQueue.length > 0) {
            console.log(`⏳ Attente de 2 minutes... (${messageQueue.length} restant(s))`);
            await new Promise(resolve => setTimeout(resolve, MESSAGE_DELAY));
        }
    }

    isProcessing = false;
    console.log('✅ File de messages vide');
};

// Routes API

// Page d'accueil avec QR Code
app.get('/', (req, res) => {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Global Express - WhatsApp Server</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 20px;
            }
            .container {
                background: white;
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                padding: 40px;
                max-width: 600px;
                width: 100%;
                text-align: center;
            }
            h1 {
                color: #25D366;
                margin-bottom: 10px;
                font-size: 32px;
            }
            .subtitle {
                color: #666;
                margin-bottom: 30px;
                font-size: 16px;
            }
            .status {
                padding: 20px;
                border-radius: 10px;
                margin-bottom: 25px;
                font-weight: bold;
                font-size: 18px;
            }
            .status.waiting {
                background: #fff3cd;
                color: #856404;
            }
            .status.ready {
                background: #d4edda;
                color: #155724;
            }
            .qr-container {
                background: #f8f9fa;
                padding: 30px;
                border-radius: 15px;
                margin: 25px 0;
            }
            .qr-image {
                max-width: 300px;
                width: 100%;
                height: auto;
            }
            .instructions {
                text-align: left;
                background: #e7f3ff;
                padding: 25px;
                border-radius: 10px;
                margin-top: 25px;
            }
            .instructions h3 {
                color: #004085;
                margin-bottom: 15px;
                font-size: 18px;
            }
            .instructions ol {
                margin-left: 25px;
            }
            .instructions li {
                margin: 10px 0;
                color: #004085;
                line-height: 1.6;
            }
            .queue-info {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 10px;
                margin-top: 25px;
                font-size: 15px;
            }
            .queue-info strong {
                display: block;
                margin-bottom: 10px;
                font-size: 16px;
            }
            .refresh-btn {
                background: #25D366;
                color: white;
                border: none;
                padding: 15px 40px;
                border-radius: 30px;
                font-size: 16px;
                cursor: pointer;
                margin-top: 25px;
                transition: all 0.3s;
                font-weight: bold;
            }
            .refresh-btn:hover {
                background: #128C7E;
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            }
            .api-info {
                background: #f0f0f0;
                padding: 15px;
                border-radius: 8px;
                margin-top: 20px;
                font-family: monospace;
                font-size: 13px;
                text-align: left;
            }
        </style>
        <script>
            // Auto-refresh toutes les 5 secondes
            setTimeout(() => location.reload(), 5000);
        </script>
    </head>
    <body>
        <div class="container">
            <h1>🚚 Global Express</h1>
            <p class="subtitle">Système de Notification WhatsApp</p>
            
            ${isReady ? `
            <div class="status ready">
                ✅ WhatsApp Connecté !
            </div>
            <p style="font-size: 18px; color: #155724; margin: 20px 0;">
                Votre WhatsApp est connecté et prêt à envoyer des notifications.
            </p>
            ` : `
            <div class="status waiting">
                ⏳ En attente de connexion WhatsApp...
            </div>
            
            ${currentQR ? `
            <div class="qr-container">
                <p style="margin-bottom: 15px; font-weight: bold; font-size: 16px;">
                    Scannez ce QR Code avec WhatsApp :
                </p>
                <img src="${currentQR}" class="qr-image" alt="QR Code WhatsApp">
            </div>
            
            <div class="instructions">
                <h3>📱 Comment scanner :</h3>
                <ol>
                    <li>Ouvrez <strong>WhatsApp</strong> sur votre téléphone</li>
                    <li>Appuyez sur <strong>⋮</strong> (Menu) puis <strong>Appareils connectés</strong></li>
                    <li>Appuyez sur <strong>Connecter un appareil</strong></li>
                    <li>Scannez le QR code ci-dessus</li>
                    <li>Attendez la confirmation ✅</li>
                </ol>
            </div>
            ` : `
            <p style="margin: 20px 0;">
                🔄 Initialisation en cours...
            </p>
            `}
            `}
            
            <div class="queue-info">
                <strong>📊 File d'attente :</strong>
                ${messageQueue.length} message(s) en attente<br>
                ${isProcessing ? '🔄 En cours de traitement...' : '⏸️ En attente'}<br>
                <small style="color: #666; margin-top: 10px; display: block;">
                    Délai entre messages : 2 minutes
                </small>
            </div>

            <div class="api-info">
                <strong>🔌 API Endpoint:</strong><br>
                POST /notify-delivery<br>
                {"phoneNumber": "+237...", "commandId": "CMD-..."}
            </div>
            
            <button class="refresh-btn" onclick="location.reload()">🔄 Actualiser</button>
        </div>
    </body>
    </html>
    `;
    
    res.send(html);
});

// Endpoint pour envoyer une notification
app.post('/notify-delivery', (req, res) => {
    const { phoneNumber, commandId } = req.body;

    // Validation
    if (!phoneNumber || !commandId) {
        return res.status(400).json({
            status: 'error',
            message: 'phoneNumber et commandId sont requis'
        });
    }

    // Nettoyer le numéro
    let cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
    if (cleanPhone.startsWith('+')) {
        cleanPhone = cleanPhone.substring(1);
    }

    // Créer le message
    const trackingUrl = `https://client-global-express.web.app/${commandId}/`;
    const message = `Bonjour ${phoneNumber}, votre commande est en cours de livraison. Vous pouvez la suivre ici : ${trackingUrl} Merci de faire confiance à Global Express!`;

    // Ajouter à la file
    const msgData = {
        phone: cleanPhone,
        message: message,
        commandId: commandId,
        timestamp: new Date().toISOString()
    };

    messageQueue.push(msgData);

    // Calculer le temps estimé
    const queuePosition = messageQueue.length;
    const estimatedMinutes = (queuePosition - 1) * 2;

    // Démarrer le traitement si pas déjà en cours
    if (!isProcessing) {
        processMessageQueue();
    }

    res.json({
        status: 'success',
        message: 'Message ajouté à la file d\'attente',
        queue_position: queuePosition,
        estimated_time_minutes: estimatedMinutes,
        phone: phoneNumber,
        command_id: commandId
    });
});

// Endpoint pour vérifier le statut
app.get('/status', (req, res) => {
    res.json({
        whatsapp_connected: isReady,
        queue_size: messageQueue.length,
        is_processing: isProcessing,
        has_qr: currentQR !== null
    });
});

// Endpoint pour obtenir le QR Code
app.get('/qr', (req, res) => {
    if (currentQR) {
        res.json({ qr: currentQR });
    } else if (isReady) {
        res.json({ status: 'connected' });
    } else {
        res.json({ status: 'initializing' });
    }
});

// Démarrage du serveur
app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('🚚 SERVEUR GLOBAL EXPRESS - WHATSAPP');
    console.log('='.repeat(60));
    console.log(`📡 Serveur démarré sur le port ${PORT}`);
    console.log(`🔗 URL: http://localhost:${PORT}`);
    console.log('='.repeat(60));
    
    // Initialiser WhatsApp
    initWhatsApp();
});

// Gestion de la fermeture propre
process.on('SIGINT', async () => {
    console.log('\n🛑 Arrêt du serveur...');
    if (whatsappClient) {
        await whatsappClient.destroy();
    }
    process.exit(0);
});