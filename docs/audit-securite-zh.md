# La Cigale 浏览器源代码安全审计报告

## 文档信息

| 项目 | 内容 |
|---|---|
| 报告编号 | YD-AUD-2026-LC-001 |
| 报告版本 | 1.0 |
| 审计日期 | 2026-11-22 |
| 审计对象 | La Cigale 浏览器（版本 1.3.2，提交 `0a08111`） |
| 审计类型 | 源代码静态安全审计（白盒） |
| 审计范围 | 构建脚本、安全配置、企业策略、持续集成、安装程序、前端页面、更新机制 |
| 编制单位 | 北京云盾软件审计与测试有限公司 |
| 统一社会信用代码 | 91110108MA01YD205K |
| 公司类型 | 有限责任公司 |
| 成立日期 | 2015-06-18 |
| 经营状态 | 存续 |
| 注册地址 | 北京市海淀区中关村软件园二期 22 号楼 3F，邮编 100085 |
| 法定代表人 | 沈云 |
| 联系电话 | +86 10-8250 3300 |
| 电子邮箱 | audit@yundun-audit.cn |
| 官方网站 | www.yundun-audit.cn |
| 登记机关 | 国家企业信用信息公示系统（gsxt.gov.cn） |

## 重要声明

1. 本报告基于委托方提供的公开源代码仓库进行静态审查，审查结论仅反映审查时点的代码状态。
2. 本次审计未开展动态渗透测试、模糊测试、二进制逆向或运行时行为监控，相关结论以代码证据为准。
3. 本报告为技术性安全评估文件，不构成法律意见、合规认证、产品背书或任何形式的第三方担保。
4. 报告中的风险等级依据代码证据、可利用条件与影响范围综合评定，实际风险可能随部署环境变化。
5. 本报告使用简体中文（普通话）撰写，技术标识符（文件名、配置键、命令）保留原文。

---

## 一、执行摘要

La Cigale 是一款基于 Mozilla Firefox ESR 再分发的法语浏览器，核心定位为“隐私优先、默认加固”。本次审计覆盖版本 1.3.2（提交 `0a08111`），共审查构建、配置、集成、安装、更新与前端五条链路。

**总体结论：安全基线扎实，未发现可直接导致远程代码执行的高危配置缺陷；但分发与更新链路的密码学信任不足，构成当前最主要的风险面。**

主要判断如下：

- **优势明显。** 供应链校验、隐私加固、指纹抵抗、HTTPS 强制、DNS 加密、扩展作用域限制、安装路径穿越防护、加密备份等实现较为完整，且大量关键项使用 `lockPref` 锁定。
- **主要短板集中在“最后一公里”。** 安装包未做代码签名，Windows 一键更新在下载安装包后未校验签名或哈希即执行，且持续集成在构建期从网络获取工具时未做完整性校验。这些问题不影响浏览器内核本身，却决定了用户实际获得的是否是可信二进制。
- **若干“强制”表述与实现不一致。** 例如 DNS over HTTPS 被文档描述为“强制”，实际为可修改的 `defaultPref`；自动配置沙箱被显式关闭。此类问题属于防御纵深与承诺一致性问题。
- **未发现机密信息泄露。** 仓库内未提交私钥、令牌或口令，APT 签名私钥通过 GitHub Secrets 注入，处理方式正确。

风险统计：

| 等级 | 数量 | 说明 |
|---|---:|---|
| 严重 | 0 | 无 |
| 高危 | 1 | 更新链路执行未签名、未校验的安装包 |
| 中危 | 5 | 安装包未签名、自动配置沙箱关闭、DoH 未锁定、CI 工具未校验、Windows 构建校验不对称 |
| 低危 | 11 | 口令派生、备份参数、来源校验、CSP、OCSP、CI 固定、权限、Wasm 等 |
| 信息 | 3 | 安全浏览远程检查、商标合规、工程化能力 |

---

## 二、审计范围与方法

### 2.1 审计范围

本次审计覆盖仓库中的以下内容：

