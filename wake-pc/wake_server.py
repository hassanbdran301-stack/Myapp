#!/usr/bin/env python3
"""
سيرفر إيقاظ الكمبيوتر (Wake-on-LAN)

يشتغل على جهاز يبقى صاحياً داخل شبكة البيت (Raspberry Pi، لابتوب قديم،
موبايل أندرويد عليه Termux...) ويعرض صفحة ويب فيها زر لإيقاظ الكمبيوتر.

لا يحتاج أي مكتبات خارجية: Python 3.8+ فقط.

الإعداد عن طريق ملف config.json بجانب هذا الملف (انظر config.example.json).
"""

import hashlib
import hmac
import json
import os
import platform
import re
import secrets
import socket
import subprocess
import sys
import threading
import time
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs

BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = Path(os.environ.get("WAKE_CONFIG", BASE_DIR / "config.json"))

SESSION_TTL = 30 * 24 * 3600  # الجلسة تبقى شهر
MAX_FAILED_LOGINS = 5  # عدد المحاولات الخاطئة المسموحة
LOCKOUT_SECONDS = 15 * 60  # مدة الحظر بعد تجاوزها


# ---------------------------------------------------------------- الإعدادات

def load_config():
    if not CONFIG_PATH.exists():
        sys.exit(
            f"ملف الإعدادات غير موجود: {CONFIG_PATH}\n"
            "انسخ config.example.json إلى config.json وعدّل القيم."
        )
    with open(CONFIG_PATH, encoding="utf-8") as f:
        cfg = json.load(f)

    mac = normalize_mac(cfg.get("mac", ""))
    if not mac:
        sys.exit("عنوان MAC غير صحيح في config.json (مثال: AA:BB:CC:DD:EE:FF)")
    cfg["mac"] = mac

    password = cfg.get("password", "")
    if len(password) < 8 or password == "غير-هذه-الكلمة":
        sys.exit("اختر كلمة سر قوية (8 أحرف على الأقل) في config.json")

    cfg.setdefault("name", "الكمبيوتر")
    cfg.setdefault("broadcast", "255.255.255.255")
    cfg.setdefault("wol_port", 9)
    cfg.setdefault("pc_ip", "")
    cfg.setdefault("listen_host", "0.0.0.0")
    cfg.setdefault("listen_port", 8080)
    return cfg


def normalize_mac(mac):
    hex_only = re.sub(r"[^0-9A-Fa-f]", "", mac)
    if len(hex_only) != 12:
        return None
    return ":".join(hex_only[i:i + 2] for i in range(0, 12, 2)).upper()


# ---------------------------------------------------------------- Wake-on-LAN

def send_magic_packet(mac, broadcast, port):
    """رسالة الإيقاظ: 6 بايتات FF ثم عنوان MAC مكرر 16 مرة."""
    mac_bytes = bytes.fromhex(mac.replace(":", ""))
    packet = b"\xff" * 6 + mac_bytes * 16
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        # نرسلها أكثر من مرة لأن UDP لا يضمن الوصول
        for _ in range(3):
            sock.sendto(packet, (broadcast, port))
            time.sleep(0.1)


def is_pc_awake(ip):
    """يفحص إذا الكمبيوتر صاحي عن طريق ping. يرجع None إذا ما في IP."""
    if not ip:
        return None
    if platform.system().lower() == "windows":
        cmd = ["ping", "-n", "1", "-w", "1000", ip]
    else:
        cmd = ["ping", "-c", "1", "-W", "1", ip]
    try:
        result = subprocess.run(
            cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=3
        )
        return result.returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return None


# ---------------------------------------------------------------- الحماية

class Auth:
    def __init__(self, password):
        self._pw_hash = hashlib.sha256(password.encode()).digest()
        self._sessions = {}  # token -> وقت الانتهاء
        self._failures = {}  # ip -> (عدد المحاولات، وقت أول محاولة)
        self._lock = threading.Lock()

    def check_password(self, password):
        candidate = hashlib.sha256(password.encode()).digest()
        return hmac.compare_digest(candidate, self._pw_hash)

    def is_locked(self, ip):
        with self._lock:
            count, since = self._failures.get(ip, (0, 0))
            if count >= MAX_FAILED_LOGINS and time.time() - since < LOCKOUT_SECONDS:
                return True
            if time.time() - since >= LOCKOUT_SECONDS:
                self._failures.pop(ip, None)
            return False

    def record_failure(self, ip):
        with self._lock:
            count, since = self._failures.get(ip, (0, time.time()))
            self._failures[ip] = (count + 1, since)

    def clear_failures(self, ip):
        with self._lock:
            self._failures.pop(ip, None)

    def new_session(self):
        token = secrets.token_urlsafe(32)
        with self._lock:
            self._sessions[token] = time.time() + SESSION_TTL
        return token

    def valid_session(self, token):
        if not token:
            return False
        with self._lock:
            expiry = self._sessions.get(token)
            if expiry and expiry > time.time():
                return True
            self._sessions.pop(token, None)
            return False

    def end_session(self, token):
        with self._lock:
            self._sessions.pop(token, None)


