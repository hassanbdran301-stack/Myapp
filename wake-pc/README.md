# إيقاظ الكمبيوتر من أي مكان

صفحة ويب فيها زر واحد بيصحّي الكمبيوتر من السبات، وبتشتغل من أي مكان بالعالم.

## كيف بيشتغل

```
الموبايل (من أي مكان)
      │  Tailscale (اتصال مشفّر)
      ▼
جهاز صغير بالبيت بيضل صاحي  ──(Magic Packet)──►  الكمبيوتر النايم
(Raspberry Pi / لابتوب قديم / أندرويد قديم)       (موصول بكابل)
```

الكمبيوتر النايم ما بيقدر يستقبل شي غير "رسالة الإيقاظ" (Wake-on-LAN)، وهاي لازم تنبعت من **داخل** شبكة البيت.
لهيك بنحتاج جهاز تاني بيضل شغال بالبيت، وعليه هالسيرفر.

---

## الخطوة 1: جهّز الكمبيوتر (مرة وحدة)

### أ) BIOS / UEFI
1. أعد تشغيل الكمبيوتر وادخل على BIOS (غالباً بزر `Del` أو `F2`).
2. فعّل الخيار، واسمه بيختلف حسب الشركة:
   `Wake on LAN` أو `Power On by PCI-E` أو `Resume by LAN`.
3. إذا في خيار `ErP` أو `Deep Sleep`، **عطّله**.

### ب) Windows
1. افتح **Device Manager**، وبعدين **Network adapters**، واعمل دبل كليك على كرت الإيثرنت.
2. تبويب **Power Management**: فعّل الخيارات الثلاثة:
   - Allow the computer to turn off this device to save power
   - Allow this device to wake the computer
   - Only allow a magic packet to wake the computer
3. تبويب **Advanced**: خلّي `Wake on Magic Packet` على **Enabled**.
4. (لإيقاظه من **الإطفاء الكامل** كمان، مش بس السبات) من **Control Panel** افتح **Power Options**، وبعدين **Choose what the power buttons do**، وشيل علامة **Turn on fast startup**.

### ج) سجّل معلومتين
افتح `cmd` واكتب:
```
ipconfig /all
```
من قسم **Ethernet adapter** سجّل:
- **Physical Address**، وهو عنوان الـ MAC، مثل `A1-B2-C3-D4-E5-F6`
- **IPv4 Address**، مثل `192.168.1.50`

> 💡 من إعدادات الراوتر، ثبّت الـ IP للكمبيوتر (DHCP Reservation)، حتى ما يتغيّر.

---

## الخطوة 2: شغّل السيرفر على الجهاز اللي بيضل صاحي

بيحتاج **Python 3.8 أو أحدث** بس، بدون أي مكتبات إضافية.

```bash
cd wake-pc
cp config.example.json config.json
nano config.json        # عدّل القيم
python3 wake_server.py
```

### الإعدادات (`config.json`)

| الحقل | الشرح |
|---|---|
| `name` | اسم بيظهر بالصفحة |
| `mac` | عنوان MAC تبع الكمبيوتر (**إجباري**) |
| `pc_ip` | IP الكمبيوتر، حتى تشوف إذا صاحي ولا نايم (اختياري) |
| `broadcast` | خلّيه `255.255.255.255`، وإذا ما زبط جرّب `192.168.1.255` |
| `wol_port` | `9` (أو `7`) |
| `password` | كلمة سر قوية، 8 أحرف على الأقل (**إجباري**) |
| `listen_port` | البورت اللي بتفتح عليه الصفحة (`8080`) |

### جرّب من نفس البيت أولاً
1. خلّي الكمبيوتر ينام (Start ← Sleep).
2. من الموبايل على نفس الواي فاي افتح: `http://<IP-الجهاز-الصاحي>:8080`
3. ادخل كلمة السر واكبس الزر. لازم يصحى خلال ثواني.

أو من سطر الأوامر مباشرة:
```bash
python3 wake_server.py --wake
```

---

## الخطوة 3: الوصول من أي مكان (Tailscale)

**Tailscale** مجاني للاستخدام الشخصي، وبيعمل شبكة خاصة مشفّرة بين أجهزتك.
**ما بتحتاج تفتح أي بورت بالراوتر**، والصفحة بتضل مخفية عن باقي الإنترنت.

1. اعمل حساب على [tailscale.com](https://tailscale.com).
2. نزّل Tailscale على **الجهاز الصاحي**، وسجّل دخول:
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up
   ```
3. نزّل تطبيق Tailscale على **موبايلك** وسجّل دخول بنفس الحساب.
4. اعرف عنوان الجهاز الصاحي بـ Tailscale:
   ```bash
   tailscale ip -4      # مثلاً 100.101.102.103
   ```
5. من الموبايل، ومن أي مكان، افتح: `http://100.101.102.103:8080`

> 📱 من قائمة المتصفح اختار **"إضافة إلى الشاشة الرئيسية"**، فبيصير عندك أيقونة مثل التطبيق.

> ⚠️ **لا تفتح البورت بالراوتر (Port Forwarding)** وتعرض الصفحة على الإنترنت مباشرة. Tailscale أأمن بكثير.

---

## الخطوة 4: خلّي السيرفر يشتغل تلقائياً

### على Raspberry Pi أو Linux (systemd)
أنشئ الملف `/etc/systemd/system/wake-pc.service`:
```ini
[Unit]
Description=Wake PC server
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=/home/pi/wake-pc
ExecStart=/usr/bin/python3 /home/pi/wake-pc/wake_server.py
Restart=always
User=pi

[Install]
WantedBy=multi-user.target
```
بعدين:
```bash
sudo systemctl enable --now wake-pc
```

### على موبايل أندرويد قديم (Termux)
```bash
pkg install python
python wake_server.py
```
ثبّت تطبيق **Termux:Boot** حتى يشتغل تلقائياً، وعطّل توفير البطارية لـ Termux.

---

## مشاكل شائعة

| المشكلة | الحل |
|---|---|
| ما بيصحى أبداً | تأكد من إعدادات BIOS، وإنو لمبة كرت الشبكة بتضل مضوية والجهاز نايم |
| بيصحى من السبات بس مش من الإطفاء | عطّل Fast Startup بـ Windows، وعطّل ErP بالـ BIOS |
| بيصحى أول كم دقيقة بس | بعض الراوترات بتنسى الجهاز النايم، فجرّب `broadcast` = `192.168.1.255` |
| الحالة دايماً "تعذّر معرفة الحالة" | جدار حماية Windows بيمنع ping، فاسمح بـ "File and Printer Sharing (Echo Request)" |

## الأمان
- كلمة السر إجبارية، وبعد 5 محاولات خاطئة بينحظر العنوان 15 دقيقة.
- الجلسة محفوظة بكوكي `HttpOnly` و `SameSite=Strict`، ومحمية من CSRF.
- `config.json` (فيه كلمة السر) مستثنى من git.
