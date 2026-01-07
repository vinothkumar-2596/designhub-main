import sys
import os
from notifier import WhatsAppNotifier

def main():
    if len(sys.argv) < 3:
        print("Usage: python send_msg.py <phone_number> <message>")
        sys.exit(1)

    phone_number = sys.argv[1]
    message = " ".join(sys.argv[2:])

    # Session is stored relative to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    session_dir = os.path.join(script_dir, "whatsapp_session")
    
    if not os.path.exists(session_dir):
        os.makedirs(session_dir)

    # Use headless=True by default for server usage
    # If it's the first time, user might need to scan QR code (headless=False)
    # We can control this via an environment variable if needed.
    headless = os.getenv("WHATSAPP_HEADLESS", "true").lower() == "true"
    
    notifier = WhatsAppNotifier(headless=headless)
    # Override user_data_dir to ensure it's in our server/whatsapp folder
    notifier.user_data_dir = session_dir
    
    notifier.send_notification(message, phone_number)

if __name__ == "__main__":
    main()