# ---------------------------------------------------------------- الصفحات

PAGE_STYLE = """
:root{--bg:#0f172a;--card:#1e293b;--text:#e2e8f0;--muted:#94a3b8;
--accent:#6366f1;--accent2:#818cf8;--ok:#22c55e;--off:#64748b;--err:#ef4444}
@media (prefers-color-scheme: light){:root{--bg:#f1f5f9;--card:#fff;
--text:#0f172a;--muted:#64748b}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;
justify-content:center;background:var(--bg);color:var(--text);
font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;padding:16px}
.card{background:var(--card);border-radius:20px;padding:32px 24px;
width:100%;max-width:380px;text-align:center;
box-shadow:0 10px 30px rgba(0,0,0,.25)}
h1{font-size:1.4rem;margin:0 0 6px}
.muted{color:var(--muted);font-size:.9rem;margin:0 0 24px}
input{width:100%;padding:14px;border-radius:12px;border:1px solid var(--off);
background:transparent;color:var(--text);font-size:1rem;margin-bottom:12px}
button{width:100%;padding:16px;border:0;border-radius:14px;font-size:1.1rem;
font-weight:600;color:#fff;background:var(--accent);cursor:pointer}
button:disabled{opacity:.6;cursor:wait}
.wake{width:160px;height:160px;border-radius:50%;font-size:3.2rem;
margin:8px auto 20px;display:flex;align-items:center;justify-content:center;
background:radial-gradient(circle at 30% 30%,var(--accent2),var(--accent));
box-shadow:0 0 0 8px rgba(99,102,241,.15)}
.status{display:inline-flex;align-items:center;gap:8px;font-size:.95rem;
margin-bottom:8px}
.dot{width:10px;height:10px;border-radius:50%;background:var(--off)}
.dot.on{background:var(--ok);box-shadow:0 0 8px var(--ok)}
.msg{min-height:1.4em;font-size:.95rem;margin-top:12px}
.msg.err{color:var(--err)} .msg.ok{color:var(--ok)}
a{color:var(--muted);font-size:.85rem}
"""


def page(title, body):
    return f"""<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#6366f1">
<meta name="robots" content="noindex">
<title>{title}</title><style>{PAGE_STYLE}</style></head>
<body><div class="card">{body}</div></body></html>"""


def login_page(error=""):
    err = f'<p class="msg err">{error}</p>' if error else ""
    return page("تسجيل الدخول", f"""
<h1>🔒 إيقاظ الكمبيوتر</h1>
<p class="muted">أدخل كلمة السر</p>
<form method="post" action="/login">
<input type="password" name="password" autocomplete="current-password"
 placeholder="كلمة السر" required autofocus>
<button type="submit">دخول</button>
</form>{err}""")


def main_page(name, csrf, has_ip):
    status_block = """
<div class="status"><span class="dot" id="dot"></span>
<span id="stxt">جارِ الفحص…</span></div>""" if has_ip else ""
    return page("إيقاظ الكمبيوتر", f"""
<h1>{name}</h1>
<p class="muted">اضغط الزر لإخراج الكمبيوتر من السبات</p>
{status_block}
<button class="wake" id="wake" aria-label="إيقاظ">⏻</button>
<div class="msg" id="msg"></div>
<p style="margin-top:28px"><a href="/logout">تسجيل الخروج</a></p>
<script>
const CSRF = {json.dumps(csrf)};
const HAS_IP = {json.dumps(has_ip)};
const btn = document.getElementById('wake');
const msg = document.getElementById('msg');

async function refresh() {{
  if (!HAS_IP) return;
  try {{
    const r = await fetch('/status', {{cache: 'no-store'}});
    if (r.status === 401) return location.reload();
    const d = await r.json();
    const dot = document.getElementById('dot');
    const txt = document.getElementById('stxt');
    if (d.awake === true) {{ dot.className = 'dot on'; txt.textContent = 'الكمبيوتر صاحي'; }}
    else if (d.awake === false) {{ dot.className = 'dot'; txt.textContent = 'الكمبيوتر نايم أو مطفي'; }}
    else {{ dot.className = 'dot'; txt.textContent = 'تعذّر معرفة الحالة'; }}
  }} catch (e) {{}}
}}

btn.addEventListener('click', async () => {{
  btn.disabled = true;
  msg.className = 'msg'; msg.textContent = 'جارِ الإرسال…';
  try {{
    const r = await fetch('/wake', {{method: 'POST', headers: {{'X-CSRF-Token': CSRF}}}});
    if (r.status === 401) return location.reload();
    const d = await r.json();
    if (d.ok) {{
      msg.className = 'msg ok';
      msg.textContent = 'تم إرسال إشارة الإيقاظ ✓ انتظر 10 إلى 30 ثانية';
      let n = 0;
      const t = setInterval(() => {{ refresh(); if (++n >= 12) clearInterval(t); }}, 5000);
    }} else {{
      msg.className = 'msg err'; msg.textContent = d.error || 'صار خطأ';
    }}
  }} catch (e) {{
    msg.className = 'msg err'; msg.textContent = 'ما في اتصال بالسيرفر';
  }}
  btn.disabled = false;
}});

refresh();
setInterval(refresh, 30000);
</script>""")


