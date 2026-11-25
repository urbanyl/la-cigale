// Installeur de La Cigale pour Windows, compilé par installeur/compiler.ps1.
// Le même fichier donne aussi desinstaller.exe : sans la ressource charge.zip,
// le programme démarre en mode désinstallation.
//
// Options : /silencieux, /dossier "chemin", /sansbureau, /langue fr|en

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: AssemblyTitle("La Cigale")]
[assembly: AssemblyProduct("La Cigale")]
[assembly: AssemblyCompany("Projet La Cigale")]
[assembly: AssemblyDescription("Installation de La Cigale")]

namespace LaCigale
{
    static class Ressources
    {
        static readonly Assembly Moi = Assembly.GetExecutingAssembly();

        public static bool Existe(string nom)
        {
            return Moi.GetManifestResourceNames().Contains(nom);
        }

        public static Stream Flux(string nom)
        {
            return Moi.GetManifestResourceStream(nom);
        }

        public static string Texte(string nom)
        {
            if (!Existe(nom)) return "";
            using (var lecteur = new StreamReader(Flux(nom), Encoding.UTF8)) return lecteur.ReadToEnd().Trim();
        }

        public static Image Image(string nom)
        {
            if (!Existe(nom)) return null;
            using (var flux = Flux(nom)) return new Bitmap(flux);
        }
    }

    static class Langue
    {
        public static bool En;
        public static string T(string fr, string en) { return En ? en : fr; }
        public static string Charge { get { return En && Ressources.Existe("charge-en.zip") ? "charge-en.zip" : "charge.zip"; } }
    }

    static class Moteur
    {
        public const string Nom = "La Cigale";
        public const string Editeur = "Projet La Cigale";
        const string CleDesinstallation = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\LaCigale";
        const string CleClient = @"Software\Clients\StartMenuInternet\LaCigale";
        const string ProgIdPage = "LaCigaleHTML";
        const string ProgIdLien = "LaCigaleURL";
        const string Manifeste = "installation.lst";
        // Firefox lit ici l'identifiant de barre des tâches de chaque dossier d'installation.
        // Les raccourcis portent le même : Windows affiche alors « La Cigale » et, si on épingle
        // la fenêtre, reprend le raccourci (et donc le bon profil) au lieu de lacigale.exe nu.
        const string CleTaskBarIDs = @"Software\Mozilla\Firefox\TaskBarIDs";
        const string IdBarreDesTaches = "LaCigale.Navigateur";
        static readonly string[] Extensions = { ".htm", ".html", ".shtml", ".xht", ".xhtml", ".svg", ".webp", ".pdf" };

        public static string VersionCigale;
        public static string VersionFirefox;

        static Moteur()
        {
            var parties = Ressources.Texte("version.txt").Split('|');
            VersionCigale = parties.Length > 0 && parties[0] != "" ? parties[0] : "";
            VersionFirefox = parties.Length > 1 ? parties[1] : "";
        }

