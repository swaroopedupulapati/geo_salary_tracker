# GeoWork Quick Start Guide

Follow these instructions to run the full application suite (Backend Server + Android Mobile App) locally.

## 1. Backend Setup (Flask API)

The backend handles the MongoDB database, REST APIs, DeepFace recognition, and Manager/Admin web dashboards.

### Prerequisites
Make sure you have **Python 3.10+** and **MongoDB** installed and running on default port `27017`.

```bash
cd d:\ourcode\geo_cal\web
```

### Install Dependencies
*(It is highly recommended to use a Python virtual environment)*
```bash
pip install flask pymongo deepface opencv-python numpy werkzeug
```

### Seed and Run the Server
The `app.py` script automatically seeds the database with initial Manager/Admin accounts if they are missing.

```bash
python app.py
```
*Note: The first time you run this, DeepFace will download its required facial recognition model weights (VGG-Face or Facenet), which may take a few minutes.*

### Expose with Ngrok
The React Native app requires a secure HTTPS endpoint to communicate with the local Flask server. Run Ngrok in a new terminal window:
```bash
ngrok http 5000
```
**Important:** Copy the generated Forwarding URL (e.g., `https://xxxx-xx-xx.ngrok-free.dev`).

---

## 2. Mobile App Setup (React Native)

The mobile app enables Employee location tracking, background services, and face login verification.

```bash
cd d:\ourcode\geo_cal\mobile_app
```

### Configure the API URL
Open `d:\ourcode\geo_cal\mobile_app\src\api.js`.
Replace the `NGROK_URL` constant on line 3 with the new Forwarding URL you copied from Ngrok.
```javascript
export const NGROK_URL = 'https://xxxx-xx-xx.ngrok-free.dev';
```

### Install Dependencies
Install all Node modules needed for the React Native project:
```bash
npm install
```

### Build and Run on Android
Ensure you have an Android device connected via USB with "USB Debugging" enabled, or have an Android Emulator open via Android Studio.

To compile and launch the development version directly on your device:
```bash
npx react-native run-android
```

*(Alternatively, to build a production release APK manually)*:
```bash
npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res
cd android
.\gradlew clean assembleDebug
```
*The output file will be located at: `android/app/build/outputs/apk/debug/app-debug.apk`*

---

## 3. Testing Defaults

If it's a fresh database, use the following credentials:
- **Admin**: `admin123` / `password`
- **Manager**: `TESTMGR` / `password`
- **Employee**: Create a new employee using the Manager dashboard at `http://localhost:5000/manager`.
