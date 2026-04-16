#!/usr/bin/env python3
import base64, json, urllib.request, os

FOLDER = os.path.dirname(os.path.abspath(__file__))
HTML_PATH = os.path.join(FOLDER, 'App.html')
TOKEN = 'YOUR_GITHUB_TOKEN'
REPO = 'sznt/pbes-calculator'
HEADERS = {'Authorization': f'token {TOKEN}', 'Content-Type': 'application/json', 'User-Agent': 'pbes-uploader'}

def api(method, path, data=None):
    url = f'https://api.github.com{path}'
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=HEADERS, method=method)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

print("Reading App.html...")
with open(HTML_PATH, 'rb') as f:
    b64 = base64.b64encode(f.read()).decode()
print(f"Base64 size: {len(b64)} chars")

print("Creating blob...")
blob = api('POST', f'/repos/{REPO}/git/blobs', {'content': b64, 'encoding': 'base64'})
print(f"Blob SHA: {blob['sha']}")

print("Getting HEAD ref...")
ref = api('GET', f'/repos/{REPO}/git/refs/heads/main')
commit_sha = ref['object']['sha']
print(f"Commit SHA: {commit_sha}")

print("Getting tree...")
commit = api('GET', f'/repos/{REPO}/git/commits/{commit_sha}')
tree_sha = commit['tree']['sha']
print(f"Tree SHA: {tree_sha}")

print("Creating new tree...")
new_tree = api('POST', f'/repos/{REPO}/git/trees', {
    'base_tree': tree_sha,
    'tree': [{'path': 'index.html', 'mode': '100644', 'type': 'blob', 'sha': blob['sha']}]
})
print(f"New tree SHA: {new_tree['sha']}")

print("Creating commit...")
new_commit = api('POST', f'/repos/{REPO}/git/commits', {
    'message': 'Add index.html (main app)',
    'tree': new_tree['sha'],
    'parents': [commit_sha]
})
print(f"New commit SHA: {new_commit['sha']}")

print("Updating ref...")
updated = api('PATCH', f'/repos/{REPO}/git/refs/heads/main', {'sha': new_commit['sha']})
print(f"SUCCESS! Ref updated to: {updated['object']['sha']}")