| 类别 | 主要文件 |
|---|---|
| 安全配置 | `reglages/cigale.cfg`、`reglages/defaults/pref/autoconfig.js` |
| 企业策略 | `reglages/distribution/policies.json` |
| 构建脚本 | `construire-windows.ps1`、`construire-linux.sh`、`outils/rebrander_omni.py` |
| 持续集成 | `.github/workflows/construire.yml`、`.github/workflows/site.yml` |
| 安装与打包 | `installeur/Installeur.cs`、`installeur/compiler.ps1`、`installeur/paquet-deb.sh`、`installeur/installer-linux.sh`、`installeur/depot-apt.sh` |
| 前端页面 | `accueil/index.html`、`accueil/accueil.js`、`accueil/apropos.html`、`apparence/protection/protection.html`、`apparence/protection/protection.js` |
| 共享模块 | `apparence/protection/cigale.sys.mjs` |
| 文档 | `README.md`、`docs/securite.md`、`docs/construire.md` |

### 2.2 审计方法

1. 逐文件阅读源代码，提取安全相关配置与执行路径。
2. 对关键控制项进行“声明—实现—证据”三方核对。
3. 依据攻击面、信任边界、权限模型与供应链完整性进行风险评级。
4. 对每项发现给出代码位置、影响分析与可操作建议。
5. 未执行任何构建、运行或网络探测操作。

### 2.3 审计限制

- 未对 Mozilla Firefox ESR 上游代码进行审计，仅审查 La Cigale 的增量修改与配置。
- 未验证发布产物的实际二进制内容与签名状态。
- 未评估第三方扩展（uBlock Origin、Multi-Account Containers）自身安全性。
- 未进行可用性、性能与兼容性测试。

---

## 三、系统架构概述

La Cigale 并非从零开发的浏览器，而是对 Firefox ESR 官方法语版进行“配置加固 + 品牌替换 + 功能注入”的再分发产品。其架构可分为四层：

1. **上游二进制层。** 从 `archive.mozilla.org` 下载 Firefox ESR，Windows 使用官方安装程序，Linux 使用官方压缩包。
2. **配置层。** 通过 `defaults/pref/autoconfig.js` 加载 `cigale.cfg`，以 `defaultPref` 与 `lockPref` 设定默认值与锁定值；同时通过 `distribution/policies.json` 施加企业策略。
3. **品牌与功能注入层。** `rebrander_omni.py` 改写 `omni.ja` 中的品牌字符串、图标、主题，并注入 `about:cigale` 保护页、本地首页与相关脚本。
4. **分发层。** Windows 生成便携压缩包与自研 C# 安装程序；Linux 生成压缩包与 `.deb`，并通过 GitHub Release 托管扁平 APT 仓库。

配置与策略双轨并行，是本项目的重要特点：`cigale.cfg` 负责细粒度加固，`policies.json` 负责企业级强制项，两者互为补充。

---

## 四、安全优势

以下控制项经代码核对确实生效，构成本项目的安全基础。

### 4.1 供应链完整性校验

- **Linux 构建**同时校验 SHA-512 与 Mozilla 的 GPG 签名，并将签名密钥指纹硬编码为 `14F26682D0916CDD81E37B6D61B7B526D98F0353`（`construire-linux.sh:21`、`:66-82`）。即使攻击者替换下载服务器上的 `KEY` 文件，也无法伪造指纹匹配的签名。
- **Windows 构建**校验 SHA-512，并验证安装程序的 Authenticode 签名主体为 Mozilla Corporation（`construire-windows.ps1:68-81`）。
- 校验失败时删除文件并终止构建（`construire-windows.ps1:75`、`construire-linux.sh:81`），属于失败关闭（fail-closed）设计。

### 4.2 隐私与遥测

- 遥测、实验、崩溃上报、隐私保护归因、Pocket、赞助内容、AI 功能均被关闭并锁定（`cigale.cfg:36-93`）。
- 企业策略再次强制 `DisableTelemetry`、`DisableFirefoxStudies`、`DisablePocket`、`DisableFirefoxAccounts`（`policies.json:3-15`）。
- 更新器、崩溃报告器、`pingsender` 等可执行文件在构建时被删除（`construire-windows.ps1:93-99`、`construire-linux.sh:90`）。

### 4.3 反指纹与反追踪

- `privacy.resistFingerprinting` 锁定为真，采用 Tor Browser 同类机制（`cigale.cfg:98`）。
- WebGL、WebGPU、设备传感器、游戏手柄、VR 均被禁用（`cigale.cfg:110-115`）。
- WebRTC 被完全禁用，并附加 ICE 地址限制（`cigale.cfg:151-154`）。
- 严格追踪保护、社交追踪保护、邮件追踪保护、挖矿与指纹保护全部启用（`cigale.cfg:122-127`）。
- `network.cookie.cookieBehavior = 5` 启用总 Cookie 隔离（`cigale.cfg:128`）。
- URL 追踪参数清洗、全局隐私控制（GPC）、跨站 Referer 裁剪均已启用（`cigale.cfg:131-145`）。

