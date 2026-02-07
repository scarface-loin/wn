import os
from flask import Flask, request, jsonify
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

# Initialisation de l'application Flask
app = Flask(__name__)

# Récupération des clés API depuis les variables d'environnement
# C'est la méthode sécurisée, ne mettez jamais vos clés en dur dans le code !
account_sid = os.environ.get('TWILIO_ACCOUNT_SID')
auth_token = os.environ.get('TWILIO_AUTH_TOKEN')
twilio_whatsapp_number = os.environ.get('TWILIO_WHATSAPP_NUMBER') # ex: 'whatsapp:+14155238886'
my_whatsapp_number = os.environ.get('MY_WHATSAPP_NUMBER')       # ex: 'whatsapp:+33612345678'

# Vérification que les variables d'environnement sont bien définies
if not all([account_sid, auth_token, twilio_whatsapp_number, my_whatsapp_number]):
    print("ERREUR: Des variables d'environnement Twilio sont manquantes.")
    # Dans un vrai cas, on pourrait lever une exception ou quitter.
    # Pour le développement, cela suffit.

# Initialisation du client Twilio
client = Client(account_sid, auth_token)

@app.route('/')
def index():
    return "Le serveur est en ligne. Utilisez le endpoint /send-whatsapp pour envoyer un message."

# Création du "endpoint" qui va recevoir la demande d'envoi
@app.route('/send-whatsapp', methods=['POST'])
def send_whatsapp():
    # On s'attend à recevoir un JSON avec une clé "message"
    data = request.get_json()

    if not data or 'message' not in data:
        return jsonify({"error": "Le corps de la requête doit être un JSON avec une clé 'message'."}), 400

    message_body = data['message']

    try:
        message = client.messages.create(
                          body=message_body,
                          from_=twilio_whatsapp_number,
                          to=my_whatsapp_number
                      )
        
        print(f"Message envoyé avec SID: {message.sid}")
        return jsonify({"status": "success", "message_sid": message.sid}), 200

    except TwilioRestException as e:
        print(f"Erreur Twilio: {e}")
        return jsonify({"status": "error", "error_message": str(e)}), 500
    except Exception as e:
        print(f"Erreur inattendue: {e}")
        return jsonify({"status": "error", "error_message": "Une erreur interne est survenue."}), 500

# Lancement du serveur (pour le test local)
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)