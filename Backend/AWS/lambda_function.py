# This is the function that will be deployed to AWS Lambda.
# Every ten minutes, it grabs the vtuber information from our public AWS S3 bucket and makes API calls to the Twitch API to get the stream information.
import os
import boto3
from botocore.exceptions import ClientError
import requests
import json
from json.decoder import JSONDecodeError
import time
import datetime

# History that does not include the current month
generic_history = {
    'instances' : 0,
    'daily_view_avg' : [0]*31,
    'monthly_view_avg' : 0,
    'daily_time' : [0]*31,
    'monthly_time_avg' : 0,
}

# enums for the days in a month
MONTH_DAYS = {
    1: 31,
    2: 28,
    3: 31,
    4: 30,
    5: 31,
    6: 30,
    7: 31,
    8: 31,
    9: 30,
    10: 31,
    11: 30,
    12: 31,
}

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
    s3.put_object(Bucket=os.environ.get('S3_BUCKET', 'your_bucket_here'), Key=filename, Body=binary, ACL='public-read')

# Creates history template for current month
def create_history():
    history = {
        time.strftime('%B') : {
            'instances' : 0,
            'daily_view_avg' : [0]*31,
            'monthly_view_avg' : 0,
            'daily_time' : [0]*31,
            'monthly_time_avg' : 0,
        },
    }
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

def reset_twitch(vtubers):
    last_online = set()
    # For each vtuber, if they are online, add them to the last_online set, then set their status to offline
    for vtuber in vtubers:
        if 'type' in vtubers[vtuber]['twitch']:
            if vtubers[vtuber]['twitch']['type'] == 'live':
                last_online.add(vtubers[vtuber]['twitch']['user_login'])
                vtubers[vtuber]['twitch']['type'] = ''
    return last_online