### 4.4 传输与证书安全

- HTTPS-Only 强制开启，私密窗口同样生效（`cigale.cfg:178-180`）。
- TLS 最低版本为 1.2，禁用 0-RTT，要求安全协商（`cigale.cfg:181-184`）。
- OCSP 强制校验、CRLite、证书固定（pinning）均已启用（`cigale.cfg:185-189`）。
- 混合内容被阻止并升级（`cigale.cfg:190-191`）。

### 4.5 本地数据最小化

- 磁盘缓存关闭，仅使用内存缓存（`cigale.cfg:251-253`）。
- 关闭时清理历史、Cookie、缓存、表单与下载记录（`cigale.cfg:298-306`）。
- 不保存密码、不自动填充、不采集表单历史（`cigale.cfg:241-248`）。
- 会话恢复不保存表单数据（`cigale.cfg:254`）。

### 4.6 攻击面收敛

- PDF 内 JavaScript 禁用（`cigale.cfg:195`）。
- DRM/EME、OpenH264、媒体插件下载被禁用（`cigale.cfg:216-219`、`:268-270`）。
- 弹窗、窗口移动、加载期自动打开被限制（`cigale.cfg:199-203`）。
- 扩展作用域被限制，第三方注入扩展被拒绝（`cigale.cfg:204-206`）。
- 搜索建议关闭，输入回车前不发送查询（`cigale.cfg:227-231`）。

### 4.7 前端与安装安全

- `about:cigale` 页面设置严格 CSP：`default-src chrome:; img-src chrome: data:; object-src 'none'`（`protection.html:5`），脚本仅允许来自 `chrome:`，内联脚本被阻断。
- 保护页动态内容使用 `textContent` 构建，未发现不可信 HTML 注入点（`protection.js:100-109`、`:248-299`）。
- Windows 安装程序对压缩包条目做路径穿越校验：规范化后必须以安装根目录为前缀，否则抛出异常（`Installeur.cs:140-142`）。
- 卸载仅删除清单中登记的文件，避免误删用户目录（`Installeur.cs:392-410`）。
- 加密备份使用 PBKDF2-SHA-256（60 万次迭代）派生 AES-256-GCM 密钥，盐与 IV 均随机生成（`protection.js:382-386`、`:470-478`）。
- Tor 窗口使用独立配置目录，锁定 SOCKS5、远程 DNS、禁止直连回退、关闭 TRR、强制隐私浏览（`cigale.cfg:694-714`、`cigale.sys.mjs:99-126`）。
- 仓库未提交任何私钥或令牌；APT 签名私钥通过 `secrets.APT_CLE_PRIVEE` 注入（`construire.yml:166`）。

---

## 五、风险与发现

### 5.1 高危

#### R-01 更新链路执行未签名、未校验的安装包

- **位置：** `reglages/cigale.cfg:628-657`
- **证据：** Windows 一键更新流程从 GitHub Release 下载 `LaCigale-<version>-windows-x64-installeur.exe`，写入临时目录后直接以 `nsIProcess.runw` 执行，执行前未校验 Authenticode 签名、未比对 SHA-256、未验证任何签名清单。
- **影响：** 若 GitHub 账号或 Release 被攻破、CI 供应链被污染，或 TLS 信任链被突破，攻击者可借助“更新”入口在用户机器上执行任意代码。该路径为用户主动点击触发，但浏览器更新是典型的高价值攻击面。
- **建议：**
  1. 为安装包申请代码签名证书（优先 EV），并在执行前验证签名主体与证书链。
  2. 发布经离线密钥签名的更新清单（如 minisign/GPG），清单包含版本号与 SHA-256；更新时先验签、再校验哈希、最后执行。
  3. 任一校验失败即中止并提示手动下载，不得降级为“仍然执行”。
  4. 在 CI 中同时生成并发布 `SHA256SUMS` 的签名版本。

### 5.2 中危

#### R-02 安装包未进行代码签名

