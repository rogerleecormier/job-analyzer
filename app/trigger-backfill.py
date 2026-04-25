#!/usr/bin/env python3
import urllib.request
import json
import time

BASE_URL = 'https://job-analyzer.rcormier.workers.dev'

def backfill():
    try:
        print('Starting backfill...')
        url = f'{BASE_URL}/api/backfill-resume-tracking'
        req = urllib.request.Request(url, method='POST')
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            print('Backfill result:', json.dumps(data, indent=2))
            return data
    except Exception as e:
        print(f'Backfill error: {e}')
        return None

def aggregate():
    try:
        print('\nStarting aggregation...')
        url = f'{BASE_URL}/api/manually-aggregate-analytics'
        req = urllib.request.Request(url, method='POST')
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            print('Aggregation result:', json.dumps(data, indent=2))
            return data
    except Exception as e:
        print(f'Aggregation error: {e}')
        return None

def main():
    backfill()
    time.sleep(2)
    aggregate()

if __name__ == '__main__':
    main()
