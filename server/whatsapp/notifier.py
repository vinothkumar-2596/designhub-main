import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from abc import ABC, abstractmethod

class Notifier(ABC):
    @abstractmethod
    def send_notification(self, message: str, phone_number: str):
        pass

class WhatsAppNotifier(Notifier):
    def __init__(self, headless=True):
        self.headless = headless
        self.user_data_dir = os.path.abspath(os.path.join(os.getcwd(), "whatsapp_session"))
        
    def _get_driver(self):
        print("Initializing Chrome driver...", flush=True)
        chrome_options = Options()
        if self.headless:
            chrome_options.add_argument("--headless=new")
        
        chrome_options.add_argument(f"--user-data-dir={self.user_data_dir}")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--remote-allow-origins=*") # Fix for some Selenium connectivity issues
        chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        
        # This helps with the "invalid session" error by ensuring a clean start
        chrome_options.add_argument("--disable-extensions")
        chrome_options.add_argument("--disable-gpu")
        
        print("Checking for ChromeDriver...", flush=True)
        service = Service(ChromeDriverManager().install())
        print("Starting Chrome...", flush=True)
        driver = webdriver.Chrome(service=service, options=chrome_options)
        return driver

    def send_notification(self, message: str, phone_number: str):
        print(f"\n--- WhatsApp Notification Attempt ---", flush=True)
        print(f"Target: {phone_number}", flush=True)
        print(f"Mode: {'Headless' if self.headless else 'Visible'}", flush=True)
        
        clean_phone = phone_number.replace("+", "").replace(" ", "").replace("-", "")
        url = f"https://web.whatsapp.com/send?phone={clean_phone}&text={message}"
        
        driver = self._get_driver()
        try:
            driver.get(url)
            # Give it plenty of time to load the QR or the chat
            wait = WebDriverWait(driver, 60)
            
            print("Waiting for WhatsApp Web to load...", flush=True)
            
            # More flexible list of possible send button selectors
            selectors = [
                '//span[@data-icon="send"]',
                '//button[@aria-label="Send"]',
                '//footer//button'
            ]
            
            send_button = None
            start_time = time.time()
            while time.time() - start_time < 60:
                for selector in selectors:
                    try:
                        send_button = driver.find_element(By.XPATH, selector)
                        if send_button.is_displayed() and send_button.is_enabled():
                            break
                    except:
                        continue
                if send_button:
                    break
                time.sleep(2)
            
            if send_button:
                send_button.click()
                print("Message sent!", flush=True)
                # Give it more time to sync the message and save the session state
                time.sleep(10) 
            else:
                print("Could not find send button (did you scan the QR code?)", flush=True)
                if not self.headless:
                    print("Please scan the QR code in the browser window.", flush=True)
                    # Wait a bit longer if visible so user can scan
                    time.sleep(20)
            
        except Exception as e:
            print(f"Error: {e}", flush=True)
        finally:
            try:
                driver.quit()
            except:
                pass
        print("--- End of Attempt ---\n", flush=True)

if __name__ == "__main__":
    notifier = WhatsAppNotifier(headless=False)
    notifier.send_notification("Robust test message!", "+919498895809")
