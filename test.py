import requests
import json

# ====== CONFIGURATION ======
# Remplacez par l'URL de votre application sur Render
RENDER_URL = "https://wn-1try.onrender.com/notify-delivery"

# Remplacez par un vrai numéro WhatsApp (format international)
TEST_PHONE = "+237650892780"  # Ex: +237670123456

# ID de commande de test
TEST_COMMAND_ID = "CMD-TEST-001"

# ====== TEST ======
def test_notification():
    payload = {
        "phoneNumber": TEST_PHONE,
        "commandId": TEST_COMMAND_ID
    }
    
    print("🚀 Envoi de la notification de test...")
    print(f"📱 Destinataire: {TEST_PHONE}")
    print(f"📦 Commande: {TEST_COMMAND_ID}")
    print()
    
    try:
        response = requests.post(RENDER_URL, json=payload, timeout=10)
        
        print(f"📊 Status HTTP: {response.status_code}")
        print(f"📄 Réponse:")
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
        
        if response.status_code == 200:
            print("\n✅ Notification envoyée avec succès!")
        else:
            print("\n❌ Échec de l'envoi")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Erreur de connexion: {e}")

if __name__ == "__main__":
    test_notification()