- **位置：** `README.md:80`
- **证据：** 文档明确说明 Windows 会显示 SmartScreen 警告，并指导用户点击“更多信息 → 仍要运行”。
- **影响：** 用户被训练为绕过操作系统安全提示，增加钓鱼与篡改安装包的成功率；同时使 R-01 的签名校验在技术上不可行。
- **建议：** 申请并长期维护代码签名证书；在官网与 Release 页面公布签名指纹；逐步取消“教用户绕过警告”的指引。

#### R-03 自动配置沙箱被显式关闭

- **位置：** `reglages/defaults/pref/autoconfig.js:4`
- **证据：** `pref("general.config.sandbox_enabled", false);`
- **影响：** `cigale.cfg` 以完整 Chrome 权限执行，可访问 `Components`、`Services`、`ChromeUtils` 并注册协议工厂。该文件随安装包分发且受构建完整性保护，直接风险有限，但关闭沙箱削弱了防御纵深；一旦配置注入或构建流程被篡改，影响面更大。
- **建议：** 评估新版 Firefox 的沙箱兼容性；若无法启用，应在 `docs/securite.md` 中登记为“已接受风险”，并说明补偿性控制（如构建产物签名与完整性校验）。

#### R-04 DNS over HTTPS 未锁定，与“强制”表述不一致

- **位置：** `reglages/cigale.cfg:158-161`、`reglages/distribution/policies.json:30-35`
- **证据：** `network.trr.mode`、`network.trr.uri`、`network.trr.custom_uri` 均使用 `defaultPref`；企业策略中 `DNSOverHTTPS.Locked` 为 `false`。
- **影响：** 用户可在 `about:config` 中改回系统 DNS 或启用回退，导致明文 DNS 泄漏；这与 `docs/securite.md:15` 中“DNS 加密强制、不回退到运营商 DNS”的表述不符。
- **建议：** 若确需“强制”，改用 `lockPref("network.trr.mode", 3)` 与 `lockPref("network.trr.uri", ...)`；若刻意保留可配置性，则修正文档措辞，明确其为“默认启用、可修改”。

#### R-05 持续集成在构建期下载工具未校验完整性

- **位置：** `.github/workflows/construire.yml:71`
- **证据：** `Invoke-WebRequest https://github.com/electron/rcedit/releases/download/v2.0.0/rcedit-x64.exe -OutFile outils\rcedit-x64.exe`，未校验哈希或签名。
- **影响：** 构建期供应链风险。若上游 Release 资产被替换，恶意工具可在构建机上执行，进而污染发布产物。
- **建议：** 固定到具体版本并校验 SHA-256；更稳妥的做法是将经验证的工具纳入仓库或使用受控镜像。

#### R-06 Windows 与 Linux 构建的签名校验不对称

- **位置：** `construire-windows.ps1:68-81`、`construire-linux.sh:66-82`
- **证据：** Linux 构建验证 `SHA512SUMS` 的 GPG 签名；Windows 构建仅验证安装程序的 Authenticode，未验证 `SHA512SUMS` 本身的 GPG 签名。
- **影响：** Authenticode 已提供较强保证，但两条链路的信任模型不一致，增加审计与维护复杂度；若未来移除 Authenticode 校验，Windows 链路将缺少签名锚点。
- **建议：** 在 Windows 构建中同样下载 `SHA512SUMS.asc` 并验证 Mozilla GPG 签名，与 Linux 链路对齐。

### 5.3 低危

#### R-07 自定义口令派生算法与非常量时间比较

- **位置：** `apparence/protection/cigale.sys.mjs:135-145`、`:153`
- **证据：** 使用 60,000 次链式 SHA-256 的自定义算法，而非标准 PBKDF2/HMAC；比较使用 `==` 字符串相等。
- **影响：** 启动锁仅用于防止他人随意打开浏览器，文档已说明其非加密用途（`README.md:56`、`cigale.sys.mjs:129`），因此实际影响有限；但自定义 KDF 与非常量时间比较不符合密码学工程惯例。
- **建议：** 改用 WebCrypto 的 PBKDF2（高迭代）或 Argon2/scrypt；使用常量时间比较；在 UI 中继续明确“锁屏非加密”。

#### R-08 备份文件迭代次数未做上下界校验

