try:
    import env
except ImportError:
    print('No env file found when starting crawler. Using fallback methods.')
    pass

import boto3
import json
import os
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.keys import Keys
import time

# This crawler is a standalone script. It relies on the env file to get the AWS bucket and the path to the chromedriver.
# If you do not have these environmental variables set, you can set them below and it will use them instead.
# This crawler also requires that your AWS credentials are already set up in your environment. It will not set them up for you nor will it prompt you for them.

# The workflow for this script is as follows:
# 1. Download the current data from S3
# 2. Crawl Twitch for all currently live streamers marked as 'vtuber'
# 3. Create a new timestamped file with the cumulative data
# 4. Upload the new data to S3, overwriting previous (backups will be kept locally to conserve S3 space)

# Run the crawler from the top
def full_cycle():
    download_from_s3()
    data = crawl()
    update_file(data)
    upload_to_s3()

# Load Twitch directory using Selenium, then scroll through the page, scraping the data as we go
def crawl():
    webdriver_service = Service(os.environ.get('CHROMEDRIVER_PATH', 'path-to-your-chromedriver'))
    driver = webdriver.Chrome(service = webdriver_service)
    driver.get('https://www.twitch.tv/directory/all/tags/52d7e4cc-633d-46f5-818c-bb59102d9549')
    time.sleep(5) # Wait for page to load before attempting to crawl

    vtubers = {}  # Joint storage that will be returned once new data is gathered
    vtuber_storage = {}  # Storage for previous data from file

    crawl_start = time.time()
    with open('Data/vtubers.json', 'w+', encoding='utf-8') as f:
        try:
            vtuber_storage = json.load(f) # Load previous data from file if it exists
        except json.decoder.JSONDecodeError:
            pass
              
        card = driver.find_element_by_xpath('//a[@data-a-target="preview-card-title-link"]') # First card DOM element
        while True:
            card.send_keys(Keys.END)  # "Scroll"
            time.sleep(1)  # Wait for page to load
            cards = driver.find_elements_by_xpath('//a[@data-a-target="preview-card-title-link"]')
            # Break based on time rather than if we have reached the end of the page, because the page has more data than we can hope to scrape
            if time.time() - crawl_start > 300: break  # Stop scraping past five minutes (scraping this way uses exponential resources over time)
            else:
                for card in cards:
                    vtubers[card.get_attribute('href').split('/')[-1]] = {'twitch': {}}
    vtubers = {**vtubers, **vtuber_storage}  # Merge the two dictionaries, with priority given to the file data
    return vtubers

# Overwrite the cumulative data file with the new data, making a backup in the process
def update_file(data):
    with open(f'Data/vtubers_{time.time()}.json', 'w', encoding='utf-8') as f:  # Save timestamped backup file
        json.dump(data, f, ensure_ascii=False, indent=4)
    with open('Data/vtubers.json', 'w', encoding='utf-8') as f:  # Save cumulative file
        json.dump(data, f, ensure_ascii=False, indent=4)

# Upload the cumulative data to specified S3 bucket
def upload_to_s3():
    s3 = boto3.client('s3')
    with open('Data/vtubers.json', "rb") as f:  # This is hard-coded only because it is designed to overwrite itself each run
        s3.upload_fileobj(f, os.environ.get('S3_BUCKET', 'your_bucket_here'), os.path.basename('Data/vtubers.json'), ExtraArgs={'ACL':'public-read'})

# Download the cumulative data from specified S3 bucket
def download_from_s3():
    s3 = boto3.client('s3')
    s3.download_file(os.environ.get('S3_BUCKET', 'your_bucket_here'), os.path.basename('Data/vtubers.json'), 'Data/vtubers.json')

while True: # Run the crawler every hour
    full_cycle()
    time.sleep(3600)

