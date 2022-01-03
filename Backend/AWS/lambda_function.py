import json
from json.decoder import JSONDecodeError
import os
import datetime
import time
import requests
import boto3
from botocore.exceptions import ClientError


generic_history = {
    'instances' : 0,
    'daily_view_avg' : [0]*31,
    'monthly_view_avg' : 0,
    'daily_time' : [0]*31,
    'monthly_time_avg' : 0,
}


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


class bcolors:
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'



# Generates a default history for a given vtuber, using the current month as a key
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


# Splits a given dictionary into chunks of 100
def make_chunks(vtubers):
    vtuber_keys = [key for key in vtubers.keys()]
    chunks = [vtuber_keys[x:x+100] for x in range(0, len(vtuber_keys), 100)]
    return chunks


# Validates Twitch Dev token and refreshes if needed
def validate_token():
    print(f"{bcolors.OKCYAN}START{bcolors.ENDC}: Validating Twitch Dev token...")   
    auth = {'Authorization': os.environ.get('CLIENT_TOKEN'), 'Client-Id': os.environ.get('CLIENT_ID')}
    attempts = 0
    while True:
        if attempts > 3:
            print(f"{bcolors.FAIL}ERROR{bcolors.ENDC}: Failed to validate token after 3 attempts")
            exit()
        validation = requests.get('https://id.twitch.tv/oauth2/validate', headers = auth)
        if validation.status_code == 200:
            print(f"{bcolors.OKGREEN}COMPLETE{bcolors.ENDC}: Validated Twitch Dev token, authorization set.")
            return auth
        else:
            try:  # Refresh token
                refresh_url = 'https://id.twitch.tv/oauth2/token'
                data = {'client_id': os.environ.get('CLIENT_ID'), 'client_secret': os.environ.get('CLIENT_SECRET'), 'grant_type': 'client_credentials'}
                client_token = 'Bearer ' + requests.post(refresh_url, data).json()['access_token']
                os.environ['CLIENT_TOKEN'] = client_token
                auth = {'Authorization': client_token, 'Client-Id': os.environ.get('CLIENT_ID')}
                print(f"{bcolors.OKGREEN}COMPLETE{bcolors.ENDC}: Refreshed Twitch Dev token, authorization set.")
                return auth
            except:
                attempts += 1


# Grabs the master vtuber json, history json, and live json from S3 bucket. Sets certain default values if the live json is absent.
def fetch_S3():
    print(f"{bcolors.OKCYAN}START{bcolors.ENDC}: Fetching S3 Data...")
    start_time = time.time()
    try:
        vtubers = json.load(download_from_s3('vtubers.json'))
    except JSONDecodeError:
        print(f"{bcolors.FAIL}ERROR{bcolors.ENDC}: Master file is empty, exiting.")
        exit()
    try:
        history = json.load(download_from_s3('history.json'))
    except JSONDecodeError:
        history = {}
    try:
        live = json.load(download_from_s3('live.json'))
    except (JSONDecodeError, AttributeError) as e:
        print(f"{bcolors.WARNING}WARNING{bcolors.ENDC}: Live file doesn't exist, or is not a valid JSON file. Continuing with defaults.")
        live = {}
    print(f"{bcolors.OKGREEN}COMPLETE{bcolors.ENDC}: Fetched S3 Data in {(time.time() - start_time):.2f} seconds.")
    return vtubers, live, history,


# Makes a call to the Twitch API, using up to 100 vtubers at a time
def twitch_call(chunk, auth):
    url = 'https://api.twitch.tv/helix/streams'
    payload = {'user_login': chunk}
    return requests.get(url, params=payload, headers=auth)


# Update all live VTubers, and remove ones that are no longer live; determine the offline cap
def live_cycle(live, auth):
    start_time = time.time()
    print(f"{bcolors.OKCYAN}START{bcolors.ENDC}: Updating priority vtubers...")
    old_live_count = len(live)
    live_chunks = make_chunks(live)
    marked_for_death = set()
    for chunk in live_chunks:
        response = twitch_call(chunk, auth)
        if response.status_code == 200:
            data = response.json()
            for item in data['data']:
                live[item['user_login']]['twitch'] = item
            for vtuber in live:
                for item in data['data']:
                    if vtuber == item['user_login']:
                        break
                else:
                    marked_for_death.add(vtuber)
        else:
            print(f"{bcolors.FAIL}ERROR{bcolors.ENDC}: {str(response.status_code)}")
            exit()
    for vtuber in marked_for_death:
        live.pop(vtuber)
    avg_live_count = old_live_count + len(live) / 2
    offline_cap = 80000 - ( avg_live_count * 6 )
    print(f"{bcolors.OKGREEN}COMPLETE{bcolors.ENDC}: Updated {len(live)} priority vtubers in {(time.time() - start_time):.2f} seconds.")
    return live, offline_cap


