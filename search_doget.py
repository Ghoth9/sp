import re

with open(r"c:\Users\golst\OneDrive\Documents\GitHub\sp\gas\Code.js", "r", encoding="utf-8") as f:
    code = f.read()

if "doGet" in code:
    do_get = re.findall(r"function doGet[\s\S]+?\}", code)
    with open("doget_output.txt", "w", encoding="utf-8") as out:
        for dg in do_get:
            out.write(dg)
            out.write("\n" + "-"*30 + "\n")
    print("Wrote to doget_output.txt")
else:
    print("doGet not found")
