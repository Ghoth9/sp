import os
import sqlite3
import shutil

user_dir = os.path.expanduser("~")
hp = os.path.join(user_dir, "AppData", "Roaming", "Opera Software", "Opera GX Stable", "Default", "History")

if os.path.exists(hp):
    print("Found Opera GX History!")
    temp_hp = hp + "_temp"
    try:
        shutil.copyfile(hp, temp_hp)
        conn = sqlite3.connect(temp_hp)
        cursor = conn.cursor()
        cursor.execute("SELECT url, title FROM urls WHERE url LIKE '%spairdee%' OR url LIKE '%/sp/%' OR title LIKE '%Spairdee%' ORDER BY last_visit_time DESC LIMIT 20")
        rows = cursor.fetchall()
        
        with open("opera_urls.txt", "w", encoding="utf-8") as out:
            out.write("Last visited Spairdee URLs in Opera GX:\n")
            for r in rows:
                out.write(f"  URL: {r[0]} | Title: {r[1]}\n")
        print("Wrote to opera_urls.txt")
        conn.close()
    except Exception as e:
        print("Error:", e)
    finally:
        if os.path.exists(temp_hp):
            os.remove(temp_hp)
else:
    print("Opera GX History not found at:", hp)
