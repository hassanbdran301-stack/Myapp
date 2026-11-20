#!/usr/bin/env bash
# Builds a signed teleprompter APK without Gradle or the Google-hosted Android SDK.
# Tools: aapt / dx / zipalign / apksigner from Ubuntu, android.jar (API 33) and
# the Kotlin compiler from GitHub. Everything is cached in .tools/.
set -euo pipefail
cd "$(dirname "$0")"

TOOLS="$PWD/.tools"
BUILD="$PWD/build"
OUT="$PWD/../dist/teleprompter.apk"
KOTLIN_VERSION=2.0.21
VERSION_CODE=${VERSION_CODE:-1}
VERSION_NAME=${VERSION_NAME:-1.0}
mkdir -p "$TOOLS"

# ---- tools -------------------------------------------------------------------
for t in aapt dalvik-exchange zipalign apksigner; do
  if ! command -v "$t" >/dev/null; then
    echo "Installing Android build tools from apt…"
    sudo_cmd=""; [ "$(id -u)" -ne 0 ] && sudo_cmd="sudo"
    $sudo_cmd apt-get update -qq
    DEBIAN_FRONTEND=noninteractive $sudo_cmd apt-get install -y -qq aapt dalvik-exchange zipalign apksigner
    break
  fi
done
if [ ! -f "$TOOLS/android.jar" ]; then
  echo "Downloading android.jar (API 33)…"
  curl -fsSL -o "$TOOLS/android.jar" \
    https://raw.githubusercontent.com/Sable/android-platforms/master/android-33/android.jar
fi
if [ ! -x "$TOOLS/kotlinc/bin/kotlinc" ]; then
  echo "Downloading Kotlin $KOTLIN_VERSION…"
  curl -fsSL -o "$TOOLS/kotlinc.zip" \
    "https://github.com/JetBrains/kotlin/releases/download/v$KOTLIN_VERSION/kotlin-compiler-$KOTLIN_VERSION.zip"
  (cd "$TOOLS" && unzip -q -o kotlinc.zip && rm kotlinc.zip)
fi
ANDROID_JAR="$TOOLS/android.jar"
KOTLINC="$TOOLS/kotlinc/bin/kotlinc"

# ---- build -------------------------------------------------------------------
rm -rf "$BUILD"; mkdir -p "$BUILD/classes" "$BUILD/stdlib"

echo "1/5 Packaging resources"
aapt package -f -M AndroidManifest.xml -S res -I "$ANDROID_JAR" \
  --min-sdk-version 26 --target-sdk-version 33 \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  -F "$BUILD/app.unsigned.apk"

echo "2/5 Compiling Kotlin"
"$KOTLINC" src -no-jdk -no-reflect -classpath "$ANDROID_JAR" \
  -jvm-target 1.8 -Xlambdas=class -Xsam-conversions=class \
  -nowarn -d "$BUILD/classes" 2>&1 | grep -v '^warning:' || true
[ -f "$BUILD/classes/com/hassan/teleprompter/MainActivity.class" ] || { echo "Kotlin compile failed"; exit 1; }

echo "3/5 Converting to dex"
(cd "$BUILD/stdlib" && unzip -q "$TOOLS/kotlinc/lib/kotlin-stdlib.jar" && rm -rf META-INF)
dalvik-exchange --dex --min-sdk-version=26 --output="$BUILD/classes.dex" \
  "$BUILD/classes" "$BUILD/stdlib"
(cd "$BUILD" && zip -q -j app.unsigned.apk classes.dex)

echo "4/5 Aligning"
zipalign -f -p 4 "$BUILD/app.unsigned.apk" "$BUILD/app.aligned.apk"

echo "5/5 Signing"
KEYSTORE="${KEYSTORE:-$PWD/teleprompter.keystore}"
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -keystore "$KEYSTORE" -storepass teleprompter -keypass teleprompter \
    -alias teleprompter -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Teleprompter" >/dev/null 2>&1
fi
mkdir -p "$(dirname "$OUT")"
apksigner sign --ks "$KEYSTORE" --ks-pass pass:teleprompter --ks-key-alias teleprompter \
  --out "$OUT" "$BUILD/app.aligned.apk"
apksigner verify "$OUT"
echo "Done: $(realpath "$OUT") ($(du -h "$OUT" | cut -f1))"
