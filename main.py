import env
import os
import requests
import scrapy
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.keys import Keys
import time

# Twitch API Auth Setup
client_secret = os.environ.get('CLIENT_SECRET', 'your_client_secret_goes_here')
client_id = os.environ.get('CLIENT_ID', 'your_client_id_goes_here')
auth = {'Authorization': client_secret, 'Client-Id': ''}

url_tag_search = 'https://api.twitch.tv/helix/directory/all/tags/52d7e4cc-633d-46f5-818c-bb59102d9549'
#response = requests.get(url_tag_search, headers = auth)
#print(response.text)

# Wide-tooth Comb
webdriver_service = Service(os.environ.get('CHROMEDRIVER_PATH'))
driver = webdriver.Chrome(service = webdriver_service)
driver.get('https://www.twitch.tv/directory/all/tags/52d7e4cc-633d-46f5-818c-bb59102d9549')

screen_height = driver.execute_script("return window.screen.height;")   # get the screen height of the web
print(screen_height)
i = 1

while True:
    driver.execute_script("window.scrollTo(0, {screen_height}*{i});".format(screen_height=screen_height, i=i))
    time.sleep(3)
    i += 1
