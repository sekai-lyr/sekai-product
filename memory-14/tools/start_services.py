"""Start the local SekaiAI application and its ykd-7 travel backend."""

import os
from pathlib import Path
import shutil
import subprocess
import time
import urllib.error
import urllib.request


ROOT = Path(__file__).resolve().parents[1]


def ready(url):
    try:
        with urllib.request.urlopen(url, timeout=2) as response:
            return response.status == 200
    except (OSError, urllib.error.URLError):
        return False


def start_service(root, jar, health, name, *arguments):
    if ready(health):
        print(f"{name} is already running.")
        return
    jar_path = root / "target" / jar
    if not jar_path.is_file():
        raise RuntimeError(f"Build {root} with mvn -DskipTests package first.")
    socket_directory = ROOT / "outputs"
    socket_directory.mkdir(exist_ok=True)
    configured_java = Path(os.environ.get("JAVA_HOME", "")) / "bin" / ("java.exe" if os.name == "nt" else "java")
    java = str(configured_java) if configured_java.is_file() else shutil.which("java") or "java"
    command = [java, "-Djava.net.preferIPv4Stack=true",
               "-Dfile.encoding=UTF-8", "-Duser.timezone=Asia/Shanghai",
               f"-Djdk.net.unixdomain.tmpdir={socket_directory}", "-jar", str(jar_path), *arguments]
    with (root / "target" / "app.stdout.log").open("wb") as stdout, \
            (root / "target" / "app.stderr.log").open("wb") as stderr:
        process = subprocess.Popen(command, cwd=root, stdout=stdout, stderr=stderr,
                                   creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
    deadline = time.monotonic() + 40
    while time.monotonic() < deadline:
        if ready(health):
            print(f"{name} is ready.")
            return
        if process.poll() is not None:
            break
        time.sleep(0.5)
    raise RuntimeError(f"{name} did not start (exit={process.poll()}). Check {root / 'target' / 'app.stderr.log'} and app.stdout.log.")


if __name__ == "__main__":
    start_service(ROOT / "integrations" / "ykd-7", "claw-1.0.0.jar",
                  "http://127.0.0.1:8096/api/sekai/health", "Travel backend", "--spring.profiles.active=sekai")
    start_service(ROOT, "anime-ai-1.0.0-SNAPSHOT.jar",
                  "http://127.0.0.1:8094/api/auth/me", "SekaiAI")
    print("SekaiAI: http://127.0.0.1:8094/assistants")