# Prune old VTubers, and update the rest in staggered fashion according to their activity levels
# VTubers older than two weeks are pruned
# VTubers older than one week are checked once per two hours - VTubers older than two days are checked once per hour
# All other VTubers are offline, and therefor checked once per thirty minutes rather than the priority schedule of once per ten minutes
def offline_cycle(vtubers, live, auth, offline_cap):
    start_time = time.time()
    print(f"{bcolors.OKCYAN}START{bcolors.ENDC}: Updating offline vtubers...")
    for vtuber in vtubers:
        if 'started_at' not in vtubers[vtuber]['twitch']:
            vtubers[vtuber]['twitch']['started_at'] = datetime.datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ')
    if(len(vtubers) > offline_cap):
        for i in range(len(vtubers) - offline_cap):
            oldest_vtuber = min(vtubers, key=lambda x: vtubers[x]['twitch']['started_at'])
            vtubers.pop(oldest_vtuber)
    once_per_half = bool(40 > time.localtime(time.time()).tm_min > 30 or time.localtime(time.time()).tm_min < 10)
    once_per_hour = bool(time.localtime(time.time()).tm_min > 50)
    once_per_two = bool(time.localtime(time.time()).tm_min < 10 and time.localtime(time.time()).tm_hour % 2 == 1)
    update = {}
    marked_for_death = set()
    for vtuber in vtubers:
        vtuber_time = datetime.datetime.strptime(vtubers[vtuber]['twitch']['started_at'], '%Y-%m-%dT%H:%M:%SZ').timestamp()
        if time.time() - vtuber_time > 1209600:
            if vtubers[vtuber]['twitch']['type'] == 'live' and once_per_hour: # extreme edge-case protection
                update[vtuber] = vtubers[vtuber]
            else:
                marked_for_death.add(vtuber)
        elif time.time() - vtuber_time > 604800 and once_per_two:
            update[vtuber] = vtubers[vtuber]
        elif time.time() - vtuber_time > 172800 and once_per_hour:
            update[vtuber] = vtubers[vtuber]
        else:
            if vtuber not in live and once_per_half:
                vtubers[vtuber]['twitch']['type'] = ''
                update[vtuber] = vtubers[vtuber]
    if len(marked_for_death) > 0:
        for vtuber in marked_for_death:
            vtubers.pop(vtuber)
        print(f"{bcolors.OKCYAN}UPDATE{bcolors.ENDC}: Pruned {len(marked_for_death)} vtubers due to inactivity.")
        marked_for_death.clear()
    update_chunks = make_chunks(update)
    for chunk in update_chunks:
        response = twitch_call(chunk, auth)
        if response.status_code == 200:
            data = response.json()
            for item in data['data']:
                try:
                    vtubers[item['user_login']]['twitch'] = item
                except KeyError:
                    print(f"{bcolors.WARNING}WARNING{bcolors.ENDC}: {item['user_login']} is missing from the master list. Skipping.")
                    marked_for_death.add(item['user_login'])
        else:
            print(f"{bcolors.FAIL}ERROR{bcolors.ENDC}: {str(response.status_code)}")
            exit()
    for vtuber in marked_for_death:
        try:
            vtubers.pop(vtuber)
        except KeyError:
            pass
    print(f"{bcolors.OKGREEN}COMPLETE{bcolors.ENDC}: Updated {len(update)} vtubers in {(time.time() - start_time):.2f} seconds.")
    return vtubers


# Exchange data between live and vtubers
# Live vtubers need to push their data to the master list, and the master list needs to push newly live vtubers to the live list
# Additionally, the master list needs to reset newly offline vtubers to reflect their new status
def crossplay(live, vtubers):
    start_time = time.time()
    print(f"{bcolors.OKCYAN}START{bcolors.ENDC}: Synchronizing priority vtubers with master list...")
    for vtuber in live:
        if vtuber in vtubers:
            vtubers[vtuber] = live[vtuber]
    for vtuber in vtubers:
        try:
            if vtubers[vtuber]['twitch']['type'] == 'live':
                live[vtuber] = vtubers[vtuber]
        except KeyError:
            print(f"{bcolors.WARNING}WARNING{bcolors.ENDC}: {vtuber} is missing the status field. Defaulting to offline.")
            vtubers[vtuber]['twitch']['type'] = ''
    print(f"{bcolors.OKGREEN}COMPLETE{bcolors.ENDC}: Synchronized priority vtubers with master list in {(time.time() - start_time):.2f} seconds.")
    return live, vtubers