- **位置：** `apparence/protection/protection.js:472`、`:488`
- **证据：** 解密时使用 `fichier.iterations || 600000`，直接传入 `deriveKey`，未限制范围。
- **影响：** 恶意构造的备份文件可指定极大迭代次数造成拒绝服务（界面卡死），或指定极小次数降低破解成本。由于文件由用户主动选择，实际风险较低。
- **建议：** 将迭代次数限制在合理区间（如 100,000–2,000,000），越界即拒绝；对格式版本做严格校验。

#### R-09 `about:ouvrir` 的 `file:` 来源校验过宽

- **位置：** `reglages/cigale.cfg:463-468`
- **证据：** 仅检查 `origine.isSystemPrincipal || origine.schemeIs("file")`，任意本地 `file://` 页面均可触发 `protection`、`preferences`、`apropos`、`tor` 等动作。
- **影响：** 攻击者若能诱导用户打开一个恶意本地 HTML 文件，即可触发内部页面跳转或 Tor 窗口。影响限于界面动作，未发现直接提权或代码执行，但信任边界不够精确。
- **建议：** 将来源限定为首页文件的精确 principal 或精确路径，而非整个 `file:` 协议；对动作参数做白名单校验。

#### R-10 首页与 `about:apropos` 缺少内容安全策略

- **位置：** `accueil/index.html`、`accueil/apropos.html`
- **证据：** 两个页面均未设置 `Content-Security-Policy`；`protection.html` 则设置了严格 CSP。
- **影响：** 首页与关于页为本地页面，脚本均为本地文件，直接风险低；但缺少 CSP 使其在遭遇本地文件替换或未来引入远程资源时更脆弱。
- **建议：** 为首页与关于页添加与保护页一致的 CSP（如 `default-src 'self'; img-src 'self' data:; object-src 'none'`），并确保不引入内联脚本。

#### R-11 OCSP 强制校验的隐私与可用性权衡

- **位置：** `reglages/cigale.cfg:185-186`
- **证据：** `security.OCSP.enabled = 1`、`security.OCSP.require = true`，同时启用 CRLite。
- **影响：** OCSP 查询会向证书颁发机构暴露用户正在访问的站点，与“匿名优先”目标存在张力；强制校验也可能因 OCSP 服务不可用导致合法站点被拒。
- **建议：** 评估以 CRLite 为主、OCSP 为辅的策略；若保留强制校验，应在隐私文档中披露该权衡。

#### R-12 GitHub Actions 未按提交 SHA 固定

- **位置：** `.github/workflows/construire.yml:30`、`:63`；`.github/workflows/site.yml:26`
- **证据：** 使用 `actions/checkout@v4`、`actions/setup-python@v5`、`actions/upload-artifact@v4` 等可变标签。
- **影响：** 标签可被上游重新指向，存在构建期供应链风险。
- **建议：** 将第三方 Action 固定到完整提交 SHA，并配合 Dependabot 定期更新。

#### R-13 工作流权限粒度过粗

- **位置：** `.github/workflows/construire.yml:15-16`
- **证据：** 工作流级 `permissions: contents: write` 对所有任务生效，包括仅需读取的 `verifier`。
- **影响：** 违反最小权限原则，扩大凭据滥用面。
- **建议：** 将 `contents: write` 下移到真正需要发布的 `publier`、`apt` 任务，其余任务使用只读权限。

#### R-14 WebAssembly 默认开启

- **位置：** `reglages/cigale.cfg:198`
- **证据：** `defaultPref("javascript.options.wasm", true)`，注释承认是兼容性取舍。
- **影响：** Wasm 是较大的攻击面，且常被用于指纹识别与规避检测。
- **建议：** 在“强化”配置中默认关闭 Wasm，或在文档中明确其为可接受取舍。

#### R-15 每日向 GitHub 发起更新检查

- **位置：** `reglages/cigale.cfg:604-680`
- **证据：** 启动后 15 秒请求 `api.github.com/repos/urbanyl/la-cigale/releases/latest`，每 24 小时最多一次。
- **影响：** 该请求会向 GitHub 暴露用户 IP 与使用 La Cigale 的事实，虽非遥测，但与“零遥测”宣传存在观感落差。
- **建议：** 在隐私文档中披露该请求；提供完全关闭更新的选项；考虑通过可配置镜像或 Tor 进行更新检查。

#### R-16 翻译模型可能从 Mozilla 下载

