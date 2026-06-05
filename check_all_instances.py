import urllib.request
import re
import os

urls = {
    "Netlify Root": "https://spairdee.netlify.app/",
    "Netlify Index": "https://spairdee.netlify.app/index.html",
    "GitHub Pages Root": "https://ghoth9.github.io/sp/",
    "GitHub Pages Index": "https://ghoth9.github.io/sp/index.html",
}

for name, url in urls.items():
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            html = response.read().decode('utf-8')
            version = re.findall(r'id="sidebar-version">Spairdee (v[\d\.]+)<\/div>', html)
            logo_queries = re.findall(r'logo\.png\?v=([\d\.]+)', html)
            print(f"{name} ({url}):")
            print(f"  Status: 200 OK")
            print(f"  Version: {version}")
            print(f"  Logo Query: {logo_queries}")
    except Exception as e:
        print(f"{name} ({url}): Error: {e}")

# Check local files
local_paths = [
    r"C:\Users\golst\OneDrive\Documents\GitHub\cru-line-chatbot\SP\index.html",
    r"C:\Users\golst\OneDrive\Documents\GitHub\sp\index.html"
]

for lp in local_paths:
    exists = os.path.exists(lp)
    print(f"Local Path {lp}: Exists = {exists}")
    if exists:
        with open(lp, 'r', encoding='utf-8') as f:
            html = f.read()
            version = re.findall(r'id="sidebar-version">Spairdee (v[\d\.]+)<\/div>', html)
            print(f"  Version: {version}")
