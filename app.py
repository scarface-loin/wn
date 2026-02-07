import os
from flask import Flask, request, jsonify
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

app = Flask(__name__)

# --- CONFIGURATION ---
# Récupération des variables d'environnement (configurées sur Onrender)
account_sid = os.environ.get('TWILIO_ACCOUNT_SID')
auth_token = os.environ.get('TWILIO_AUTH_TOKEN')
twilio_whatsapp_number = os.environ.get('TWILIO_WHATSAPP_NUMBER') # Le numéro Sandbox (ex: whatsapp:+14155238886)
my_whatsapp_number = os.environ.get('MY_WHATSAPP_NUMBER')       # Votre numéro (ex: whatsapp:+237...)

# Initialisation du client Twilio
# On vérifie si les clés sont présentes pour éviter de crasher au démarrage
if account_sid and auth_token:
    client = Client(account_sid, auth_token)
else:
    client = None
    print("ATTENTION: Les clés Twilio ne sont pas configurées.")

@app.route('/')
def index():
    return "Serveur de Notification de Rendez-vous Actif 🟢"

@app.route('/notify-appointment', methods=['POST'])
def notify_appointment():
    # 1. Vérification de sécurité de base
    if not client:
        return jsonify({"status": "error", "message": "Serveur mal configuré (Clés Twilio manquantes)"}), 500

    # 2. Récupération des données JSON envoyées
    data = request.get_json()

    if not data:
        return jsonify({"status": "error", "message": "Aucune donnée JSON reçue"}), 400

    # 3. Extraction des champs (avec des valeurs par défaut si un champ manque)
    appt_id = data.get('appointmentId', 'N/A')
    customer = data.get('customerName', 'Inconnu')
    date_rdv = data.get('date', 'Non spécifiée')
    time_rdv = data.get('time', 'Non spécifiée')
    reason = data.get('reason', 'Pas de motif')
    status = data.get('status', 'pending')
    
    # 4. Création du message WhatsApp formaté
    # On utilise des émojis pour rendre la lecture rapide sur téléphone
    whatsapp_message = (
        f"📅 *Nouveau Rendez-vous : {status.upper()}*\n"
        f"-------------------------------\n"
        f"👤 *Client :* {customer}\n"
        f"🕒 *Quand :* Le {date_rdv} à {time_rdv}\n"
        f"📝 *Motif :* {reason}\n"
        f"-------------------------------\n"
        f"🆔 ID : {appt_id}"
    )

    try:
        # 5. Envoi du message via Twilio
        message = client.messages.create(
            body=whatsapp_message,
            from_=twilio_whatsapp_number,
            to=my_whatsapp_number
        )
        
        print(f"Notification envoyée pour le RDV {appt_id}. SID: {message.sid}")
        return jsonify({
            "status": "success", 
            "message": "Notification envoyée", 
            "twilio_sid": message.sid
        }), 200

    except TwilioRestException as e:
        print(f"Erreur Twilio: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
    except Exception as e:
        print(f"Erreur Serveur: {e}")
        return jsonify({"status": "error", "message": "Erreur interne du serveur"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)