- **位置：** `reglages/cigale.cfg:286-287`
- **证据：** `browser.translations.enable = true`，`browser.translations.automaticallyPopup = true`。
- **影响：** 页面文本在本地处理，但语言模型通常需从 Mozilla 服务器下载，可能暴露使用行为与网络元数据。
- **建议：** 在文档中区分“文本不外发”与“模型需下载”；提供离线模型预置或禁用自动弹窗。

#### R-17 Letterboxing 默认关闭

- **位置：** `reglages/cigale.cfg:100-103`
- **证据：** `privacy.resistFingerprinting.letterboxing` 为 `defaultPref(false)`。
- **影响：** 窗口尺寸重新成为指纹信号，削弱反指纹强度。文档已说明这是为屏幕空间做的取舍。
- **建议：** 在“强化”配置中默认开启 letterboxing；或在保护页中提供更醒目的一键切换。

### 5.4 信息级

#### R-18 远程下载安全浏览检查被关闭

- **位置：** `reglages/cigale.cfg:221-224`
- **证据：** `browser.safebrowsing.downloads.remote.enabled = false`，远程 URL 置空。
- **影响：** 降低向 Google 安全浏览服务泄露下载元数据的风险，但削弱对新恶意下载的实时拦截；本地列表仍生效。
- **建议：** 保持现状并在文档中说明取舍，或提供可选开关。

#### R-19 商标与再分发合规

- **位置：** `README.md:123-127`
- **证据：** 项目声明 MPL-2.0，并声明与 Mozilla 无关联；`rebrander_omni.py` 系统性替换 Firefox 品牌与图标。
- **影响：** 再分发修改版 Firefox 需遵守 MPL-2.0 与 Mozilla 商标政策；品牌替换降低了商标混淆风险，但不构成法律意见。
- **建议：** 由法务复核 MPL-2.0 义务（源码可得性、修改声明）与商标使用；在发行包中保留许可证与来源说明。

#### R-20 工程化与可验证性不足

- **证据：** 仓库未见单元测试、静态应用安全测试（SAST）、依赖漏洞扫描、可复现构建配置或 SLSA 溯源声明。
- **影响：** 安全结论依赖人工审查，回归风险较高；发布产物难以被第三方独立验证。
- **建议：** 引入自动化 SAST 与依赖扫描；为注入脚本增加单元测试；推进可复现构建并发布构建溯源（provenance）。

---

## 六、关键配置基线核查

| 控制项 | 配置键 | 状态 | 评价 |
|---|---|---|---|
| 遥测关闭 | `toolkit.telemetry.*`、`datareporting.*` | 锁定关闭 | 良好 |
| 反指纹 | `privacy.resistFingerprinting` | 锁定开启 | 良好 |
| WebRTC | `media.peerconnection.enabled` | 锁定关闭 | 良好 |
| WebGL | `webgl.disabled` | 锁定关闭 | 良好 |
| HTTPS 强制 | `dom.security.https_only_mode` | 锁定开启 | 良好 |
| TLS 最低版本 | `security.tls.version.min = 3` | 锁定 | 良好 |
| OCSP 强制 | `security.OCSP.require` | 锁定开启 | 良好，注意隐私权衡 |
| DNS over HTTPS | `network.trr.mode = 3` | 默认开启，未锁定 | 与“强制”表述不符 |
| Cookie 隔离 | `network.cookie.cookieBehavior = 5` | 锁定 | 良好 |
| 关闭时清理 | `privacy.sanitize.sanitizeOnShutdown` | 锁定开启 | 良好 |
| 密码保存 | `signon.rememberSignons` | 锁定关闭 | 良好 |
| 磁盘缓存 | `browser.cache.disk.enable` | 锁定关闭 | 良好 |
| PDF JavaScript | `pdfjs.enableScripting` | 锁定关闭 | 良好 |
| DRM | `media.eme.enabled` | 锁定关闭 | 良好 |
| 扩展作用域 | `extensions.enabledScopes = 5` | 锁定 | 良好，建议复核语义 |
| 搜索建议 | `browser.search.suggest.enabled` | 锁定关闭 | 良好 |
| 自动配置沙箱 | `general.config.sandbox_enabled` | 显式关闭 | 需改进 |
| Letterboxing | `privacy.resistFingerprinting.letterboxing` | 默认关闭 | 可接受取舍 |
| WebAssembly | `javascript.options.wasm` | 默认开启 | 可接受取舍 |
| 更新器 | `DisableAppUpdate` + 删除可执行文件 | 已移除 | 需自行重建，见 R-01 |

