#!/data/data/com.termux/files/usr/bin/bash
# تركيب سيرفر إيقاظ الكمبيوتر على موبايل أندرويد (Termux)
set -e

# كل شي داخل دالة حتى يشتغل صح مع curl | bash
main() {
BRANCH="${WAKE_BRANCH:-ccr-8b96bdea-2071j4}"
RAW="https://raw.githubusercontent.com/hassanbdran301-stack/Myapp/$BRANCH/wake-pc"
DIR="$HOME/wake-pc"

echo "== تثبيت Python =="
pkg install -y python curl </dev/null >/dev/null

echo "== تنزيل السيرفر =="
mkdir -p "$DIR"
curl -fsSL "$RAW/wake_server.py" -o "$DIR/wake_server.py"

echo
echo "== الإعدادات =="
read -rp "اسم الكمبيوتر (مثلاً: كمبيوتر البيت): " NAME </dev/tty
read -rp "عنوان MAC (مثلاً A1-B2-C3-D4-E5-F6): " MAC </dev/tty
read -rp "IP الكمبيوتر (مثلاً 192.168.1.50): " PCIP </dev/tty
while true; do
  read -rsp "كلمة سر للصفحة (8 أحرف أو أكثر): " PW </dev/tty; echo
  read -rsp "أعد كلمة السر: " PW2 </dev/tty; echo
  [ "$PW" = "$PW2" ] && [ ${#PW} -ge 8 ] && break
  echo "غير متطابقة أو أقصر من 8 أحرف، حاول مرة ثانية."
done

NAME="$NAME" MAC="$MAC" PCIP="$PCIP" PW="$PW" python - "$DIR/config.json" <<'PY'
import json, os, sys
ip = os.environ["PCIP"].strip()
parts = ip.split(".")
broadcast = ".".join(parts[:3] + ["255"]) if len(parts) == 4 else "255.255.255.255"
cfg = {
    "name": os.environ["NAME"].strip() or "الكمبيوتر",
    "mac": os.environ["MAC"].strip(),
    "pc_ip": ip,
    "broadcast": broadcast,
    "wol_port": 9,
    "password": os.environ["PW"],
    "listen_host": "0.0.0.0",
    "listen_port": 8080,
}
with open(sys.argv[1], "w", encoding="utf-8") as f:
    json.dump(cfg, f, ensure_ascii=False, indent=2)
PY
chmod 600 "$DIR/config.json"

echo "== تشغيل تلقائي عند إقلاع الموبايل =="
mkdir -p "$HOME/.termux/boot"
cat > "$HOME/.termux/boot/start-wake-pc.sh" <<EOF
#!/data/data/com.termux/files/usr/bin/bash
termux-wake-lock
cd "$DIR"
pkill -f wake_server.py 2>/dev/null
nohup python wake_server.py >> "$DIR/server.log" 2>&1 &
EOF
chmod +x "$HOME/.termux/boot/start-wake-pc.sh"

echo "== تجربة إرسال إشارة إيقاظ =="
cd "$DIR" && python wake_server.py --wake

echo "== تشغيل السيرفر =="
bash "$HOME/.termux/boot/start-wake-pc.sh"
sleep 1

IP=$(ip -4 addr show wlan0 2>/dev/null | grep -oE 'inet [0-9.]+' | cut -d' ' -f2)
echo
echo "✓ جاهز!"
echo "من نفس الواي فاي افتح:  http://${IP:-<IP-الموبايل>}:8080"
echo "السجل:  $DIR/server.log"
}

main "$@"