        static string Local { get { return Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData); } }
        public static string DossierParDefaut { get { return Path.Combine(Local, "Programs", "La Cigale"); } }
        public static string DossierDonnees { get { return Path.Combine(Local, "La Cigale"); } }
        public static string Profil { get { return Path.Combine(DossierDonnees, "Profil"); } }
        static string MenuDemarrer { get { return Environment.GetFolderPath(Environment.SpecialFolder.Programs); } }
        static string Bureau { get { return Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory); } }

        public static string LireInstallation(string valeur)
        {
            using (var cle = Registry.CurrentUser.OpenSubKey(CleDesinstallation))
                return cle == null ? null : cle.GetValue(valeur) as string;
        }

        public static string DossierInstalle { get { return LireInstallation("InstallLocation"); } }
        public static string VersionInstallee { get { return LireInstallation("DisplayVersion"); } }

        static string Arguments(string supplement)
        {
            return "-profile \"" + Profil + "\"" + (supplement == "" ? "" : " " + supplement);
        }

        public static bool EnCours(string dossier)
        {
            string racine = Path.GetFullPath(dossier).TrimEnd('\\') + "\\";
            foreach (var processus in Process.GetProcessesByName("lacigale"))
            {
                try
                {
                    if (processus.MainModule.FileName.StartsWith(racine, StringComparison.OrdinalIgnoreCase)) return true;
                }
                catch (Exception) { }
                finally { processus.Dispose(); }
            }
            return false;
        }

        public static void Installer(string dossier, bool raccourciBureau, Action<double, string> progres)
        {
            dossier = Path.GetFullPath(dossier).TrimEnd('\\');
            string racine = dossier + "\\";
            Directory.CreateDirectory(dossier);

            // en cas de mise à jour, on enlève d'abord les fichiers de l'ancienne version
            SupprimerFichiersListes(dossier, null);

            // Firefox garde en cache les scripts de l'ancienne version tant que son numéro de build
            // ne change pas (La Cigale reste sur le même Firefox) : on vide ce cache à chaque installation.
            try { Directory.Delete(Path.Combine(Profil, "startupCache"), true); } catch (Exception) { }

            var fichiers = new List<string>();
            using (var archive = new ZipArchive(Ressources.Flux(Langue.Charge), ZipArchiveMode.Read))
            {
                var entrees = archive.Entries.Where(e => e.Name != "").ToList();
                long total = Math.Max(1, entrees.Sum(e => e.Length)), fait = 0;
                var tampon = new byte[1 << 20];
                foreach (var entree in entrees)
                {
                    string nom = entree.FullName.Replace('/', '\\');
                    int barre = nom.IndexOf('\\');
                    if (barre >= 0) nom = nom.Substring(barre + 1);      // dossier racine « LaCigale\ »
                    if (nom == "" || nom.EndsWith(".cmd", StringComparison.OrdinalIgnoreCase)) continue;
                    string cible = Path.GetFullPath(Path.Combine(dossier, nom));
                    if (!cible.StartsWith(racine, StringComparison.OrdinalIgnoreCase))
                        throw new InvalidDataException("Chemin invalide dans l'archive : " + nom);

                    progres((double)fait / total, nom);
                    Directory.CreateDirectory(Path.GetDirectoryName(cible));
                    using (var source = entree.Open())
                    using (var destination = new FileStream(cible, FileMode.Create, FileAccess.Write, FileShare.None, 1 << 16))
                    {
                        int lu;
                        while ((lu = source.Read(tampon, 0, tampon.Length)) > 0)
                        {
                            destination.Write(tampon, 0, lu);
                            fait += lu;
                        }
                    }
                    fichiers.Add(nom);
                }
            }

            progres(0.97, Langue.T("Désinstalleur", "Uninstaller"));
            string desinstalleur = Path.Combine(dossier, "desinstaller.exe");
            using (var source = Ressources.Flux("desinstaller.exe"))
            using (var destination = File.Create(desinstalleur)) source.CopyTo(destination);
            fichiers.Add("desinstaller.exe");
            fichiers.Add(Manifeste);
            File.WriteAllLines(Path.Combine(dossier, Manifeste), fichiers, Encoding.UTF8);
            Directory.CreateDirectory(Profil);

            progres(0.98, Langue.T("Raccourcis", "Shortcuts"));
            using (var cle = Registry.CurrentUser.CreateSubKey(CleTaskBarIDs))
                cle.SetValue(Path.GetFullPath(dossier).TrimEnd('\\'), IdBarreDesTaches);
            string exe = Path.Combine(dossier, "lacigale.exe");
            string icone = File.Exists(Path.Combine(dossier, "lacigale.ico")) ? Path.Combine(dossier, "lacigale.ico") : exe;
            var raccourcis = new List<string>
            {
                Path.Combine(MenuDemarrer, "La Cigale.lnk"),
                Path.Combine(MenuDemarrer, Langue.T("La Cigale (navigation privée).lnk", "La Cigale (private browsing).lnk")),
            };
            Raccourci(raccourcis[0], exe, Arguments(""), icone, Langue.T("Naviguer avec La Cigale", "Browse with La Cigale"), IdBarreDesTaches);
            // Firefox donne aux fenêtres privées l'identifiant suivi de ";PrivateBrowsingAUMID"
            Raccourci(raccourcis[1], exe, Arguments("-private-window"), icone, Langue.T("Ouvrir une fenêtre de navigation privée", "Open a private browsing window"),
                IdBarreDesTaches + ";PrivateBrowsingAUMID");
            if (raccourciBureau)
            {
                raccourcis.Add(Path.Combine(Bureau, "La Cigale.lnk"));
                Raccourci(raccourcis[2], exe, Arguments(""), icone, Langue.T("Naviguer avec La Cigale", "Browse with La Cigale"), IdBarreDesTaches);
            }

            progres(0.99, Langue.T("Inscription auprès de Windows", "Registering with Windows"));
            long taille = fichiers.Select(f => Path.Combine(dossier, f)).Where(File.Exists).Sum(f => new FileInfo(f).Length);
            using (var cle = Registry.CurrentUser.CreateSubKey(CleDesinstallation))
            {
                cle.SetValue("DisplayName", Nom);
                cle.SetValue("DisplayVersion", VersionCigale);
                cle.SetValue("Publisher", Editeur);
                cle.SetValue("Langue", Langue.En ? "en" : "fr");
                cle.SetValue("DisplayIcon", icone);
                cle.SetValue("InstallLocation", dossier);
                cle.SetValue("UninstallString", "\"" + desinstalleur + "\"");
                cle.SetValue("QuietUninstallString", "\"" + desinstalleur + "\" /silencieux");
                cle.SetValue("URLInfoAbout", "https://github.com/urbanyl/la-cigale");
                cle.SetValue("Comments", Langue.T("Navigateur basé sur Firefox ESR ", "Browser based on Firefox ESR ") + VersionFirefox);
                cle.SetValue("EstimatedSize", (int)(taille / 1024), RegistryValueKind.DWord);
                cle.SetValue("NoModify", 1, RegistryValueKind.DWord);
                cle.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                cle.SetValue("InstallDate", DateTime.Now.ToString("yyyyMMdd"));
                cle.SetValue("Raccourcis", raccourcis.ToArray(), RegistryValueKind.MultiString);
            }
            InscrireNavigateur(exe, icone);
            progres(1, "");
        }

        [ComImport, Guid("00021401-0000-0000-C000-000000000046")]
        class ShellLink { }

        [ComImport, Guid("000214F9-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IShellLinkW
        {
            void GetPath(IntPtr a, int b, IntPtr c, int d);
            void GetIDList(out IntPtr a);
            void SetIDList(IntPtr a);
            void GetDescription(IntPtr a, int b);
            void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string a);
            void GetWorkingDirectory(IntPtr a, int b);
            void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string a);
            void GetArguments(IntPtr a, int b);
            void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string a);
            void GetHotkey(out short a);
            void SetHotkey(short a);
            void GetShowCmd(out int a);
            void SetShowCmd(int a);
            void GetIconLocation(IntPtr a, int b, out int c);
            void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string a, int b);
            void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string a, int b);
            void Resolve(IntPtr a, int b);
            void SetPath([MarshalAs(UnmanagedType.LPWStr)] string a);
        }

        [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IPropertyStore
        {
            void GetCount(out uint a);
            void GetAt(uint a, out ClePropriete b);
            void GetValue(ref ClePropriete a, IntPtr b);
            void SetValue(ref ClePropriete a, ref ValeurPropriete b);
            void Commit();
        }

        [StructLayout(LayoutKind.Sequential, Pack = 4)]
        struct ClePropriete { public Guid Format; public uint Id; }

        // PROPVARIANT réduit au cas VT_LPWSTR
        [StructLayout(LayoutKind.Sequential)]
        struct ValeurPropriete { public ushort Type; ushort r1, r2, r3; public IntPtr Texte; IntPtr r4; }

        static void Raccourci(string lien, string cible, string arguments, string icone, string description, string idBarre)
        {
            var raccourci = (IShellLinkW)new ShellLink();
            try
            {
                raccourci.SetPath(cible);
                raccourci.SetArguments(arguments);
                raccourci.SetWorkingDirectory(Path.GetDirectoryName(cible));
                raccourci.SetIconLocation(icone, 0);
                raccourci.SetDescription(description);

                // System.AppUserModel.ID
                var cle = new ClePropriete { Format = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), Id = 5 };
                var valeur = new ValeurPropriete { Type = 31, Texte = Marshal.StringToCoTaskMemUni(idBarre) };
                try
                {
                    var proprietes = (IPropertyStore)raccourci;
                    proprietes.SetValue(ref cle, ref valeur);
                    proprietes.Commit();
                }
                finally { Marshal.FreeCoTaskMem(valeur.Texte); }

                ((System.Runtime.InteropServices.ComTypes.IPersistFile)raccourci).Save(lien, true);
            }
            finally { Marshal.FinalReleaseComObject(raccourci); }
        }

        // Windows ne laisse plus un programme se mettre navigateur par défaut tout seul :
        // on s'inscrit, puis l'utilisateur choisit dans les Paramètres.
        static void InscrireNavigateur(string exe, string icone)
        {
            string ouvrir = "\"" + exe + "\" " + Arguments("-osint -url \"%1\"");
            foreach (var progId in new[] { ProgIdPage, ProgIdLien })
            {
                using (var cle = Registry.CurrentUser.CreateSubKey(@"Software\Classes\" + progId))
                {
                    cle.SetValue("", progId == ProgIdPage ? Langue.T("Document La Cigale", "La Cigale Document") : Langue.T("Lien La Cigale", "La Cigale Link"));
                    cle.SetValue("FriendlyTypeName", progId == ProgIdPage ? Langue.T("Document La Cigale", "La Cigale Document") : Langue.T("Lien La Cigale", "La Cigale Link"));
                    if (progId == ProgIdLien)
                    {
                        cle.SetValue("URL Protocol", "");
                        cle.SetValue("EditFlags", 2, RegistryValueKind.DWord);
                    }
                    using (var c = cle.CreateSubKey("DefaultIcon")) c.SetValue("", icone + ",0");
                    using (var c = cle.CreateSubKey(@"shell\open\command")) c.SetValue("", ouvrir);
                    using (var c = cle.CreateSubKey("Application"))
                    {
                        c.SetValue("ApplicationName", Nom);
                        c.SetValue("ApplicationIcon", icone + ",0");
                        c.SetValue("ApplicationCompany", Editeur);
                    }
                }
            }
            foreach (var extension in Extensions)
                using (var cle = Registry.CurrentUser.CreateSubKey(@"Software\Classes\" + extension + @"\OpenWithProgids"))
                    cle.SetValue(ProgIdPage, new byte[0], RegistryValueKind.None);

            using (var cle = Registry.CurrentUser.CreateSubKey(CleClient))
            {
                cle.SetValue("", Nom);
                using (var c = cle.CreateSubKey("DefaultIcon")) c.SetValue("", icone + ",0");
                using (var c = cle.CreateSubKey(@"shell\open\command")) c.SetValue("", "\"" + exe + "\" " + Arguments(""));
                using (var c = cle.CreateSubKey("Capabilities"))
                {
                    c.SetValue("ApplicationName", Nom);
                    c.SetValue("ApplicationIcon", icone + ",0");
                    c.SetValue("ApplicationDescription",
                        Langue.T("Navigateur français, sombre et minimaliste, pensé pour l'anonymat et la sécurité.", "A dark, minimalist browser built for anonymity and security."));
                    using (var s = c.CreateSubKey("StartMenu")) s.SetValue("StartMenuInternet", "LaCigale");
                    using (var u = c.CreateSubKey("URLAssociations"))
                        foreach (var protocole in new[] { "http", "https" }) u.SetValue(protocole, ProgIdLien);
                    using (var f = c.CreateSubKey("FileAssociations"))
                        foreach (var extension in Extensions) f.SetValue(extension, ProgIdPage);
                }
            }
            using (var cle = Registry.CurrentUser.CreateSubKey(@"Software\RegisteredApplications"))
                cle.SetValue(Nom, CleClient + @"\Capabilities");
            SHChangeNotify(0x08000000, 0, IntPtr.Zero, IntPtr.Zero);
        }

        public static void OuvrirReglagesNavigateurParDefaut()
        {
            try { Process.Start("ms-settings:defaultapps?registeredAppUser=" + Uri.EscapeDataString(Nom)); }
            catch (Exception)
            {
                try { Process.Start("ms-settings:defaultapps"); } catch (Exception) { }
            }
        }

        public static void Lancer(string dossier)
        {
            try { Process.Start(Path.Combine(dossier, "lacigale.exe"), Arguments("")); }
            catch (Exception) { }
        }

        public static void Desinstaller(string dossier, bool supprimerProfil, Action<double, string> progres)
        {
            dossier = Path.GetFullPath(dossier).TrimEnd('\\');
            progres(0.05, Langue.T("Raccourcis", "Shortcuts"));
            using (var cle = Registry.CurrentUser.OpenSubKey(CleDesinstallation))
            {
                var raccourcis = cle == null ? null : cle.GetValue("Raccourcis") as string[];
                if (raccourcis != null)
                    foreach (var lien in raccourcis)
                        if (lien.EndsWith(".lnk", StringComparison.OrdinalIgnoreCase))
                            try { File.Delete(lien); } catch (Exception) { }
            }

            progres(0.1, Langue.T("Fichiers", "Files"));
            SupprimerFichiersListes(dossier, progres);
            try { if (!Directory.EnumerateFileSystemEntries(dossier).Any()) Directory.Delete(dossier); }
            catch (Exception) { }

            progres(0.92, Langue.T("Inscription auprès de Windows", "Unregistering from Windows"));
            using (var cle = Registry.CurrentUser.OpenSubKey(CleTaskBarIDs, true))
                if (cle != null) cle.DeleteValue(dossier, false);
            Registry.CurrentUser.DeleteSubKeyTree(CleClient, false);
            Registry.CurrentUser.DeleteSubKeyTree(@"Software\Classes\" + ProgIdPage, false);
            Registry.CurrentUser.DeleteSubKeyTree(@"Software\Classes\" + ProgIdLien, false);
            foreach (var extension in Extensions)
                using (var cle = Registry.CurrentUser.OpenSubKey(@"Software\Classes\" + extension + @"\OpenWithProgids", true))
                    if (cle != null) cle.DeleteValue(ProgIdPage, false);
            using (var cle = Registry.CurrentUser.OpenSubKey(@"Software\RegisteredApplications", true))
                if (cle != null) cle.DeleteValue(Nom, false);
            Registry.CurrentUser.DeleteSubKeyTree(CleDesinstallation, false);
            SHChangeNotify(0x08000000, 0, IntPtr.Zero, IntPtr.Zero);

            if (supprimerProfil)
            {
                progres(0.96, Langue.T("Profil", "Profile"));
                try { Directory.Delete(DossierDonnees, true); } catch (Exception) { }
            }
            progres(1, "");
        }

        // On ne supprime que ce qu'on a posé (installation.lst), au cas où quelqu'un
        // aurait installé directement dans Documents.
        static void SupprimerFichiersListes(string dossier, Action<double, string> progres)
        {
            string liste = Path.Combine(dossier, Manifeste);
            if (!File.Exists(liste)) return;
            string racine = dossier + "\\";
            var fichiers = File.ReadAllLines(liste, Encoding.UTF8).Where(l => l.Trim() != "").ToList();
            var dossiers = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            for (int i = 0; i < fichiers.Count; i++)
            {
                string chemin = Path.GetFullPath(Path.Combine(dossier, fichiers[i]));
                if (!chemin.StartsWith(racine, StringComparison.OrdinalIgnoreCase)) continue;
                if (progres != null && i % 20 == 0) progres(0.1 + 0.8 * i / fichiers.Count, fichiers[i]);
                try { File.Delete(chemin); } catch (Exception) { }
                for (string d = Path.GetDirectoryName(chemin); d.Length > dossier.Length; d = Path.GetDirectoryName(d))
                    dossiers.Add(d);
            }
            foreach (var d in dossiers.OrderByDescending(d => d.Length))
                try { if (!Directory.EnumerateFileSystemEntries(d).Any()) Directory.Delete(d); } catch (Exception) { }
        }

        [DllImport("shell32.dll")]
        static extern void SHChangeNotify(int evenement, int options, IntPtr a, IntPtr b);
    }

    static class Theme
    {
        public static readonly Color Fond = Color.FromArgb(10, 10, 11);
        public static readonly Color Surface = Color.FromArgb(20, 20, 22);
        public static readonly Color SurfaceForte = Color.FromArgb(30, 30, 34);
        public static readonly Color Bordure = Color.FromArgb(38, 38, 42);
        public static readonly Color Texte = Color.FromArgb(237, 237, 237);
        public static readonly Color TexteDoux = Color.FromArgb(140, 140, 144);
        public static readonly Color Erreur = Color.FromArgb(255, 138, 128);
        public static float Echelle = 1f;

        public static int S(float valeur) { return (int)Math.Round(valeur * Echelle); }

        public static Font Police(float taille, bool gras)
        {
            string famille = FontFamily.Families.Any(f => f.Name == "Segoe UI Variable Text") ? "Segoe UI Variable Text" : "Segoe UI";
            if (gras) famille = FontFamily.Families.Any(f => f.Name == "Segoe UI Variable Display Semib")
                ? "Segoe UI Variable Display Semib" : "Segoe UI Semibold";
            return new Font(famille, taille, FontStyle.Regular, GraphicsUnit.Point);
        }

        public static GraphicsPath Arrondi(RectangleF r, float rayon)
        {
            var chemin = new GraphicsPath();
            float d = rayon * 2;
            chemin.AddArc(r.X, r.Y, d, d, 180, 90);
            chemin.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            chemin.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            chemin.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            chemin.CloseFigure();
            return chemin;
        }
    }

    class Dessine : Control
    {
        protected bool Survol, Appui;

        public Dessine()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer |
                     ControlStyles.UserPaint | ControlStyles.ResizeRedraw | ControlStyles.Selectable, true);
            BackColor = Theme.Fond;
            ForeColor = Theme.Texte;
            Cursor = Cursors.Hand;
        }

        protected override void OnMouseEnter(EventArgs e) { Survol = true; Invalidate(); base.OnMouseEnter(e); }
        protected override void OnMouseLeave(EventArgs e) { Survol = false; Appui = false; Invalidate(); base.OnMouseLeave(e); }
        protected override void OnMouseDown(MouseEventArgs e) { Appui = true; Focus(); Invalidate(); base.OnMouseDown(e); }
        protected override void OnMouseUp(MouseEventArgs e) { Appui = false; Invalidate(); base.OnMouseUp(e); }
        protected override void OnGotFocus(EventArgs e) { Invalidate(); base.OnGotFocus(e); }
        protected override void OnLostFocus(EventArgs e) { Invalidate(); base.OnLostFocus(e); }
        protected override void OnTextChanged(EventArgs e) { Invalidate(); base.OnTextChanged(e); }
        protected override void OnEnabledChanged(EventArgs e) { Invalidate(); base.OnEnabledChanged(e); }

        protected override void OnKeyUp(KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Space || e.KeyCode == Keys.Enter) { OnClick(EventArgs.Empty); e.Handled = true; }
            base.OnKeyUp(e);
        }

        protected static Graphics Preparer(PaintEventArgs e)
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            e.Graphics.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;
            return e.Graphics;
        }

        protected void DessinerFocus(Graphics g, RectangleF zone, float rayon)
        {
            if (!Focused || !ShowFocusCues) return;
            using (var crayon = new Pen(Theme.TexteDoux, Theme.S(1.5f)))
            using (var chemin = Theme.Arrondi(zone, rayon)) g.DrawPath(crayon, chemin);
        }
    }

    class Bouton : Dessine, IButtonControl
    {
        public bool Primaire;
        public DialogResult DialogResult { get; set; }
        public void NotifyDefault(bool valeur) { }
        public void PerformClick() { if (Enabled) OnClick(EventArgs.Empty); }

        public Bouton(string texte, bool primaire)
        {
            Text = texte;
            Primaire = primaire;
            Font = Theme.Police(10f, primaire);
            Size = new Size(Theme.S(primaire ? 132 : 112), Theme.S(40));
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = Preparer(e);
            g.Clear(BackColor);
            var zone = new RectangleF(Theme.S(2), Theme.S(2), Width - Theme.S(4) - 1, Height - Theme.S(4) - 1);
            Color fond, texte, bord;
            if (Primaire)
            {
                fond = !Enabled ? Theme.SurfaceForte : Appui ? Color.FromArgb(200, 200, 202) : Survol ? Color.White : Theme.Texte;
                texte = Enabled ? Theme.Fond : Theme.TexteDoux;
                bord = fond;
            }
            else
            {
                fond = Appui ? Theme.Bordure : Survol ? Theme.SurfaceForte : Theme.Surface;
                texte = Enabled ? Theme.Texte : Theme.TexteDoux;
                bord = Theme.Bordure;
            }
            float rayon = Theme.S(10);
            using (var chemin = Theme.Arrondi(zone, rayon))
            using (var pinceau = new SolidBrush(fond))
            using (var crayon = new Pen(bord))
            {
                g.FillPath(pinceau, chemin);
                g.DrawPath(crayon, chemin);
            }
            TextRenderer.DrawText(g, Text, Font, Rectangle.Round(zone), texte, fond,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine);
            if (Focused && ShowFocusCues)
                DessinerFocus(g, new RectangleF(0.5f, 0.5f, Width - 2, Height - 2), rayon + Theme.S(2));
        }
    }

    class Case : Dessine
    {
        bool coche;
        public bool Coche { get { return coche; } set { coche = value; Invalidate(); } }

        public Case(string texte, bool cochee)
        {
            Text = texte;
            coche = cochee;
            Font = Theme.Police(10f, false);
            Size = new Size(Theme.S(390), Theme.S(30));
        }

        protected override void OnClick(EventArgs e) { Coche = !Coche; base.OnClick(e); }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = Preparer(e);
            g.Clear(BackColor);
            float cote = Theme.S(18), y = (Height - cote) / 2f;
            var boite = new RectangleF(Theme.S(2), y, cote, cote);
            using (var chemin = Theme.Arrondi(boite, Theme.S(5)))
            {
                using (var pinceau = new SolidBrush(coche ? Theme.Texte : (Survol ? Theme.SurfaceForte : Theme.Surface)))
                    g.FillPath(pinceau, chemin);
                using (var crayon = new Pen(coche ? Theme.Texte : Theme.Bordure, Theme.S(1.2f)))
                    g.DrawPath(crayon, chemin);
            }
            if (coche)
            {
                using (var crayon = new Pen(Theme.Fond, Theme.S(2.2f)) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round })
                    g.DrawLines(crayon, new[]
                    {
                        new PointF(boite.X + cote * 0.25f, boite.Y + cote * 0.52f),
                        new PointF(boite.X + cote * 0.43f, boite.Y + cote * 0.70f),
                        new PointF(boite.X + cote * 0.76f, boite.Y + cote * 0.32f),
                    });
            }
            var texte = new Rectangle((int)(boite.Right + Theme.S(12)), 0, Width - (int)boite.Right - Theme.S(14), Height);
            TextRenderer.DrawText(g, Text, Font, texte, Enabled ? Theme.Texte : Theme.TexteDoux, BackColor,
                TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine | TextFormatFlags.EndEllipsis);
            if (Focused && ShowFocusCues)
                DessinerFocus(g, new RectangleF(boite.X - Theme.S(2), boite.Y - Theme.S(2), cote + Theme.S(4), cote + Theme.S(4)), Theme.S(7));
        }
    }

    class Lien : Dessine
    {
        public Lien(string texte, float taille)
        {
            Text = texte;
            Font = Theme.Police(taille, false);
            Size = TextRenderer.MeasureText(Text, Font);
            Width += Theme.S(4);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = Preparer(e);
            g.Clear(BackColor);
            using (var police = new Font(Font, Survol ? FontStyle.Underline : FontStyle.Regular))
                TextRenderer.DrawText(g, Text, police, ClientRectangle, Survol ? Theme.Texte : Theme.TexteDoux, BackColor,
                    TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine);
            if (Focused && ShowFocusCues)
                DessinerFocus(g, new RectangleF(0.5f, 0.5f, Width - 2, Height - 2), Theme.S(4));
        }
    }

    // C:\Users\...\La Cigale plutôt qu'un chemin coupé sur deux lignes
    class Chemin : Control
    {
        public Chemin()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint, true);
        }

        protected override void OnTextChanged(EventArgs e) { Invalidate(); base.OnTextChanged(e); }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.Clear(Theme.Fond);
            using (var chemin = Theme.Arrondi(new RectangleF(0, 0, Width - 1, Height - 1), Theme.S(10)))
            using (var pinceau = new SolidBrush(Theme.Surface))
            using (var crayon = new Pen(Theme.Bordure))
            {
                g.FillPath(pinceau, chemin);
                g.DrawPath(crayon, chemin);
            }
            var zone = new Rectangle(Theme.S(12), 0, Width - Theme.S(24), Height);
            TextRenderer.DrawText(g, Text, Font, zone, Theme.Texte, Theme.Surface,
                TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine | TextFormatFlags.PathEllipsis | TextFormatFlags.NoPrefix);
        }
    }

    class Barre : Control
    {
        double valeur;
        public double Valeur { get { return valeur; } set { valeur = Math.Max(0, Math.Min(1, value)); Invalidate(); } }

        public Barre()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint, true);
            Size = new Size(Theme.S(390), Theme.S(8));
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.Clear(Theme.Fond);
            float rayon = (Height - 1) / 2f;
            using (var chemin = Theme.Arrondi(new RectangleF(0, 0, Width - 1, Height - 1), rayon))
            using (var pinceau = new SolidBrush(Theme.SurfaceForte)) g.FillPath(pinceau, chemin);
            float largeur = (float)((Width - 1) * valeur);
            if (largeur >= Height)
                using (var chemin = Theme.Arrondi(new RectangleF(0, 0, largeur, Height - 1), rayon))
                using (var pinceau = new SolidBrush(Theme.Texte)) g.FillPath(pinceau, chemin);
        }
    }

    class Fermer : Dessine
    {
        public Fermer() { Size = new Size(Theme.S(40), Theme.S(32)); TabStop = false; }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = Preparer(e);
            g.Clear(Survol ? Color.FromArgb(196, 43, 28) : BackColor);
            float c = Width / 2f, m = Height / 2f, d = Theme.S(5);
            using (var crayon = new Pen(Survol ? Color.White : Theme.TexteDoux, Theme.S(1.2f)))
            {
                g.DrawLine(crayon, c - d, m - d, c + d, m + d);
                g.DrawLine(crayon, c + d, m - d, c - d, m + d);
            }
        }
    }

    class Fenetre : Form
    {
        readonly bool modeDesinstallation;
        readonly string dossierDesinstallation;
        readonly Image fond, symbole;
        readonly List<Control> page = new List<Control>();
        string dossier = Moteur.DossierInstalle ?? Moteur.DossierParDefaut;
        bool occupe;
        const int Gauche = 300;    // largeur du panneau illustré
        int X0 { get { return Theme.S(Gauche + 44); } }
        int LargeurContenu { get { return ClientSize.Width - X0 - Theme.S(40); } }

        public Fenetre(bool desinstallation, string dossierCible)
        {
            modeDesinstallation = desinstallation;
            dossierDesinstallation = dossierCible;
            using (var g = CreateGraphics()) Theme.Echelle = g.DpiX / 96f;
            fond = Ressources.Image("fond.jpg");
            symbole = Ressources.Image("symbole.png");

            Text = desinstallation ? Langue.T("Désinstaller La Cigale", "Uninstall La Cigale") : Langue.T("Installer La Cigale", "Install La Cigale");
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            AutoScaleMode = AutoScaleMode.None;
            ClientSize = new Size(Theme.S(780), Theme.S(480));
            BackColor = Theme.Fond;
            ForeColor = Theme.Texte;
            KeyPreview = true;
            DoubleBuffered = true;
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch (Exception) { }

            var fermer = new Fermer();
            fermer.Location = new Point(ClientSize.Width - fermer.Width, 0);
            fermer.Click += delegate { Quitter(); };
            Controls.Add(fermer);

            if (desinstallation) PageConfirmationDesinstallation();
            else if (!Ressources.Existe("charge-en.zip")) { Langue.En = false; PageAccueil(); }
            else if (Moteur.VersionInstallee != null && Moteur.DossierInstalle != null) PageAccueil();
            else PageLangue();
        }

        protected override CreateParams CreateParams
        {
            get
            {
                var parametres = base.CreateParams;
                parametres.Style |= 0x00020000;          // WS_MINIMIZEBOX : réduction depuis la barre des tâches
                parametres.ClassStyle |= 0x00020000;     // CS_DROPSHADOW
                return parametres;
            }
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            int vrai = 1, arrondi = 2, bordure = ColorTranslator.ToWin32(Theme.Bordure);
            try
            {
                DwmSetWindowAttribute(Handle, 20, ref vrai, 4);      // barre de titre sombre (Alt+Tab)
                DwmSetWindowAttribute(Handle, 33, ref arrondi, 4);   // coins arrondis (Windows 11)
                DwmSetWindowAttribute(Handle, 34, ref bordure, 4);   // bordure discrète
            }
            catch (Exception) { }
        }

        protected override void OnMouseDown(MouseEventArgs e)
        {
            base.OnMouseDown(e);
            if (e.Button != MouseButtons.Left) return;
            ReleaseCapture();
            SendMessage(Handle, 0xA1, (IntPtr)2, IntPtr.Zero);        // déplacer la fenêtre
        }

        protected override void OnKeyDown(KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Escape) { Quitter(); e.Handled = true; }
            base.OnKeyDown(e);
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (occupe) e.Cancel = true;
            base.OnFormClosing(e);
        }

        void Quitter() { if (!occupe) Close(); }

        // panneau de gauche
        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;
            var panneau = new Rectangle(0, 0, Theme.S(Gauche), ClientSize.Height);
            if (fond != null)
            {
                float ratio = Math.Max((float)panneau.Width / fond.Width, (float)panneau.Height / fond.Height);
                float l = panneau.Width / ratio, h = panneau.Height / ratio;
                g.DrawImage(fond, panneau, new RectangleF((fond.Width - l) / 2, (fond.Height - h) / 2, l, h), GraphicsUnit.Pixel);
            }
            using (var pinceau = new LinearGradientBrush(panneau, Color.FromArgb(0, 10, 10, 11), Color.FromArgb(150, 10, 10, 11), 90f))
                g.FillRectangle(pinceau, panneau);
            if (symbole != null)
            {
                float largeur = Theme.S(170), hauteur = largeur * symbole.Height / symbole.Width;
                g.DrawImage(symbole, (panneau.Width - largeur) / 2, Theme.S(150) - hauteur / 2, largeur, hauteur);
            }
            using (var titre = Theme.Police(22f, true))
                TextRenderer.DrawText(g, "La Cigale", titre, new Rectangle(0, Theme.S(236), panneau.Width, Theme.S(44)),
                    Theme.Texte, TextFormatFlags.HorizontalCenter | TextFormatFlags.NoPadding);
            using (var petit = Theme.Police(9f, false))
            {
                string version = Moteur.VersionCigale != "" ? "Version " + Moteur.VersionCigale : "";
                if (modeDesinstallation && Moteur.VersionInstallee != null) version = "Version " + Moteur.VersionInstallee;
                TextRenderer.DrawText(g, version, petit, new Rectangle(0, Theme.S(284), panneau.Width, Theme.S(22)),
                    Theme.TexteDoux, TextFormatFlags.HorizontalCenter);
                TextRenderer.DrawText(g, Langue.T("Navigateur libre · basé sur Firefox", "Free browser · based on Firefox"), petit,
                    new Rectangle(0, ClientSize.Height - Theme.S(44), panneau.Width, Theme.S(22)),
                    Color.FromArgb(110, 110, 114), TextFormatFlags.HorizontalCenter);
            }
            using (var crayon = new Pen(Theme.Bordure)) g.DrawLine(crayon, panneau.Right, 0, panneau.Right, panneau.Bottom);
        }

        void Vider()
        {
            foreach (var controle in page) { Controls.Remove(controle); controle.Dispose(); }
            page.Clear();
        }

        T Ajouter<T>(T controle) where T : Control
        {
            page.Add(controle);
            Controls.Add(controle);
            return controle;
        }

        Label Titre(string texte, int y)
        {
            return Ajouter(new Label
            {
                Text = texte, Font = Theme.Police(20f, true), ForeColor = Theme.Texte, BackColor = Theme.Fond,
                Location = new Point(X0 - Theme.S(2), Theme.S(y)), Size = new Size(LargeurContenu, Theme.S(44)),
                UseMnemonic = false,
            });
        }

        Label Paragraphe(string texte, int y, int hauteur, Color couleur, float taille = 10f)
        {
            return Ajouter(new Label
            {
                Text = texte, Font = Theme.Police(taille, false), ForeColor = couleur, BackColor = Theme.Fond,
                Location = new Point(X0, Theme.S(y)), Size = new Size(LargeurContenu, Theme.S(hauteur)),
                UseMnemonic = false,
            });
        }

        Bouton Boutons(string principal, string secondaire, EventHandler action, EventHandler retour)
        {
            int y = ClientSize.Height - Theme.S(72);
            var primaire = Ajouter(new Bouton(principal, true));
            primaire.Location = new Point(ClientSize.Width - Theme.S(40) - primaire.Width, y);
            primaire.Click += action;
            AcceptButton = primaire;
            if (secondaire != null)
            {
                var autre = Ajouter(new Bouton(secondaire, false));
                autre.Location = new Point(primaire.Left - Theme.S(10) - autre.Width, y);
                autre.Click += retour;
            }
            primaire.Focus();
            return primaire;
        }

        void PageLangue()
        {
            Vider();
            Titre("Langue · Language", 52);
            Paragraphe("Choisissez la langue de La Cigale.\nChoose La Cigale's language.", 104, 48, Theme.TexteDoux);
            var francais = Ajouter(new Bouton("Français", !Langue.En));
            francais.Location = new Point(X0, Theme.S(184));
            var anglais = Ajouter(new Bouton("English", Langue.En));
            anglais.Location = new Point(francais.Right + Theme.S(12), Theme.S(184));
            francais.Click += delegate { Choisir(false); };
            anglais.Click += delegate { Choisir(true); };
            AcceptButton = Langue.En ? anglais : francais;
            (Langue.En ? anglais : francais).Focus();
        }

        void Choisir(bool anglais)
        {
            Langue.En = anglais;
            Text = Langue.T("Installer La Cigale", "Install La Cigale");
            Invalidate();
            PageAccueil();
        }

        void PageAccueil()
        {
            Vider();
            string installee = Moteur.VersionInstallee;
            bool miseAJour = installee != null && Moteur.DossierInstalle != null;
            Titre(miseAJour ? Langue.T("Mettre à jour La Cigale", "Update La Cigale") : Langue.T("Installer La Cigale", "Install La Cigale"), 52);
            Paragraphe(miseAJour
                ? Langue.T("La version " + installee + " est installée. Elle sera remplacée par la " + Moteur.VersionCigale +
                  " ; vos favoris, extensions et réglages sont conservés.",
                  "Version " + installee + " is installed. It will be replaced by " + Moteur.VersionCigale +
                  "; your bookmarks, extensions and settings are kept.")
                : Langue.T("Un navigateur français, sombre et minimaliste, pensé pour l'anonymat et la sécurité. " +
                  "Basé sur Firefox ESR " + Moteur.VersionFirefox + ".",
                  "A dark, minimalist browser built for anonymity and security. " +
                  "Based on Firefox ESR " + Moteur.VersionFirefox + "."), 104, 48, Theme.TexteDoux);

            Paragraphe(Langue.T("Dossier d'installation", "Install folder"), 172, 22, Theme.TexteDoux, 9f);
            var chemin = Ajouter(new Chemin
            {
                Text = dossier, Font = Theme.Police(9.5f, false),
                Location = new Point(X0, Theme.S(196)), Size = new Size(LargeurContenu - (miseAJour ? 0 : Theme.S(104)), Theme.S(36)),
            });
            if (!miseAJour)
            {
                var modifier = Ajouter(new Bouton(Langue.T("Modifier…", "Change…"), false));
                modifier.Size = new Size(Theme.S(96), Theme.S(40));
                modifier.Location = new Point(chemin.Right + Theme.S(8), chemin.Top - Theme.S(2));
                modifier.Click += delegate
                {
                    using (var choix = new FolderBrowserDialog { Description = Langue.T("Dossier où installer La Cigale", "Folder to install La Cigale in"), SelectedPath = dossier })
                    {
                        if (choix.ShowDialog(this) != DialogResult.OK) return;
                        string cible = choix.SelectedPath;
                        if (!Path.GetFileName(cible.TrimEnd('\\')).Equals("La Cigale", StringComparison.OrdinalIgnoreCase))
                            cible = Path.Combine(cible, "La Cigale");
                        dossier = cible;
                        chemin.Text = dossier;
                    }
                };
            }

            var bureau = Ajouter(new Case(Langue.T("Créer un raccourci sur le Bureau", "Create a desktop shortcut"), !miseAJour));
            bureau.Location = new Point(X0 - Theme.S(2), Theme.S(252));
            var parDefaut = Ajouter(new Case(Langue.T("Choisir La Cigale comme navigateur par défaut", "Make La Cigale the default browser"), !miseAJour));
            parDefaut.Location = new Point(X0 - Theme.S(2), Theme.S(286));

            Paragraphe(Langue.T("En installant, vous acceptez la licence publique Mozilla 2.0.", "By installing, you accept the Mozilla Public License 2.0."), 342, 22, Theme.TexteDoux, 9f);
            var licence = Ajouter(new Lien(Langue.T("Lire la licence", "Read the license"), 9f));
            licence.Location = new Point(X0 - Theme.S(2), Theme.S(364));
            licence.Click += delegate { PageLicence(); };

            Boutons(miseAJour ? Langue.T("Mettre à jour", "Update") : Langue.T("Installer", "Install"), Langue.T("Annuler", "Cancel"),
                delegate { Installer(bureau.Coche, parDefaut.Coche); }, delegate { Quitter(); });
        }

        void PageLicence()
        {
            Vider();
            Titre(Langue.T("Licence", "License"), 52);
            var cadre = Ajouter(new Panel
            {
                BackColor = Theme.Surface, Padding = new Padding(Theme.S(14), Theme.S(12), Theme.S(4), Theme.S(12)),
                Location = new Point(X0, Theme.S(108)), Size = new Size(LargeurContenu, Theme.S(270)),
            });
            var texte = new RichTextBox
            {
                Text = Reformer(Ressources.Texte("LICENCE.txt")), ReadOnly = true, BorderStyle = BorderStyle.None,
                BackColor = Theme.Surface, ForeColor = Theme.Texte, Font = Theme.Police(9.5f, false),
                Dock = DockStyle.Fill, ScrollBars = RichTextBoxScrollBars.Vertical, DetectUrls = false,
            };
            cadre.Controls.Add(texte);
            SetWindowTheme(texte.Handle, "DarkMode_Explorer", null);
            Boutons(Langue.T("Retour", "Back"), null, delegate { PageAccueil(); }, null);
        }

        // LICENCE.txt est coupé à 80 colonnes, on recolle les paragraphes
        static string Reformer(string texte)
        {
            var paragraphes = texte.Replace("\r\n", "\n").Split(new[] { "\n\n" }, StringSplitOptions.None);
            return string.Join("\n\n", paragraphes.Select(delegate (string paragraphe)
            {
                var lignes = paragraphe.Split('\n');
                if (lignes.Length == 2 && lignes[1].Trim('=', '-') == "") return lignes[0].ToUpperInvariant();
                return string.Join(" ", lignes.Select(l => l.Trim()));
            }));
        }

        Barre barre;
        Label detail;

        void PageProgression(string titre)
        {
            Vider();
            Titre(titre, 52);
            Paragraphe(Langue.T("Cela ne prend que quelques secondes.", "This only takes a few seconds."), 104, 24, Theme.TexteDoux);
            barre = Ajouter(new Barre());
            barre.Location = new Point(X0, Theme.S(200));
            barre.Width = LargeurContenu;
            detail = Paragraphe("", 220, 24, Theme.TexteDoux, 9f);
            detail.AutoEllipsis = true;
        }

        void Progres(double valeur, string texte)
        {
            BeginInvoke((Action)delegate
            {
                barre.Valeur = valeur;
                detail.Text = texte == "" ? "" : Math.Round(valeur * 100) + " %  ·  " + texte;
            });
        }

        bool AttendreFermeture(string dossierCible)
        {
            while (Moteur.EnCours(dossierCible))
            {
                var resultat = MessageDialogue(Langue.T("La Cigale est ouverte", "La Cigale is open"),
                    Langue.T("Fermez toutes les fenêtres de La Cigale, puis cliquez sur Réessayer.", "Close all La Cigale windows, then click Retry."), Langue.T("Réessayer", "Retry"), Langue.T("Annuler", "Cancel"));
                if (!resultat) return false;
            }
            return true;
        }

        void Executer(string titre, Action travail, Action fin)
        {
            PageProgression(titre);
            occupe = true;
            var fil = new Thread(delegate ()
            {
                Exception erreur = null;
                try { travail(); }
                catch (Exception e) { erreur = e; }
                BeginInvoke((Action)delegate
                {
                    occupe = false;
                    if (erreur == null) fin(); else PageErreur(erreur);
                });
            });
            fil.IsBackground = true;
            fil.Start();
        }

        void Installer(bool bureau, bool parDefaut)
        {
            if (!AttendreFermeture(dossier)) return;
            string cible = dossier;
            Executer(Moteur.VersionInstallee != null ? Langue.T("Mise à jour…", "Updating…") : Langue.T("Installation…", "Installing…"),
                delegate { Moteur.Installer(cible, bureau, Progres); },
                delegate { PageFinInstallation(parDefaut); });
        }

        void PageFinInstallation(bool parDefaut)
        {
            Vider();
            Titre(Langue.T("C'est prêt.", "All set."), 52);
            Paragraphe(Langue.T("La Cigale est installée. Vous la retrouverez dans le menu Démarrer.", "La Cigale is installed. You will find it in the Start menu.") +
                (parDefaut ? Langue.T("\n\nWindows va ouvrir ses réglages : choisissez La Cigale comme navigateur web.", "\n\nWindows will open its settings: choose La Cigale as your web browser.") : ""),
                104, 96, Theme.TexteDoux);
            var lancer = Ajouter(new Case(Langue.T("Lancer La Cigale maintenant", "Launch La Cigale now"), true));
            lancer.Location = new Point(X0 - Theme.S(2), Theme.S(214));
            Boutons(Langue.T("Terminer", "Finish"), null, delegate
            {
                if (parDefaut) Moteur.OuvrirReglagesNavigateurParDefaut();
                if (lancer.Coche) Moteur.Lancer(dossier);
                Close();
            }, null);
        }

        void PageErreur(Exception erreur)
        {
            Vider();
            Titre(Langue.T("Une erreur est survenue", "Something went wrong"), 52);
            Paragraphe(erreur is UnauthorizedAccessException || erreur is IOException
                ? Langue.T("Un fichier n'a pas pu être écrit. Vérifiez que La Cigale est fermée et que le dossier est accessible, puis réessayez.", "A file could not be written. Check that La Cigale is closed and the folder is accessible, then try again.")
                : Langue.T("L'opération n'a pas pu aller à son terme.", "The operation could not be completed."), 104, 48, Theme.TexteDoux);
            Paragraphe(erreur.Message, 164, 120, Theme.Erreur, 9f);
            Boutons("Fermer", null, delegate { Close(); }, null);
        }

        void PageConfirmationDesinstallation()
        {
            Vider();
            Titre(Langue.T("Désinstaller La Cigale", "Uninstall La Cigale"), 52);
            Paragraphe(Langue.T("La Cigale sera retirée de cet ordinateur, avec ses raccourcis et son inscription " +
                "comme navigateur. Votre profil est conservé, sauf si vous cochez la case ci-dessous.",
                "La Cigale will be removed from this computer, along with its shortcuts and its registration " +
                "as a browser. Your profile is kept unless you tick the box below."), 104, 72, Theme.TexteDoux);
            var profil = Ajouter(new Case(Langue.T("Supprimer aussi mon profil", "Also delete my profile"), false));
            profil.Location = new Point(X0 - Theme.S(2), Theme.S(196));
            Paragraphe(Langue.T("Favoris, mots de passe, extensions et réglages.", "Bookmarks, passwords, extensions and settings."), 226, 22, Theme.TexteDoux, 9f).Left = X0 + Theme.S(28);
            Boutons(Langue.T("Désinstaller", "Uninstall"), Langue.T("Annuler", "Cancel"), delegate
            {
                if (!AttendreFermeture(dossierDesinstallation)) return;
                bool supprimer = profil.Coche;
                Executer(Langue.T("Désinstallation…", "Uninstalling…"),
                    delegate { Moteur.Desinstaller(dossierDesinstallation, supprimer, Progres); },
                    PageFinDesinstallation);
            }, delegate { Quitter(); });
        }

        void PageFinDesinstallation()
        {
            Vider();
            Titre(Langue.T("Au revoir.", "Goodbye."), 52);
            Paragraphe(Langue.T("La Cigale a été désinstallée. Merci de l'avoir utilisée.", "La Cigale has been uninstalled. Thank you for using it."), 104, 48, Theme.TexteDoux);
            Boutons("Fermer", null, delegate { Close(); }, null);
        }

        // remplace MessageBox, qui jurait avec le reste
        bool MessageDialogue(string titre, string texte, string oui, string non)
        {
            using (var boite = new Form
            {
                FormBorderStyle = FormBorderStyle.None, StartPosition = FormStartPosition.CenterParent,
                ClientSize = new Size(Theme.S(420), Theme.S(190)), BackColor = Theme.Surface, ShowInTaskbar = false,
            })
            {
                boite.Controls.Add(new Label
                {
                    Text = titre, Font = Theme.Police(13f, true), ForeColor = Theme.Texte, BackColor = Theme.Surface,
                    Location = new Point(Theme.S(28), Theme.S(24)), Size = new Size(Theme.S(364), Theme.S(30)),
                });
                boite.Controls.Add(new Label
                {
                    Text = texte, Font = Theme.Police(10f, false), ForeColor = Theme.TexteDoux, BackColor = Theme.Surface,
                    Location = new Point(Theme.S(28), Theme.S(60)), Size = new Size(Theme.S(364), Theme.S(52)),
                });
                var b1 = new Bouton(oui, true) { BackColor = Theme.Surface, DialogResult = DialogResult.OK };
                b1.Location = new Point(boite.ClientSize.Width - Theme.S(24) - b1.Width, boite.ClientSize.Height - Theme.S(60));
                b1.Click += delegate { boite.DialogResult = DialogResult.OK; };
                var b2 = new Bouton(non, false) { BackColor = Theme.Surface };
                b2.Location = new Point(b1.Left - Theme.S(10) - b2.Width, b1.Top);
                b2.Click += delegate { boite.DialogResult = DialogResult.Cancel; };
                boite.Controls.Add(b1);
                boite.Controls.Add(b2);
                boite.AcceptButton = b1;
                boite.HandleCreated += delegate
                {
                    int arrondi = 2;
                    try { DwmSetWindowAttribute(boite.Handle, 33, ref arrondi, 4); } catch (Exception) { }
                };
                return boite.ShowDialog(this) == DialogResult.OK;
            }
        }

        [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr fenetre, int attribut, ref int valeur, int taille);
        [DllImport("user32.dll")] static extern bool ReleaseCapture();
        [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr fenetre, int message, IntPtr w, IntPtr l);
        [DllImport("uxtheme.dll", CharSet = CharSet.Unicode)] static extern int SetWindowTheme(IntPtr fenetre, string app, string liste);
    }

    static class Programme
    {
        [STAThread]
        static int Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            bool silencieux = args.Any(a => a.Equals("/silencieux", StringComparison.OrdinalIgnoreCase));
            bool desinstallation = !Ressources.Existe("charge.zip");
            string dossier = Option(args, "/dossier");
            string langue = Option(args, "/langue") ?? Moteur.LireInstallation("Langue")
                ?? (Moteur.VersionInstallee != null ? "fr" : (System.Globalization.CultureInfo.CurrentUICulture.TwoLetterISOLanguageName == "fr" ? "fr" : "en"));
            Langue.En = langue.Equals("en", StringComparison.OrdinalIgnoreCase);

            if (desinstallation)
            {
                string depuis = Option(args, "/depuis");
                if (depuis == null)
                {
                    // un exe ne peut pas se supprimer lui-même : copie dans %TEMP% et relance
                    string ici = Path.GetDirectoryName(Application.ExecutablePath);
                    string copie = Path.Combine(Path.GetTempPath(), "LaCigale-desinstallation.exe");
                    File.Copy(Application.ExecutablePath, copie, true);
                    var relance = Process.Start(copie, "/depuis \"" + ici + "\"" + (silencieux ? " /silencieux" : ""));
                    if (silencieux) { relance.WaitForExit(); return relance.ExitCode; }
                    return 0;
                }
                if (!File.Exists(Path.Combine(depuis, "lacigale.exe")) && !File.Exists(Path.Combine(depuis, "installation.lst")))
                    return 2;
                try
                {
                    if (silencieux)
                    {
                        if (Moteur.EnCours(depuis)) return 3;
                        Moteur.Desinstaller(depuis, false, delegate { });
                        return 0;
                    }
                    Demarrer(new Fenetre(true, depuis));
                    return 0;
                }
                finally { SupprimerCopie(); }
            }

            if (silencieux)
            {
                string cible = dossier ?? Moteur.DossierInstalle ?? Moteur.DossierParDefaut;
                if (Moteur.EnCours(cible)) return 3;
                try
                {
                    bool bureau = !args.Any(a => a.Equals("/sansbureau", StringComparison.OrdinalIgnoreCase));
                    Moteur.Installer(cible, bureau, delegate { });
                    return 0;
                }
                catch (Exception e)
                {
                    Console.Error.WriteLine(e.Message);
                    return 1;
                }
            }
            Demarrer(new Fenetre(false, null));
            return 0;
        }

        static string Option(string[] args, string nom)
        {
            int i = Array.FindIndex(args, a => a.Equals(nom, StringComparison.OrdinalIgnoreCase));
            return i >= 0 && i + 1 < args.Length ? args[i + 1].TrimEnd('\\') : null;
        }

        static void Demarrer(Form fenetre)
        {
            Application.Run(fenetre);
        }

        static void SupprimerCopie()
        {
            try
            {
                Process.Start(new ProcessStartInfo("cmd.exe",
                    "/c ping -n 3 127.0.0.1 >nul & del /f /q \"" + Application.ExecutablePath + "\"")
                {
                    CreateNoWindow = true, UseShellExecute = false, WindowStyle = ProcessWindowStyle.Hidden,
                });
            }
            catch (Exception) { }
        }
    }
}