def update_history(vtubers, last_online):
    try:
        history = json.load(download_from_s3('history.json'))
    except (JSONDecodeError, AttributeError) as e:
        history = {}
    history_template = create_history()
    
    # If the history file is empty, then we need to create empty history for each vtuber
    if not history:
        for vtuber in vtubers:
            history[vtuber] = {time.strftime('%Y') : history_template}
    
    # If not empty, we need to update it
    else:
        # Variables
        year = time.strftime('%Y')
        month = time.strftime('%B')
        month_int = int(time.strftime('%m'))
        day = int(time.strftime('%d'))
        for vtuber in vtubers:
            # If our vtuber is freshly added and also offline, they will not have a valid twitch API response to work with, and no history to update.
            if not vtubers[vtuber]['twitch']:
                # Skip this vtuber
                continue
            # If the current vtuber is not in history, add it and create empty history for the current year and month
            if vtuber not in history:
                history[vtuber] = {year : history_template}
            # If the current vtuber is in history, but the current year is not, add it and create empty history for the current year and month
            elif year not in history[vtuber]:
                history[vtuber][year] = history_template
            # If the current vtuber is in history, the current year is in history, but the current month is not, add it and create empty history for the current month
            elif month not in history[vtuber][year]:
                history[vtuber][year][month] = generic_history
            # If we've passed all previous checks, then our vtuber has a valid history entry, and we simply need to update it
            else:
                # Update the 'instances' value
                history[vtuber][year][month]['instances'] += 1
                # If the current value of the daily view average is zero, set instance to 1, as this is the first time the vtuber has been online today
                if history[vtuber][year][month]['daily_view_avg'][day-1] == 0:
                    history[vtuber][year][month]['instances'] = 1
                # Update the 'daily_view_avg' value
                current_viewers = vtubers[vtuber]['twitch']['viewer_count']
                daily_avg = history[vtuber][year][month]['daily_view_avg'][day-1]
                instance = history[vtuber][year][month]['instances']
                history[vtuber][year][month]['daily_view_avg'][day-1] = ((daily_avg * (instance -1)) + current_viewers) / instance
                # Update the 'monthly_view_avg' value
                history[vtuber][year][month]['monthly_view_avg'] = sum(history[vtuber][year][month]['daily_view_avg'][0:day-1]) / day
                # Update the 'daily_time' value - this is only updated after a vtuber completes a stream
                if vtubers[vtuber]['twitch']['user_login'] in last_online and vtubers[vtuber]['twitch']['type'] != 'live':
                    # If the last stream began and ended today, update as normal
                    if time.strftime('%Y-%m-%d') == vtubers[vtuber]['twitch']['started_at'][:10]:
                        stream_length = (datetime.datetime.now() - datetime.datetime.strptime(vtubers[vtuber]['twitch']['started_at'], '%Y-%m-%dT%H:%M:%SZ')).total_seconds()
                        history[vtuber][year][month]['daily_time'][day-1] += stream_length
                        history[vtuber][year][month]['monthly_time_avg'] = sum(history[vtuber][year][month]['daily_time'][0:day-1]) / day
                    # If the last stream took place over multiple days, we need to do some math
                    else:
                        # Determine the starting and ending date of the stream, then calculate the stream length
                        stream_start = datetime.datetime.strptime(vtubers[vtuber]['twitch']['started_at'], '%Y-%m-%dT%H:%M:%SZ')
                        stream_end = datetime.datetime.now()
                        stream_length = (stream_end - stream_start).days
                        # Create a list of datetime objects representing the days the vtuber streamed
                        stream_days = [stream_start + datetime.timedelta(days=x) for x in range(0, stream_length)]
                        # For each day the vtuber streamed, determine how long the stream lasted on that day, and update the appropriate daily_stream_time value
                        for date in stream_days:
                            # If the day is the first day of the stream, we need to calculate the stream length from the start of the stream to the end of the day
                            if date == stream_start:
                                stream_length = (datetime.datetime.combine(date, datetime.time.max) - stream_start).total_seconds()
                            # Same as before, but for the last day of the stream
                            elif date == stream_end:
                                stream_length = (stream_end - datetime.datetime.combine(date, datetime.time.min)).total_seconds()
                            # If it's neither the first nor last day, but we know they continuously streamed before and after, they must have streamed for 24hrs
                            else:
                                stream_length = 86400
                                history[vtuber][str(date.year)][date.strftime("%B")]['daily_time'][date.day-1] += stream_length
                            # If the day is in the current month, add the difference between the day and now to the average division formula
                            if date.month == month_int:
                                stream_days = (datetime.datetime.now() - date).days
                                history[vtuber][str(date.year)][date.strftime("%B")]['monthly_time_avg'] = \
                                    sum(history[vtuber][str(date.year)][date.strftime("%B")]['daily_time'][0:date.day-1]) / day + stream_days
                            # If the day is NOT in the current month, then the full month has already passed, and we can use MONTH_DAYS for the formula
                            else:
                                history[vtuber][str(date.year)][date.strftime("%B")]['monthly_time_avg'] = \
                                    sum(history[vtuber][str(date.year)][date.strftime("%B")]['daily_time'][0:date.day-1]) / MONTH_DAYS[date.month]
    return history
                    
                

# Lambda handler to be called via AWS Lambda - validates token, calls API, updates stream and history data, then uploads to S3
def lambda_handler(event, context):
    # Validate token
    auth = validate_token()
    # Get vtuber stream data to update
    try:
        vtubers = json.load(download_from_s3('vtubers.json'))
    except JSONDecodeError:
        vtubers = {}

    # Determine who was last online, updating twitch data as needed and updating user with absent information
    last_online = reset_twitch(vtubers)
    
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
            print('API call failed with status code ' + str(response.status_code))
            break
    
    # Update the history file using updated vtuber data
    history = update_history(vtubers, last_online)

    # Upload the updated history file and vtuber file to S3
    upload_to_s3(vtubers, 'vtubers.json')
    upload_to_s3(history, 'history.json')

lambda_handler(None, None)