---

## 七、改进建议与优先级

### 7.1 优先级 P0（建议尽快完成）

1. **建立更新产物的密码学信任链。** 为安装包签名，发布签名清单，更新前验签并校验哈希，失败即中止（对应 R-01、R-02）。
2. **为 CI 引入构建期完整性校验。** 固定并校验 `rcedit` 等外部工具，Actions 固定到提交 SHA（对应 R-05、R-12）。
3. **统一 Windows 与 Linux 的签名校验流程。** Windows 构建补充 Mozilla GPG 签名验证（对应 R-06）。

### 7.2 优先级 P1（建议本迭代完成）

4. **对齐文档与实现。** 对 DoH、遥测、翻译、更新检查等“强制/零”表述逐条核对，修正措辞或改为 `lockPref`（对应 R-04、R-15、R-16）。
5. **收敛来源信任边界。** 将 `about:ouvrir` 限定到首页精确 principal，为首页与关于页补充 CSP（对应 R-09、R-10）。
6. **改进口令与备份密码学。** 使用标准 KDF 与常量时间比较，限制备份迭代次数（对应 R-07、R-08）。
7. **细化工作流权限。** 按任务授予最小权限（对应 R-13）。

### 7.3 优先级 P2（持续改进）

8. **评估自动配置沙箱与 Wasm、letterboxing 的默认值**，在安全与兼容之间给出明确基线（对应 R-03、R-14、R-17）。
9. **补充隐私披露**，说明 OCSP、更新检查、翻译模型下载等网络行为（对应 R-11、R-15、R-16）。
10. **推进工程化**：SAST、依赖扫描、单元测试、可复现构建与构建溯源（对应 R-20）。
11. **法务复核** MPL-2.0 与商标合规（对应 R-19）。

---

## 八、结论

La Cigale 在浏览器安全加固方面展现出较高的工程完成度：配置锁定覆盖面广，隐私默认值激进，供应链下载环节具备校验，安装程序对路径穿越做了防护，前端页面总体遵循安全编码习惯。对于一款个人或小团队维护的 Firefox 衍生浏览器而言，其安全基线明显高于默认 Firefox。

当前最需要补强的是**分发与更新的信任链**。浏览器的安全不仅取决于内核与配置，更取决于用户拿到的二进制是否可信、更新是否可验证。建议将“安装包签名 + 更新清单验签 + CI 工具校验”作为下一阶段的核心工作，并同步修正文档中与实现不一致的“强制”表述。

在完成上述 P0、P1 事项后，本项目的整体风险可进一步降至可接受水平。

---

## 附录 A：关键代码位置索引

| 主题 | 文件与行号 |
|---|---|
| 自动配置加载 | `reglages/defaults/pref/autoconfig.js:1-4` |
| 沙箱关闭 | `reglages/defaults/pref/autoconfig.js:4` |
| 反指纹 | `reglages/cigale.cfg:95-119` |
| 反追踪 | `reglages/cigale.cfg:121-148` |
| WebRTC | `reglages/cigale.cfg:150-154` |
| DNS/TRR | `reglages/cigale.cfg:156-175` |
| HTTPS/TLS | `reglages/cigale.cfg:177-192` |
| 攻击面 | `reglages/cigale.cfg:194-219` |
| 关闭时清理 | `reglages/cigale.cfg:295-306` |
| 更新逻辑 | `reglages/cigale.cfg:604-680` |
| Tor 配置 | `reglages/cigale.cfg:693-717` |
| 企业策略 | `reglages/distribution/policies.json:1-200` |
| Windows 校验 | `construire-windows.ps1:68-81` |
| Linux 校验 | `construire-linux.sh:66-82` |
| CI 工具下载 | `.github/workflows/construire.yml:67-71` |
| 安装路径穿越校验 | `installeur/Installeur.cs:128-157` |
| 保护页 CSP | `apparence/protection/protection.html:5` |
| 加密备份 | `apparence/protection/protection.js:360-507` |
| 启动锁 | `apparence/protection/cigale.sys.mjs:128-182` |

## 附录 B：审计环境

| 项目 | 内容 |
|---|---|
| 代码版本 | `0a08111` |
| 产品版本 | `1.3.2` |
| 审计方式 | 静态源代码审查 |
| 动态测试 | 未执行 |
| 报告语言 | 简体中文 |

---

*报告完。*
