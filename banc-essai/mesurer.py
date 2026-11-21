"""Banc d'essai comparatif : La Cigale, Firefox ESR, Chrome, Edge (Windows).

Chaque navigateur est lancé sans interface (headless), avec un profil vierge, sur la même
page locale. Le serveur mesure :
  * le démarrage : du lancement du processus à la première requête de la page ;
  * trois épreuves (JavaScript, DOM, Canvas 2D), médiane de 5 tours, chronométrées côté serveur ;
  * la mémoire : somme des processus du navigateur une fois les épreuves terminées.

Usage : python banc-essai/mesurer.py [navigateur ...] [--sortie fichier.json]
        (par défaut : tous, résultats dans banc-essai/resultats.json)
"""
import http.server
import json
import os
import shutil
import statistics
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

ICI = Path(__file__).resolve().parent
RACINE = ICI.parent
PORT = 8799
PF, PF86 = os.environ.get("ProgramFiles", r"C:\Program Files"), os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")

NAVIGATEURS = {
    "La Cigale": (RACINE / "dist" / "LaCigale" / "lacigale.exe", "gecko"),
    "Firefox ESR": (RACINE / "construction" / "extrait" / "core" / "firefox.exe", "gecko"),
    "Chrome": (Path(PF) / "Google" / "Chrome" / "Application" / "chrome.exe", "chromium"),
    "Edge": (Path(PF86) / "Microsoft" / "Edge" / "Application" / "msedge.exe", "chromium"),
}

etat = {}


class Gestionnaire(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        chemin, _, requete = self.path.partition("?")
        maintenant = time.perf_counter()
        if chemin in ("/", "/page.html"):
            corps = (ICI / "page.html").read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
        else:
            nom = requete.removeprefix("t=")
            if chemin == "/pret":
                etat.setdefault("pret", maintenant)
            elif chemin == "/debut":
                etat["debut"] = maintenant
            elif chemin == "/fin":
                etat.setdefault("mesures", {}).setdefault(nom, []).append((maintenant - etat["debut"]) * 1000)
            elif chemin == "/termine":
                etat["termine"] = True
            corps = b"ok"
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(corps)))
        self.end_headers()
        self.wfile.write(corps)


def memoire_mo(pid: int) -> float:
    """Mémoire privée (Mo) de l'arbre de processus lancé par le banc, et de lui seul
    (les navigateurs déjà ouverts par l'utilisateur ne sont ni comptés ni fermés)."""
    ps = f"""
$tous = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId
$arbre = @({pid}); $i = 0
while ($i -lt $arbre.Count) {{ $arbre += @($tous | Where-Object ParentProcessId -eq $arbre[$i] | ForEach-Object ProcessId); $i++ }}
(Get-Process -Id $arbre -ErrorAction SilentlyContinue | Measure-Object PrivateMemorySize64 -Sum).Sum
"""
    sortie = subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True, text=True).stdout.strip()
    return round(int(sortie or 0) / 1024 / 1024)


def tuer(pid: int):
    subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)], capture_output=True)


def mesurer(nom: str, exe: Path, moteur: str, url: str) -> dict:
    profil = tempfile.mkdtemp(prefix="banc-")
    if moteur == "gecko":
        cmd = [str(exe), "--headless", "--no-remote", "-profile", profil, url]
    else:
        cmd = [str(exe), "--headless=new", f"--user-data-dir={profil}", "--no-first-run",
               "--no-default-browser-check", "--disable-extensions", url]
    etat.clear()
    lancement = time.perf_counter()
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    limite = lancement + 600
    while not etat.get("termine") and time.perf_counter() < limite:
        time.sleep(0.2)
    memoire = memoire_mo(proc.pid)
    tuer(proc.pid)
    time.sleep(2)
    shutil.rmtree(profil, ignore_errors=True)
    if not etat.get("termine"):
        raise RuntimeError(f"{nom} : épreuves non terminées")
    return {
        "demarrage_ms": round((etat["pret"] - lancement) * 1000),
        **{f"{k}_ms": round(statistics.median(v)) for k, v in etat["mesures"].items()},
        "memoire_mo": memoire,
    }


def main():
    serveur = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Gestionnaire)
    threading.Thread(target=serveur.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{PORT}/page.html"
    args = sys.argv[1:]
    sortie = ICI / "resultats.json"
    if "--sortie" in args:
        i = args.index("--sortie")
        sortie = Path(args[i + 1])
        del args[i:i + 2]
    choisis = {n: v for n, v in NAVIGATEURS.items() if not args or n in args}
    resultats = {}
    for nom, (exe, moteur) in choisis.items():
        if not exe.exists():
            print(f"{nom} : absent, ignoré")
            continue
        essais = [mesurer(nom, exe, moteur, url) for _ in range(3)]  # 3 lancements, médiane
        resultats[nom] = {k: round(statistics.median(e[k] for e in essais)) for k in essais[0]}
        print(nom, resultats[nom], flush=True)
    serveur.shutdown()
    sortie.write_text(json.dumps(resultats, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
