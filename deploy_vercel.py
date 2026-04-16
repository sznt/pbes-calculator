#!/usr/bin/env python3
"""Deploy App.html + api/chat.js to Vercel project pbes-calculator."""
import base64, json, os, urllib.request

FOLDER = os.path.dirname(os.path.abspath(__file__))
TOKEN = 'YOUR_VERCEL_TOKEN'
PROJECT_ID = 'prj_TQtwBurp6q0EgsSLondg2GEFn58I'
HEADERS = {'Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json', 'User-Agent': 'pbes-deployer'}

FILES_TO_DEPLOY = [
    ('App.html',                  'index.html'),
    ('api/chat.js',               'api/chat.js'),
    ('api/admin-data.js',         'api/admin-data.js'),
    ('api/send-peer-invite.js',   'api/send-peer-invite.js'),
    ('api/benchmarks.js',         'api/benchmarks.js'),
    ('vercel.json',               'vercel.json'),
]

def api(method, path, data=None):
    url = f'https://api.vercel.com{path}'
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

# 1. Read and encode all files
print("Reading files...")
files_payload = []
for local_name, deploy_name in FILES_TO_DEPLOY:
    path = os.path.join(FOLDER, local_name)
    if not os.path.exists(path):
        print(f"  ⚠️  Skipping {local_name} — not found")
        continue
    with open(path, 'rb') as f:
        raw = f.read()
    size_kb = len(raw) / 1024
    b64 = base64.b64encode(raw).decode('ascii')
    files_payload.append({'file': deploy_name, 'data': b64, 'encoding': 'base64'})
    print(f"  ✓  {deploy_name}  ({size_kb:.1f} KB)")

# 2. Create deployment with all files inline
print(f"\nCreating Vercel deployment ({len(files_payload)} files)...")
deploy_payload = {
    'name': 'pbes-calculator',
    'project': PROJECT_ID,
    'target': 'production',
    'files': files_payload,
    'projectSettings': {
        'framework': None,
        'outputDirectory': None,
        'installCommand': None,
        'buildCommand': None,
        'devCommand': None,
    }
}

status, resp = api('POST', '/v13/deployments', data=deploy_payload)
print(f"  HTTP {status}")

if status in (200, 201):
    dep_url  = resp.get('url', '')
    dep_id   = resp.get('id', '')
    dep_state = resp.get('readyState', resp.get('status', 'unknown'))
    print(f"\n✅ Deployment created!")
    print(f"   ID:         {dep_id}")
    print(f"   Preview:    https://{dep_url}")
    print(f"   Production: https://pbes-calculator.vercel.app")
    print(f"   State:      {dep_state}")

    # 3. Poll until READY
    if dep_state not in ('READY', 'ERROR', 'CANCELED'):
        import time
        print("\nWaiting for deployment to go live", end='', flush=True)
        for _ in range(40):
            time.sleep(3)
            s, r = api('GET', f'/v13/deployments/{dep_id}')
            state = r.get('readyState', r.get('status', ''))
            print('.', end='', flush=True)
            if state in ('READY', 'ERROR', 'CANCELED'):
                print(f"\n  Final state: {state}")
                if state == 'READY':
                    print(f"\n🎉 Live at https://pbes-calculator.vercel.app")
                    print(f"   Chat API: https://pbes-calculator.vercel.app/api/chat")
                break
        else:
            print("\n  (timed out — check Vercel dashboard)")
    else:
        if dep_state == 'READY':
            print(f"\n🎉 Live at https://pbes-calculator.vercel.app")
else:
    print(f"\n❌ Deployment failed:")
    print(json.dumps(resp, indent=2))

print("\n⚠️  IMPORTANT — if chat returns 'API key not configured':")
print("   Vercel Dashboard → pbes-calculator → Settings → Environment Variables")
print("   Add: ANTHROPIC_API_KEY = sk-ant-...")
