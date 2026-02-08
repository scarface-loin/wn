import os
from flask import Flask, request, jsonify
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

app = Flask(__name__)

# --- CONFIGURATION ---
account_sid = os.environ.get('TWILIO_ACCOUNT_SID')
auth_token = os.environ.get('TWILIO_AUTH_TOKEN')
twilio_whatsapp_number = os.environ.get('TWILIO_WHATSAPP_NUMBER')  # Ex: whatsapp:+14155238886

# Initialisation du client Twilio
if account_sid and auth_token:
    client = Client(account_sid, auth_token)
else:
    client = None
    print("ATTENTION: Les clés Twilio ne sont pas configurées.")

@app.route('/')
def index():
    return "Serveur Global Express - Notifications de Livraison 🚚"

@app.route('/notify-delivery', methods=['POST'])
def notify_delivery():
    # 1. Vérification des clés Twilio
    if not client:
        return jsonify({"status": "error", "message": "Serveur mal configuré (Clés Twilio manquantes)"}), 500

    # 2. Récupération des données JSON
    data = request.get_json()
    if not data:
        return jsonify({"status": "error", "message": "Aucune donnée JSON reçue"}), 400

    # 3. Extraction des champs requis
    phone_number = data.get('phoneNumber')  # Format: whatsapp:+237XXXXXXXXX
    command_id = data.get('commandId')
    
    # Validation
    if not phone_number:
        return jsonify({"status": "error", "message": "Le numéro de téléphone est requis (phoneNumber)"}), 400
    if not command_id:
        return jsonify({"status": "error", "message": "L'ID de commande est requis (commandId)"}), 400
    
    # S'assurer que le numéro commence par "whatsapp:"
    if not phone_number.startswith('whatsapp:'):
        phone_number = f'whatsapp:{phone_number}'
    
    # 4. Création du message de livraison
    tracking_url = f"https://client-global-express.web.app/{command_id}/"
    whatsapp_message = (
        f"Bonjour {phone_number.replace('whatsapp:', '')}, "
        f"votre commande est en cours de livraison. "
        f"Vous pouvez la suivre ici : {tracking_url} "
        f"Merci de faire confiance à Global Express!"
    )

    try:
        # 5. Envoi du message via Twilio
        message = client.messages.create(
            body=whatsapp_message,
            from_=twilio_whatsapp_number,
            to=phone_number
        )
        
        print(f"Notification envoyée pour commande {command_id}. SID: {message.sid}")
        return jsonify({
            "status": "success", 
            "message": "Notification de livraison envoyée", 
            "twilio_sid": message.sid,
            "sent_to": phone_number,
            "command_id": command_id
        }), 200

    except TwilioRestException as e:
        print(f"Erreur Twilio: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
    except Exception as e:
        print(f"Erreur Serveur: {e}")
        return jsonify({"status": "error", "message": "Erreur interne du serveur"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)