import os
import json
import sqlite3
import shutil
import re

user_dir = os.path.expanduser("~")

history_paths = [
    # Chrome
    os.path.join(user_dir, "AppData", "Local", "Google", "Chrome", "User Data", "Default", "History"),
    # Opera GX
    os.path.join(user_dir, "AppData", "Roaming", "Opera Software", "Opera GX Stable", "History"),
    # Edge
    os.path.join(user_dir, "AppData", "Local", "Microsoft", "Edge", "User Data", "Default", "History")
]

with open("browser_urls.txt", "w", encoding="utf-8") as out:
    for hp in history_paths:
        if os.path.exists(hp):
            out.write(f"Found history file: {hp}\n")
            temp_hp = hp + "_temp"
            try:
                shutil.copyfile(hp, temp_hp)
                conn = sqlite3.connect(temp_hp)
                cursor = conn.cursor()
                cursor.execute("SELECT url, title FROM urls WHERE url LIKE '%spairdee%' OR url LIKE '%/sp/%' OR title LIKE '%Spairdee%' ORDER BY last_visit_time DESC LIMIT 20")
                rows = cursor.fetchall()
                out.write(f"Last visited Spairdee URLs in {os.path.basename(os.path.dirname(hp))}:\n")
                for r in rows:
                    out.write(f"  URL: {r[0]} | Title: {r[1]}\n")
                conn.close()
            except Exception as e:
                out.write(f"Error reading history: {e}\n")
            finally:
                if os.path.exists(temp_hp):
                    try:
                        os.remove(temp_hp)
                    except Exception as e:
                        out.write(f"Error removing temp file: {e}\n")
            out.write("\n")

print("Wrote to browser_urls.txt")
