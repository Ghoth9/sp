import subprocess

try:
    output = subprocess.check_output(
        ["git", "log", "-S", "Cloud Sync", "--oneline"],
        stderr=subprocess.DEVNULL
    ).decode('utf-8')
    print("Git commits mentioning Cloud Sync:")
    print(output)
except Exception as e:
    print("Error:", e)
