# Compile installeur\Installeur.cs autour du zip portable.
# csc.exe (.NET Framework 4) est déjà présent sur Windows, rien à installer.
param(
  [Parameter(Mandatory)] [string]$Charge,          # LaCigale-…-portable.zip
  [Parameter(Mandatory)] [string]$VersionCigale,
  [Parameter(Mandatory)] [string]$VersionFirefox,
  [Parameter(Mandatory)] [string]$Sortie,          # chemin du .exe à produire
  [string]$ChargeEn                                # zip anglais : l'installeur propose alors Français / English
)
$ErrorActionPreference = 'Stop'
$Ici = $PSScriptRoot
$Racine = Split-Path $Ici -Parent
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { throw ".NET Framework 4 introuvable ($csc)." }

$travail = Join-Path $Racine 'construction\installeur'
if (Test-Path $travail) { Remove-Item $travail -Recurse -Force }
New-Item -ItemType Directory -Force $travail | Out-Null

Copy-Item (Join-Path $Racine 'accueil\img\fond.jpg') (Join-Path $travail 'fond.jpg')
Copy-Item (Join-Path $Racine 'branding\png\symbole-blanc-1024.png') (Join-Path $travail 'symbole.png')
Copy-Item (Join-Path $Racine 'LICENCE.txt') (Join-Path $travail 'LICENCE.txt')
[IO.File]::WriteAllText((Join-Path $travail 'version.txt'), "$VersionCigale|$VersionFirefox", [Text.UTF8Encoding]::new($false))

$communs = @(
  '/nologo', '/target:winexe', '/optimize+', '/platform:anycpu',
  "/win32icon:$(Join-Path $Racine 'branding\lacigale.ico')",
  "/win32manifest:$(Join-Path $Ici 'app.manifest')",
  '/r:System.dll', '/r:System.Core.dll', '/r:System.Drawing.dll', '/r:System.Windows.Forms.dll',
  '/r:System.IO.Compression.dll', '/r:Microsoft.CSharp.dll'
)
foreach ($r in 'fond.jpg', 'symbole.png', 'LICENCE.txt', 'version.txt') { $communs += "/resource:$(Join-Path $travail $r),$r" }
$source = Join-Path $Ici 'Installeur.cs'

$desinstalleur = Join-Path $travail 'desinstaller.exe'
& $csc @communs "/out:$desinstalleur" $source
if ($LASTEXITCODE -ne 0) { throw 'Échec de la compilation du désinstalleur.' }

$charges = @("/resource:$Charge,charge.zip")
if ($ChargeEn) { $charges += "/resource:$ChargeEn,charge-en.zip" }
& $csc @communs "/out:$Sortie" "/resource:$desinstalleur,desinstaller.exe" @charges $source
if ($LASTEXITCODE -ne 0) { throw 'Échec de la compilation de l''installeur.' }
Write-Host "-> $Sortie"
