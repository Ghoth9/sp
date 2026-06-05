import urllib.request
import re

url = "https://www.spairdee.com/"
try:
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'Mozilla/5.0'}
    )
    with urllib.request.urlopen(req, timeout=5) as response:
        html = response.read().decode('utf-8')
        print("Successfully fetched www.spairdee.com website!")
        # Find version
        version = re.findall(r'id="sidebar-version">Spairdee (v[\d\.]+)<\/div>', html)
        print("Sidebar version on www.spairdee.com:", version)
        # Find logo query versions
        logo_queries = re.findall(r'logo\.png\?v=([\d\.]+)', html)
        print("Logo query versions on www.spairdee.com:", logo_queries)
except Exception as e:
    print("Error fetching URL:", e)
