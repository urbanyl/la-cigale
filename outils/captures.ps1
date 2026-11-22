<#
.SYNOPSIS
  Photographie de vraies fenêtres de La Cigale (onglets compris) pour le README.
  Profil temporaire, fenêtre 1600x1000, image dans docs\captures\.
#>
param([string]$Sortie = (Join-Path $PSScriptRoot '..\docs\captures'))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System; using System.Runtime.InteropServices;
public static class Fenetre {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int hh, bool r);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int a, out RECT r, int s);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint f);
  public static RECT Cadre(IntPtr h) { RECT r; if (DwmGetWindowAttribute(h, 9, out r, 16) != 0 || r.R <= r.L) GetWindowRect(h, out r); return r; }
}
'@
New-Item -ItemType Directory -Force $Sortie | Out-Null
$exe = (Resolve-Path (Join-Path $PSScriptRoot '..\dist\LaCigale\lacigale.exe')).Path
$accueil = 'file:///' + ((Resolve-Path (Join-Path $PSScriptRoot '..\dist\LaCigale\cigale\accueil\index.html')).Path -replace '\\', '/')

function Save-Fenetre($nom, $argsNav, $attente, $attendVide = $true) {
  $profil = Join-Path $env:TEMP "cigale-capture-$(Get-Random)"
  New-Item -ItemType Directory $profil | Out-Null
  # Le lanceur de Firefox relance le navigateur puis se termine : on repère les nouveaux
  # processus (ceux déjà ouverts par l'utilisateur ne sont pas touchés).
  $avant = @(Get-Process lacigale -ErrorAction SilentlyContinue | ForEach-Object Id)
  Start-Process $exe -ArgumentList (@('-no-remote', '-profile', "`"$profil`"") + $argsNav) | Out-Null
  $h = [IntPtr]::Zero; $p = $null
  for ($i = 0; $i -lt 60 -and $h -eq [IntPtr]::Zero; $i++) {
    Start-Sleep -Milliseconds 500
    $p = Get-Process lacigale -ErrorAction SilentlyContinue |
      Where-Object { $avant -notcontains $_.Id -and $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1
    if ($p) { $h = $p.MainWindowHandle }
  }
  if (-not $p) { throw "Fenêtre introuvable pour $nom" }
  Start-Sleep -Seconds 3
  $h = (Get-Process -Id $p.Id).MainWindowHandle
  [Fenetre]::MoveWindow($h, 40, 40, 1600, 1000, $true) | Out-Null
  Start-Sleep -Seconds $attente
  # La première fenêtre peut être l'écran de démarrage : on reprend celle du navigateur chargé.
  $h = (Get-Process -Id $p.Id).MainWindowHandle
  [Fenetre]::ShowWindow($h, 9) | Out-Null
  [Fenetre]::MoveWindow($h, 40, 40, 1600, 1000, $true) | Out-Null
  [Fenetre]::SetForegroundWindow($h) | Out-Null
  Start-Sleep -Seconds 2
  for ($essai = 1; $essai -le 8; $essai++) {
    $h = (Get-Process -Id $p.Id).MainWindowHandle
    [Fenetre]::MoveWindow($h, 40, 40, 1600, 1000, $true) | Out-Null
    Start-Sleep -Seconds 3
    $r = [Fenetre]::Cadre($h)   # cadre réel, sans ombre
    if ($r.R -le $r.L) { & taskkill /F /T /PID $p.Id | Out-Null; throw "Cadre invalide pour $nom" }
    $img = New-Object System.Drawing.Bitmap ($r.R - $r.L), ($r.B - $r.T)
    # PrintWindow (PW_RENDERFULLCONTENT) dessine la fenêtre elle-même : jamais ce qui la recouvre à l'écran.
    $w = New-Object Fenetre+RECT; [Fenetre]::GetWindowRect($h, [ref]$w) | Out-Null
    $plein = New-Object System.Drawing.Bitmap ($w.R - $w.L), ($w.B - $w.T)
    $gp = [System.Drawing.Graphics]::FromImage($plein); $hdc = $gp.GetHdc()
    $ok = [Fenetre]::PrintWindow($h, $hdc, 2); $gp.ReleaseHdc($hdc); $gp.Dispose()
    if (-not $ok) { & taskkill /F /T /PID $p.Id | Out-Null; throw "PrintWindow a échoué pour $nom" }
    $g = [System.Drawing.Graphics]::FromImage($img)
    $g.DrawImage($plein, (New-Object System.Drawing.Rectangle 0, 0, $img.Width, $img.Height),
      ($r.L - $w.L), ($r.T - $w.T), $img.Width, $img.Height, [System.Drawing.GraphicsUnit]::Pixel)
    $plein.Dispose()
    $g.Dispose()
    $bord = $img.GetPixel($img.Width - 60, [int]($img.Height / 2))
    $vide = $img.GetPixel([int]($img.Width / 2), [int]($img.Height * 0.6))
    $incomplet = ($bord.R -eq 64 -and $bord.G -eq 64 -and $bord.B -eq 64) -or ($attendVide -eq $false -and $vide.R -eq 43 -and $vide.G -eq 42 -and $vide.B -eq 51)
    if (-not $incomplet -or $essai -eq 8) { $img.Save((Join-Path $Sortie "$nom.png"), [System.Drawing.Imaging.ImageFormat]::Png); $img.Dispose(); break }
    $img.Dispose()
  }
  & taskkill /F /T /PID $p.Id | Out-Null
  Start-Sleep -Seconds 2
  Remove-Item -Recurse -Force $profil -ErrorAction SilentlyContinue
  Write-Host "-> $nom.png"
}

Save-Fenetre 'accueil' @("`"$accueil`"") 12
Save-Fenetre 'navigation-privee' @('-private-window') 10
Save-Fenetre 'site' @('https://fr.wikipedia.org/wiki/Cigale') 20 $false
Save-Fenetre 'protection' @('about:cigale') 30
Save-Fenetre 'adresse-ip' @('about:cigale#proxy') 10
