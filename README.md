# GeoWork — Geolocation & Attendance System
> AI-powered Employee Tracking, Facial Recognition, and Background Services with a Flask web server and React Native Android app.

---

## Table of Contents
1. [System Requirements](#1-system-requirements)
2. [Environment Variables Setup](#2-environment-variables-setup)
3. [Web App Setup (Flask)](#3-web-app-setup-flask)
4. [Mobile App Setup (React Native)](#4-mobile-app-setup-react-native)
5. [Connecting Mobile App to Flask](#5-connecting-mobile-app-to-flask)
6. [Rebuilding the APK](#6-rebuilding-the-apk)
7. [Project Structure](#7-project-structure)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. System Requirements

Install the following tools **in order** before anything else.

### 1.1 Python `3.10.x`
- Download: https://www.python.org/downloads/release/python-3100/
- During installation → ✅ **Check "Add Python to PATH"**
- Verify:
  ```bash
  python --version
  # Python 3.10.x
  pip --version
  ```

### 1.2 Node.js `18.x LTS` or higher
- Download: https://nodejs.org/en/download (choose LTS)
- Installation automatically adds Node and npm to PATH
- Verify:
  ```bash
  node --version   # v18.x.x or higher
  npm --version    # 9.x.x or higher
  ```

### 1.3 Java JDK `17`
- Download: https://www.oracle.com/java/technologies/downloads/#java17
- After installation, set environment variable:

  | Variable | Value (example) |
  |---|---|
  | `JAVA_HOME` | `C:\Program Files\Java\jdk-17` |

- Add to PATH: `%JAVA_HOME%\bin`
- Verify:
  ```bash
  java -version
  # java version "17.x.x"
  javac -version
  ```

### 1.4 Android Studio (Hedgehog `2023.1.1` or newer)
- Download: https://developer.android.com/studio
- During installation, make sure these are checked:
  - ✅ Android SDK
  - ✅ Android SDK Platform
  - ✅ Android Virtual Device (AVD)

- After installation, open Android Studio → **SDK Manager** → install:
  - **SDK Platform:** Android 14.0 (API 34)
  - **SDK Tools:**
    - Android SDK Build-Tools `34.0.0`
    - NDK (Side by side) `26.1.10909125`
    - CMake `3.22.1`
    - Android Emulator
    - Android SDK Platform-Tools

- Set environment variables:

  | Variable | Value (example) |
  |---|---|
  | `ANDROID_HOME` | `C:\Users\<YourName>\AppData\Local\Android\Sdk` |

- Add to PATH (System):
  ```
  %ANDROID_HOME%\tools
  %ANDROID_HOME%\tools\bin
  %ANDROID_HOME%\platform-tools
  %ANDROID_HOME%\emulator
  ```

- Verify:
  ```bash
  adb --version
  # Android Debug Bridge version 1.0.41
  ```

### 1.5 Gradle `8.x` (bundled — no separate install needed)
Gradle is downloaded automatically by the project's Gradle Wrapper (`gradlew.bat`). No manual install required.

### 1.6 MongoDB (Local or Atlas)
- Local: https://www.mongodb.com/try/download/community
- Or use a free **MongoDB Atlas** cluster: https://cloud.mongodb.com
- Note the **connection URI** — you'll need it for the `.env` file or `config.py`.

---

## 2. Environment Variables Setup

### How to Set Environment Variables on Windows
1. Search → **"Edit the system environment variables"**
2. Click **"Environment Variables"**
3. Under **System variables**, click **New** for each entry below

### Required Variables

| Variable | Value |
|---|---|
| `JAVA_HOME` | `C:\Program Files\Java\jdk-17` |
| `ANDROID_HOME` | `C:\Users\<Name>\AppData\Local\Android\Sdk` |

### Add to `Path` System Variable (Edit → New → paste each):
```
%JAVA_HOME%\bin
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\tools
%ANDROID_HOME%\tools\bin
%ANDROID_HOME%\emulator
```

### Verify everything at once:
```bash
python --version
node --version
java -version
adb --version
```

---

## 3. Web App Setup (Flask)

### Folder: `geo_cal/web/`

### Step 1 — Create and activate a Python virtual environment
```bash
cd geo_cal/web

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate
```

### Step 2 — Install Python dependencies
```bash
pip install flask pymongo deepface opencv-python numpy werkzeug pyngrok
```

**Dependencies installed:**
| Package | Purpose |
|---|---|
| `flask` | Web framework |
| `opencv-python` | Image processing for camera frames |
| `deepface` | Facial recognition and verification engine |
| `pymongo` | MongoDB database driver |
| `werkzeug` | Secure password hashing & utilities |
| `numpy` | Matrix transformations for images |
| `pyngrok` | Exposing local Flask API to internet |

### Step 3 — Run the Flask server
1. Ensure your MongoDB server is running locally on default port `27017` (or configured via `web/config.py`).
2. Start the server:
```bash
python app.py
```
*Note: The first time you launch `app.py`, deepface will download VGG-Face / Facenet model weights (this may take a few minutes).*

Flask will start at: **http://localhost:5000**

**Web routes available:**
| Route | Page |
|---|---|
| `http://localhost:5000/` | Dashboard (Redirects based on Role) |
| `http://localhost:5000/login` | Login Portal |
| `http://localhost:5000/employee` | Employee Geolocation Tracker |
| `http://localhost:5000/manager` | Manager Live Tracking Map |
| `http://localhost:5000/admin` | Admin SuperUser Dashboard |

### Step 4 — Optional: Expose via ngrok (for mobile testing)
Open a new terminal window:
```bash
ngrok http 5000
```
Copy the HTTPS URL (e.g. `https://abc123.ngrok-free.app`) — you'll need it for the mobile app.

---

## 4. Mobile App Setup (React Native)

### Folder: `geo_cal/mobile_app/`

### Prerequisites Check
```bash
node --version    # Must be >=18
java -version     # Must be 17
adb --version     # Must work (confirms ANDROID_HOME is set)
```

### Step 1 — Install Node dependencies
```bash
cd geo_cal/mobile_app
npm install
```

**Key packages installed:**
| Package | Version | Purpose |
|---|---|---|
| `react-native` | `0.74.5` | Mobile framework |
| `react` | `18.2.0` | UI library |
| `@react-navigation/native-stack` | `^6.9.26` | Stack navigator |
| `react-native-webview` | `^13.12.5` | Leaflet Free Map Integration |
| `@react-native-community/geolocation` | `^3.4.0` | Background/Foreground Tracking |
| `react-native-background-actions` | `^4.0.1` | Android Persistent Foreground Service |
| `@notifee/react-native` | `^9.1.7` | Local Real-time Push Notifications |
| `react-native-image-picker` | `^7.2.3` | Face Verification Image Capture |

### Step 2 — Set the ngrok / server URL
Open `mobile_app/src/api.js`:
```js
// Replace with your ngrok HTTPS URL (DO NOT INCLUDE trailing slash)
export const NGROK_URL = 'https://YOUR_NGROK_URL.ngrok-free.app';
```

### Step 3 — Bundle the JavaScript into APK assets
> ⚠️ This step is **required** every time you change JS code. Run it before building the APK.
```bash
cd geo_cal/mobile_app

npx react-native bundle ^
  --platform android ^
  --dev false ^
  --entry-file index.js ^
  --bundle-output .\android\app\src\main\assets\index.android.bundle ^
  --assets-dest .\android\app\src\main\res
```

### Step 4 — Build the debug APK
```bash
cd geo_cal/mobile_app/android

.\gradlew.bat clean assembleDebug
```

⏳ First build takes **10–20 minutes** (downloads NDK, Gradle dependencies).  
⚡ Subsequent builds take **~30–60 seconds** (cached).

### Step 5 — Locate the APK
```
mobile_app\android\app\build\outputs\apk\debug\app-debug.apk
```

Transfer this file to your Android phone and install it (Alternatively, drag and drop into an Android Studio Emulator).
> On your phone: Settings → Security → **Allow install from unknown sources**

---

## 5. Connecting Mobile App to Flask

| Scenario | What to use as `NGROK_URL` |
|---|---|
| Phone + PC on same WiFi | `http://192.168.x.x:5000` (your PC's local IP from `ipconfig`) |
| Phone on mobile data / different network | `https://xxxx.ngrok-free.app` (ngrok HTTPS tunnel) |

**Every time Flask restarts (ngrok URL changes):**
1. Update `NGROK_URL` in `mobile_app/src/api.js`
2. Re-run Step 3 (bundle)
3. Re-run Step 4 (build APK)
4. Reinstall APK on phone

---

## 6. Rebuilding the APK

Quick reference for every code change:

```bash
# 1. Bundle JS (run from mobile_app/)
npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output .\android\app\src\main\assets\index.android.bundle --assets-dest .\android\app\src\main\res

# 2. Build APK (run from mobile_app/android/)
.\gradlew.bat clean assembleDebug
```

APK output: `mobile_app\android\app\build\outputs\apk\debug\app-debug.apk`

---

## 7. Project Structure

```
geo_cal/
│
├── web/                          ← Flask backend
│   ├── app.py                    ← Main Flask application (Routes)
│   ├── config.py                 ← Globals, JWT Secrets, Mongo Defaults
│   ├── db.py                     ← MongoDB Initializations & Collections
│   ├── seed.py                   ← Auto-create Manager/Admin accounts
│   ├── services/                 ← Auth and Payroll service logic
│   ├── templates/                ← HTML Pages (Jinja2)
│   │   ├── login.html
│   │   ├── employee.html
│   │   ├── manager.html
│   │   └── admin.html
│   └── static/                   ← JS/CSS web assets
│
└── mobile_app/                   ← React Native Android app
    ├── src/
    │   ├── api.js                ← API base URL, headers & Fetch wrappers
    │   └── screens/
    │       ├── LoginScreen.js          ← Main Face/Password Auth
    │       ├── EmployeeDashboard.js    ← OpenStreetMaps, Background Service, Heatbeat
    │       ├── VerifyPresence.js       ← DeepFace Push Notification Dropdown
    │       ├── ManagerDashboard.js     ← Multi-employee Live GPS Table
    │       └── RegisterEmployee.js
    ├── App.js                    ← React Navigation Stack Context
    ├── index.js                  ← Entry point
    ├── package.json
    └── android/                  ← Android build files
        └── app/build/outputs/
            └── apk/debug/
                └── app-debug.apk ← Final APK here
```

---

## 8. Troubleshooting

### ❌ `Unable to load script` on phone
**Cause:** APK doesn't have bundled JS.  
**Fix:** Run Step 3 (bundle JS) and Step 4 (rebuild APK) again.

### ❌ Background Tracking crash on specific Android devices
**Cause:** Battery optimization kills background syncs or React limits deep-sleep.
**Fix:** Go to your Android settings, find the App, go to Battery, and set it to `Unrestricted`.

### ❌ DeepFace `Face Not Matched!`
**Cause:** Facial verification failing due to varied lighting or shadows.
**Fix:** During Registration via the Manager Dashboard, ensure the employee is in bright, standard lighting. DeepFace thresholds are highly sensitive to facial angles.

### ❌ `JAVA_HOME is not set`
**Fix:** Set `JAVA_HOME` to your JDK-17 path and add `%JAVA_HOME%\bin` to PATH.

### ❌ `adb: command not found`
**Fix:** Set `ANDROID_HOME` and add `%ANDROID_HOME%\platform-tools` to PATH. Restart terminal.

### ❌ Network request failed in app
**Fix:** 
- Make sure Flask is running (`python app.py`)
- Update `NGROK_URL` in `src/api.js` with current ngrok URL
- Rebuild APK after changing the URL

### ❌ Gradle build hangs / OOM error
**Fix:** Add to `mobile_app/android/gradle.properties`:
```properties
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=512m
```