# ---------------------------------------------------------------- السيرفر

class Handler(BaseHTTPRequestHandler):
    cfg = None
    auth = None
    server_version = "WakeServer"
    sys_version = ""

    # --- أدوات مساعدة
    def client_ip(self):
        return self.client_address[0]

    def session_token(self):
        raw = self.headers.get("Cookie", "")
        jar = cookies.SimpleCookie()
        try:
            jar.load(raw)
        except cookies.CookieError:
            return None
        morsel = jar.get("session")
        return morsel.value if morsel else None

    def csrf_for(self, token):
        return hmac.new(token.encode(), b"csrf", hashlib.sha256).hexdigest()

    def send(self, code, body, ctype="text/html; charset=utf-8", headers=None):
        data = body.encode("utf-8") if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def send_json(self, code, obj):
        self.send(code, json.dumps(obj, ensure_ascii=False),
                  "application/json; charset=utf-8")

    def redirect(self, location, headers=None):
        h = {"Location": location}
        h.update(headers or {})
        self.send(303, "", headers=h)

    def read_form(self):
        length = min(int(self.headers.get("Content-Length", 0) or 0), 4096)
        raw = self.rfile.read(length).decode("utf-8", "replace")
        return {k: v[0] for k, v in parse_qs(raw).items()}

    def log_message(self, fmt, *args):
        sys.stderr.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] "
                         f"{self.client_ip()} {fmt % args}\n")

    # --- المسارات
    def do_GET(self):
        token = self.session_token()
        logged_in = self.auth.valid_session(token)

        if self.path == "/":
            if not logged_in:
                return self.send(200, login_page())
            return self.send(200, main_page(
                self.cfg["name"], self.csrf_for(token), bool(self.cfg["pc_ip"])))

        if self.path == "/status":
            if not logged_in:
                return self.send_json(401, {"error": "غير مسجل"})
            return self.send_json(200, {"awake": is_pc_awake(self.cfg["pc_ip"])})

        if self.path == "/logout":
            self.auth.end_session(token)
            return self.redirect("/", {
                "Set-Cookie": "session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict"})

        self.send(404, page("غير موجود", "<h1>404</h1>"))

    def do_POST(self):
        ip = self.client_ip()

        if self.path == "/login":
            if self.auth.is_locked(ip):
                return self.send(429, login_page(
                    "محاولات كثيرة خاطئة. حاول بعد 15 دقيقة."))
            form = self.read_form()
            if self.auth.check_password(form.get("password", "")):
                self.auth.clear_failures(ip)
                token = self.auth.new_session()
                return self.redirect("/", {
                    "Set-Cookie": f"session={token}; Path=/; Max-Age={SESSION_TTL}; "
                                  "HttpOnly; SameSite=Strict"})
            self.auth.record_failure(ip)
            time.sleep(1)  # إبطاء التخمين
            return self.send(401, login_page("كلمة السر غير صحيحة"))

        if self.path == "/wake":
            token = self.session_token()
            if not self.auth.valid_session(token):
                return self.send_json(401, {"error": "غير مسجل"})
            sent = self.headers.get("X-CSRF-Token", "")
            if not hmac.compare_digest(sent, self.csrf_for(token)):
                return self.send_json(403, {"error": "طلب غير صالح"})
            try:
                send_magic_packet(self.cfg["mac"], self.cfg["broadcast"],
                                  int(self.cfg["wol_port"]))
            except OSError as e:
                self.log_message("فشل الإرسال: %s", e)
                return self.send_json(500, {"error": "فشل إرسال إشارة الإيقاظ"})
            self.log_message("تم إرسال إشارة الإيقاظ إلى %s", self.cfg["mac"])
            return self.send_json(200, {"ok": True})

        self.send_json(404, {"error": "غير موجود"})


def main():
    cfg = load_config()
    Handler.cfg = cfg
    Handler.auth = Auth(cfg["password"])

    if len(sys.argv) > 1 and sys.argv[1] == "--wake":
        # تشغيل مباشر من سطر الأوامر للتجربة
        send_magic_packet(cfg["mac"], cfg["broadcast"], int(cfg["wol_port"]))
        print(f"تم إرسال إشارة الإيقاظ إلى {cfg['mac']}")
        return

    server = ThreadingHTTPServer((cfg["listen_host"], int(cfg["listen_port"])), Handler)
    print(f"السيرفر شغال على http://{cfg['listen_host']}:{cfg['listen_port']}")
    print(f"الكمبيوتر المستهدف: {cfg['name']} ({cfg['mac']})")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nتم الإيقاف")


if __name__ == "__main__":
    main()