# Behemoth of a function that will update the history data
# This includes daily and monthly average view counts, and daily and monthly time spent streaming
# This is done for all vtubers, regardless of whether they are live or not, as we only are able to track certain data points for offline vtubers
# As such, this function is obscenely long, and REALLY needs to get optimized at some point
def history_cycle(vtubers, history, last_online):
    start_time = time.time()
    print(f"{bcolors.OKCYAN}START{bcolors.ENDC}: Updating history data...")
    year = time.strftime('%Y')
    month = time.strftime('%B')
    month_int = int(time.strftime('%m'))
    day = int(time.strftime('%d'))
    history_template = create_history()
    if not history:
        for vtuber in vtubers:
            history[vtuber] = {time.strftime('%Y') : history_template}
    else:
        for vtuber in vtubers:
            # If our vtuber is freshly added and also offline, they will not have a valid twitch API response to work with, and no history to update.
            if not vtubers[vtuber]['twitch']:
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
                # if the vtuber is offline and is NOT in the last_online list, then skip them
                if vtubers[vtuber]['twitch']['type'] == '' and vtuber not in last_online:
                    continue
                history[vtuber][year][month]['instances'] += 1
                # If the current value of the daily view average is zero, set instance to 1, as this is the first time the vtuber has been online today
                if history[vtuber][year][month]['daily_view_avg'][day-1] == 0:
                    history[vtuber][year][month]['instances'] = 1
                current_viewers = vtubers[vtuber]['twitch']['viewer_count']
                daily_avg = history[vtuber][year][month]['daily_view_avg'][day-1]
                instance = history[vtuber][year][month]['instances']
                history[vtuber][year][month]['daily_view_avg'][day-1] = ((daily_avg * (instance -1)) + current_viewers) / instance
                history[vtuber][year][month]['monthly_view_avg'] = sum(history[vtuber][year][month]['daily_view_avg'][0:day-1]) / day
                if vtubers[vtuber]['twitch']['user_login'] in last_online and vtubers[vtuber]['twitch']['type'] != 'live':
                    if time.strftime('%Y-%m-%d') == vtubers[vtuber]['twitch']['started_at'][:10]:
                        stream_length = (datetime.datetime.now() - datetime.datetime.strptime(vtubers[vtuber]['twitch']['started_at'], '%Y-%m-%dT%H:%M:%SZ')).total_seconds()
                        history[vtuber][year][month]['daily_time'][day-1] += stream_length
                        history[vtuber][year][month]['monthly_time_avg'] = sum(history[vtuber][year][month]['daily_time'][0:day-1]) / day
                    # If the last stream took place over multiple days, we need to do some math
                    else:
                        stream_start = datetime.datetime.strptime(vtubers[vtuber]['twitch']['started_at'], '%Y-%m-%dT%H:%M:%SZ')
                        stream_end = datetime.datetime.now()
                        stream_length = (stream_end - stream_start).days
                        stream_days = [stream_start + datetime.timedelta(days=x) for x in range(0, stream_length)]
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
    print(f"{bcolors.OKGREEN}COMPLETE{bcolors.ENDC}: Updated history for {len(history)} vtubers in {(time.time() - start_time):.2f} seconds.")
    return history


def push_update(vtubers, live, history):
    start_time = time.time()
    print(f"{bcolors.OKCYAN}START{bcolors.ENDC}: Uploading to S3...")
    upload_to_s3(vtubers, 'vtubers.json')
    upload_to_s3(live, 'live.json')
    upload_to_s3(history, 'history.json')
    print(f"{bcolors.OKGREEN}COMPLETE{bcolors.ENDC}: Upload to S3 completed in {(time.time() - start_time):.2f}. All done!")


# Fetch the master VTuber list, the live Vtuber list, and the history file, update them all, then re-upload
def lambda_handler(event, context):
    auth = validate_token()
    vtubers, live, history = fetch_S3()
    if live:
        last_online = set(live.keys())
        live, offline_cap = live_cycle(live, auth)
    else:
        offline_cap = 80000
        last_online = set()
    vtubers = offline_cycle(vtubers, live, auth, offline_cap)
    live, vtubers = crossplay(live, vtubers)
    history = history_cycle(vtubers, history, last_online)
    push_update(vtubers, live, history)