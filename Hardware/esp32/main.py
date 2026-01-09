from machine import Pin, ADC
import network
import urequests
import time
import random

# WiFi credentials
ssid = 'Wokwi-GUEST'
password = '' 

# ThingSpeak API
api_key = 'WYUQC1VEHOYI2I2I'
url = "http://api.thingspeak.com/update?api_key=" + api_key  # use http for MicroPython reliability

# Connect to WiFi
wifi = network.WLAN(network.STA_IF)
wifi.active(True)
wifi.connect(ssid, password)
print("Connecting to WiFi...", end="")
while not wifi.isconnected():
    print(".", end="")
    time.sleep(1)
print("\nConnected to WiFi:", wifi.ifconfig())

while True:
    # Generate random simulated sensor data
    temp = round(random.uniform(18, 35), 2)       # °C
    hum = round(random.uniform(40, 90), 2)        # %
    ldr_val = random.randint(100, 1023)           # light level
    soil_moisture = random.randint(200, 800)      # arbitrary analog value

    print(f"Temp: {temp}°C | Humidity: {hum}% | Light: {ldr_val} | Soil: {soil_moisture}")

    try:
        full_url = f"{url}&field1={temp}&field2={hum}&field3={ldr_val}&field4={soil_moisture}"
        response = urequests.get(full_url)
        print("Data sent:", response.text)
        response.close()
    except Exception as e:
        print("Error sending data:", e)

    time.sleep(20) 
