# This is the function that will be deployed to AWS Lambda.
# Every ten minutes, it grabs the vtuber information from our public AWS S3 bucket and makes API calls to the Twitch API to get the stream information.
import copy
import os
import boto3
from botocore.exceptions import ClientError
import requests
import json
from json.decoder import JSONDecodeError
import time
import datetime

try:
    import env
except ImportError:
    print('No env file found when starting crawler. Using fallback methods.')
    pass

# Downloads and returns arbitrary file from S3 bucket
def download_from_s3(data):
    s3 = boto3.client('s3')
    try:
        response = s3.get_object(Bucket=os.environ.get('S3_BUCKET', 'your_bucket_here'), Key=data)
    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchKey':
            return None
        else:
            raise
    return response['Body']

# Upload arbitrary json data to specified S3 bucket and filename WITH PUBLIC READ ACCESS
def upload_to_s3(data, filename):
    s3 = boto3.client('s3')
    # Conversion to bytes, operating under the assumption that the data is json
    string = json.dumps(data)
    binary = bytearray(string, 'utf-8')
    s3.put_object(Bucket=os.environ.get('S3_BUCKET', 'your_bucket_here'), Key=filename, Body=binary)

# Creates history template for current year and month
def create_history():
    import time
    history = {time.strftime('%Y'): {
                    time.strftime('%B') : {
                        'instances' : 0,
                        'daily_view_avg' : [0]*31,
                        'monthly_view_avg' : 0,
                        'daily_time' : [0]*31,
                        'monthly_time_avg' : 0,
                    },
                }
            }
    return history

# Get history file from S3
def update_history(vtubers, last_online):
    try:
        history = json.load(download_from_s3('history.json'))
    except (JSONDecodeError, AttributeError) as e:
        history = {}
        history_template = create_history()
        for vtuber in vtubers:
            history[vtuber] = history_template

    for vtuber in vtubers:
        if 'type' in vtubers[vtuber]['twitch']:
            current_history = copy.deepcopy(history[vtuber])
            if vtubers[vtuber]['twitch']['type'] == 'live':
                # Check that the history file is set up for the current year and month
                if time.strftime('%Y') not in history[vtuber] or time.strftime('%B') not in history[vtuber][time.strftime('%Y')]:
                    history[vtuber][time.strftime('%Y')] = create_history()
                year = time.strftime('%Y')
                month = time.strftime('%B')
                day = int(time.strftime('%d'))
                current_history[year][month]['instances'] += 1
                # If the current value of the daily view average is zero, set instance to 1, as this is the first time the vtuber has been online today
                if current_history[year][month]['daily_view_avg'][day-1] == 0:
                    current_history[year][month]['instances'] = 1
                current_viewers = vtubers[vtuber]['twitch']['viewer_count']
                daily_avg = history[vtuber][year][month]['daily_view_avg'][day]
                instance = current_history[year][month]['instances']
                # Calculate the daily and monthly average viewer count
                current_history[year][month]['daily_view_avg'][day-1] = ((daily_avg * (instance -1)) + current_viewers) / instance
                current_history[year][month]['monthly_view_avg'] = sum(current_history[year][month]['daily_view_avg'][0:day]) / day
            # If the vtuber's name is in the last_online list and is not currently online, their stream ended within the past 5 minutes
            if vtubers[vtuber]['twitch']['user_login'] in last_online and vtubers[vtuber]['twitch']['type'] != 'live':
                # Calculate their stream length using the started_at timestamp compared to the current time using time.time()
                stream_length = (datetime.datetime.now() - datetime.datetime.strptime(vtubers[vtuber]['twitch']['started_at'], '%Y-%m-%dT%H:%M:%SZ')).total_seconds()
                # Add the stream length to the daily and monthly stream time
                current_history[year][month]['daily_stream_time'][day-1] += stream_length
                current_history[year][month]['monthly_stream_time'] += stream_length
            history[vtuber] = current_history
    return history

# Validates token and refreshes if needed
def validate_token():   
    auth = {'Authorization': os.environ.get('CLIENT_TOKEN'), 'Client-Id': os.environ.get('CLIENT_ID')}
    attempts = 0
    while True:
        if attempts > 3:  # Failed to validate token after 3 attempts
            print('Failed to validate token after 3 attempts')
            exit()
        validation = requests.get('https://id.twitch.tv/oauth2/validate', headers = auth)
        if validation.status_code == 200:  # Valid token
            return auth
        else:
            try:  # Refresh token
                refresh_url = 'https://id.twitch.tv/oauth2/token'
                data = {'client_id': os.environ.get('CLIENT_ID'), 'client_secret': os.environ.get('CLIENT_SECRET'), 'grant_type': 'client_credentials'}
                client_token = 'Bearer ' + requests.post(refresh_url, data).json()['access_token']
                # CHANGE THIS BEFORE DEPLOYMENT TO SET THE ENVIRONMENTAL VARIABLE PERMANENTLY, NOT JUST FOR THIS RUN SESSION
                os.environ['CLIENT_TOKEN'] = client_token  # Set the environmental variable to the new token
                auth = {'Authorization': client_token, 'Client-Id': os.environ.get('CLIENT_ID')}
                return auth
            except:
                attempts += 1

# Makes API call to Twitch API and returns the response
def call(chunk, auth):
    url = 'https://api.twitch.tv/helix/streams'
    payload = {'user_login': chunk}
    return requests.get(url, params=payload, headers=auth)

# Lambda handler to be called via AWS Lambda - validates token, calls API, updates stream and history data, then uploads to S3
# This function doesn't actually care about the event or context, but it's required to be passed regardless
def lambda_handler(event, context):
    # Validate token
    auth = validate_token()
    # Get vtuber stream data to update
    try:
        vtubers = json.load(download_from_s3('vtubers.json'))
    except JSONDecodeError:
        vtubers = {}

    # Reset all vtubers to 'offline' - we will revert them as determined by the API call
    last_online = set()
    for vtuber in vtubers:
        if 'type' in vtubers[vtuber]['twitch']:
            # If the vtuber was last seen online, mark their name in a list so we can calculate how long their stream lasted +/- 5 min
            if vtubers[vtuber]['twitch']['type'] == 'online':
                last_online.add(vtubers[vtuber]['twitch']['login_name'])
            vtubers[vtuber]['twitch']['type'] = ''  # Reset the vtuber's status to 'offline'
    
    # Extract the primary keys from the vtubers list
    vtuber_keys = [key for key in vtubers.keys()]
    # Split the list into chunks of 100 for API calls
    chunks = [vtuber_keys[x:x+100] for x in range(0, len(vtuber_keys), 100)]

    # Make the API calls and update the vtuber data
    for chunk in chunks:
        response = call(chunk, auth)
        if response.status_code == 200:
            data = response.json()
            for item in data['data']:
                vtubers[item['user_login']]['twitch'] = item
        else: # API call failed, probably due to hitting the rate limit. This should theoretically never happen due to our update cycle timings.
            break
    
    # Update the history file using updated vtuber data
    history = update_history(vtubers, last_online)

    # Upload the updated history file and vtuber file to S3
    upload_to_s3(vtubers, 'vtubers.json')
    upload_to_s3(history, 'history.json')


