<#
.SYNOPSIS
  Construit La Cigale pour Windows (x64) à partir de Firefox ESR en français.

.DESCRIPTION
  1. Récupère la dernière version ESR auprès de Mozilla (product-details).
  2. Télécharge l'installeur officiel français depuis archive.mozilla.org.
  3. Vérifie la somme SHA-512 publiée par Mozilla ET la signature Authenticode.
  4. Extrait, applique réglages durcis, page d'accueil et identité La Cigale.
  5. Produit une version portable (.zip) et, si Inno Setup est installé, un installeur.

.EXAMPLE
  .\construire-windows.ps1
  .\construire-windows.ps1 -Version 140.5.0esr -SansInstalleur
#>
[CmdletBinding()]
param(
  [string]$Version,                 # ex. 140.5.0esr ; par défaut, la dernière ESR
  [switch]$SansRebrand,             # ne pas modifier omni.ja (diagnostic)
  [switch]$SansInstalleur
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Racine   = $PSScriptRoot
$Cache    = Join-Path $Racine 'construction\cache'
$Extrait  = Join-Path $Racine 'construction\extrait'
$Sorties  = Join-Path $Racine 'dist'
$Dist     = Join-Path $Sorties 'LaCigale'
$VersionCigale = (Get-Content (Join-Path $Racine 'VERSION') -Raw).Trim()

function Write-Etape($texte) { Write-Host "`n==> $texte" -ForegroundColor White }
function Find-Outil($noms, $chemins) {
  foreach ($n in $noms) { $c = Get-Command $n -ErrorAction SilentlyContinue; if ($c) { return $c.Source } }
  foreach ($p in $chemins) { if ($p -and (Test-Path $p)) { return $p } }
  return $null
}

# ------------------------------------------------------------------ Outils
Write-Etape 'Vérification des outils'
$python = Find-Outil @('python', 'py') @()
if (-not $python) { throw 'Python 3 est requis (https://www.python.org).' }
& $python -c 'import PIL' 2>$null
if ($LASTEXITCODE -ne 0) { throw 'Pillow est requis : python -m pip install Pillow' }
$7z = Find-Outil @('7z') @("$env:ProgramFiles\7-Zip\7z.exe", "${env:ProgramFiles(x86)}\7-Zip\7z.exe")
if (-not $7z) { throw '7-Zip est requis pour extraire l''installeur Firefox (https://www.7-zip.org).' }
$rcedit = Find-Outil @('rcedit-x64', 'rcedit') @((Join-Path $Racine 'outils\rcedit-x64.exe'))
$iscc   = Find-Outil @('iscc') @("${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:ProgramFiles\Inno Setup 6\ISCC.exe", "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe")

# ---------------------------------------------------------------- Version
if (-not $Version) {
  Write-Etape 'Recherche de la dernière version de Firefox ESR'
  $Version = (Invoke-RestMethod 'https://product-details.mozilla.org/1.0/firefox_versions.json').FIREFOX_ESR
}
if ($Version -notmatch '^\d+\.\d+(\.\d+)?esr$') { throw "Version ESR invalide : $Version" }
Write-Host "Firefox ESR $Version  ->  La Cigale $VersionCigale"

# ----------------------------------------------------------- Téléchargement
Write-Etape 'Téléchargement depuis archive.mozilla.org'
New-Item -ItemType Directory -Force $Cache | Out-Null
$base     = "https://archive.mozilla.org/pub/firefox/releases/$Version"
$nomSetup = "Firefox Setup $Version.exe"
$setup    = Join-Path $Cache $nomSetup
$sommes   = Join-Path $Cache "SHA512SUMS-$Version"
if (-not (Test-Path $setup)) {
  Invoke-WebRequest "$base/win64/fr/$([uri]::EscapeDataString($nomSetup))" -OutFile "$setup.part"
  Move-Item "$setup.part" $setup -Force
}
Invoke-WebRequest "$base/SHA512SUMS" -OutFile $sommes

Write-Etape 'Vérification de l''intégrité'
$ligne = Get-Content $sommes | Where-Object { $_ -like "* win64/fr/$nomSetup" } | Select-Object -First 1
if (-not $ligne) { throw "Somme SHA-512 introuvable pour win64/fr/$nomSetup" }
$attendu = $ligne.Split(' ')[0].ToLower()
$obtenu  = (Get-FileHash $setup -Algorithm SHA512).Hash.ToLower()
if ($attendu -ne $obtenu) { Remove-Item $setup; throw 'SHA-512 incorrect : fichier corrompu ou falsifié, supprimé.' }
Write-Host 'SHA-512 conforme.'
$sig = Get-AuthenticodeSignature $setup
if ($sig.Status -ne 'Valid' -or $sig.SignerCertificate.Subject -notmatch 'O="?Mozilla Corporation') {
  throw "Signature Authenticode invalide : $($sig.Status) / $($sig.SignerCertificate.Subject)"
}
Write-Host 'Signature Mozilla Corporation valide.'

# ---------------------------------------------------------------- Extraction
Write-Etape 'Extraction'
foreach ($d in @($Extrait, $Dist)) { if (Test-Path $d) { Remove-Item $d -Recurse -Force } }
& $7z x $setup "-o$Extrait" -y | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Échec de l''extraction 7-Zip.' }
Copy-Item (Join-Path $Extrait 'core') $Dist -Recurse

# --------------------------------------------------------------- Identité
Write-Etape 'Application de la configuration La Cigale'
Rename-Item (Join-Path $Dist 'firefox.exe') 'lacigale.exe'
# Mise à jour automatique, rapports de plantage et agent « navigateur par défaut » : retirés.
foreach ($inutile in @('default-browser-agent.exe', 'updater.exe', 'updater.ini', 'update-settings.ini',
                       'maintenanceservice.exe', 'maintenanceservice_installer.exe',
                       'crashreporter.exe', 'crashreporter.ini', 'pingsender.exe', 'minidump-analyzer.exe')) {
  $f = Join-Path $Dist $inutile
  if (Test-Path $f) { Remove-Item $f -Force }
}
$reglages = Join-Path $Racine 'reglages'
Copy-Item (Join-Path $reglages 'cigale.cfg') $Dist
New-Item -ItemType Directory -Force (Join-Path $Dist 'defaults\pref'), (Join-Path $Dist 'distribution'), (Join-Path $Dist 'cigale') | Out-Null
Copy-Item (Join-Path $reglages 'defaults\pref\autoconfig.js') (Join-Path $Dist 'defaults\pref')
Copy-Item (Join-Path $reglages 'distribution\policies.json') (Join-Path $Dist 'distribution')
Copy-Item (Join-Path $Racine 'accueil') (Join-Path $Dist 'cigale\accueil') -Recurse
Copy-Item (Join-Path $Racine 'branding\lacigale.ico') $Dist

if (-not $SansRebrand) {
  & $python (Join-Path $Racine 'outils\rebrander_omni.py') $Dist
  if ($LASTEXITCODE -ne 0) { throw 'Échec du rebranding d''omni.ja.' }
}

# Toutes les icônes des exécutables (application, liste de raccourcis, documents, PDF)
foreach ($exe in @('lacigale.exe', 'private_browsing.exe')) {
  $chemin = Join-Path $Dist $exe
  if (Test-Path $chemin) {
    & $python (Join-Path $Racine 'outils\icones_exe.py') remplacer $chemin
    if ($LASTEXITCODE -ne 0) { throw "Échec du remplacement des icônes de $exe." }
  }
}

if ($rcedit) {
  $metadonnees = @{
    'lacigale.exe'         = @('La Cigale', 'lacigale')
    'private_browsing.exe' = @('La Cigale - Navigation privée', 'private_browsing')
  }
  foreach ($exe in $metadonnees.Keys) {
    $chemin = Join-Path $Dist $exe
    if (-not (Test-Path $chemin)) { continue }
    $description, $interne = $metadonnees[$exe]
    & $rcedit $chemin `
      --set-version-string ProductName 'La Cigale' --set-version-string FileDescription $description `
      --set-version-string CompanyName 'Projet La Cigale' --set-version-string InternalName $interne `
      --set-version-string OriginalFilename $exe --set-version-string LegalTrademarks '' `
      --set-version-string LegalCopyright 'Projet La Cigale, MPL-2.0, dérivé de Mozilla Firefox' `
      --set-product-version $VersionCigale
    if ($LASTEXITCODE -ne 0) { throw "Échec de rcedit sur $exe." }
  }
  Write-Host 'Métadonnées des exécutables mises à jour.'
} else {
  Write-Warning 'rcedit absent : les propriétés de lacigale.exe mentionnent encore Firefox. Placez rcedit-x64.exe dans outils\ (https://github.com/electron/rcedit/releases).'
}

# Lanceur portable : profil dédié à côté du programme, jamais celui de Firefox.
@'
@echo off
if not exist "%~dp0Profil" mkdir "%~dp0Profil"
start "" "%~dp0lacigale.exe" -profile "%~dp0Profil" %*
'@ | Set-Content (Join-Path $Dist 'La Cigale (portable).cmd') -Encoding ascii
Set-Content (Join-Path $Dist 'VERSION.txt') "La Cigale $VersionCigale (Firefox ESR $Version)" -Encoding utf8

# -------------------------------------------------------------- Paquets
Write-Etape 'Création de la version portable'
$zip = Join-Path $Sorties "LaCigale-$VersionCigale-windows-x64-portable.zip"
if (Test-Path $zip) { Remove-Item $zip }
Compress-Archive -Path $Dist -DestinationPath $zip -CompressionLevel Optimal
Write-Host "-> $zip"

if (-not $SansInstalleur) {
  if ($iscc) {
    Write-Etape 'Création de l''installeur (Inno Setup)'
    & $iscc "/DVersionCigale=$VersionCigale" "/DVersionFirefox=$Version" "/O$Sorties" (Join-Path $Racine 'installeur\lacigale.iss')
    if ($LASTEXITCODE -ne 0) { throw 'Échec d''Inno Setup.' }
  } else {
    Write-Warning 'Inno Setup 6 absent : pas d''installeur .exe (https://jrsoftware.org/isdl.php).'
  }
}

Write-Etape "Terminé. Pour tester : & '$Dist\La Cigale (portable).cmd'"
