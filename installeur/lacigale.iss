; Installeur Windows de La Cigale (Inno Setup 6). Appelé par construire-windows.ps1.
; Installation par utilisateur, sans droits administrateur.

#ifndef VersionCigale
  #define VersionCigale "0.0.0"
#endif
#ifndef VersionFirefox
  #define VersionFirefox "inconnue"
#endif
#define Source "..\dist\LaCigale"
#define Profil "{localappdata}\La Cigale\Profil"

[Setup]
AppId={{6C1A6A1E-C16A-4E1E-9C1A-1A7E5C16A1E0}
AppName=La Cigale
AppVersion={#VersionCigale}
AppVerName=La Cigale {#VersionCigale}
AppPublisher=Projet La Cigale
AppComments=Navigateur axé sur l'anonymat et la sécurité, basé sur Firefox ESR {#VersionFirefox}
DefaultDirName={localappdata}\Programs\La Cigale
DefaultGroupName=La Cigale
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputBaseFilename=LaCigale-{#VersionCigale}-windows-x64-installeur
SetupIconFile=..\branding\lacigale.ico
UninstallDisplayIcon={app}\lacigale.ico
WizardStyle=modern
Compression=lzma2/ultra64
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
LicenseFile=..\LICENCE.txt

[Languages]
Name: "fr"; MessagesFile: "compiler:Languages\French.isl"

[Tasks]
Name: "bureau"; Description: "Créer une icône sur le Bureau"; GroupDescription: "Raccourcis :"

[Files]
Source: "{#Source}\*"; DestDir: "{app}"; Excludes: "La Cigale (portable).cmd"; Flags: recursesubdirs ignoreversion

[Dirs]
Name: "{#Profil}"

[Icons]
Name: "{group}\La Cigale"; Filename: "{app}\lacigale.exe"; Parameters: "-profile ""{#Profil}"""; IconFilename: "{app}\lacigale.ico"
Name: "{group}\La Cigale (navigation privée)"; Filename: "{app}\lacigale.exe"; Parameters: "-profile ""{#Profil}"" -private-window"; IconFilename: "{app}\lacigale.ico"
Name: "{group}\Désinstaller La Cigale"; Filename: "{uninstallexe}"
Name: "{autodesktop}\La Cigale"; Filename: "{app}\lacigale.exe"; Parameters: "-profile ""{#Profil}"""; IconFilename: "{app}\lacigale.ico"; Tasks: bureau

[Run]
Filename: "{app}\lacigale.exe"; Parameters: "-profile ""{#Profil}"""; Description: "Lancer La Cigale"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[Code]
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if (CurUninstallStep = usPostUninstall) and
     (MsgBox('Supprimer aussi votre profil La Cigale (favoris, extensions, réglages) ?',
             mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES) then
    DelTree(ExpandConstant('{localappdata}\La Cigale'), True, True, True);
end;
