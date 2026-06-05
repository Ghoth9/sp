import os
import re

js_dir = r"c:\Users\golst\OneDrive\Documents\GitHub\sp\js"
for f in os.listdir(js_dir):
    if f.endswith('.js'):
        path = os.path.join(js_dir, f)
        with open(path, 'r', encoding='utf-8') as file:
            for i, line in enumerate(file):
                if "settings-advanced-cloud-url" in line:
                    print(f"{f} Line {i+1}: {line.strip()}")
