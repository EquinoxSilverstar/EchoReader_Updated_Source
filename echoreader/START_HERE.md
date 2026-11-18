# EchoReader — start here (Windows / VS Code)

**This is an updated source-code project, not a preinstalled Android APK.** Your original uploaded ZIP contained an empty `Api.env`, so it did not include the Firebase project settings that are needed for account creation and login. I have not deployed the website, backend or an Android binary.

## 1. Open the project

1. Extract `EchoReader_Updated_Source.zip` (right-click it, then **Extract All**).
2. Open VS Code -> File -> Open Folder -> choose the extracted **echoreader** folder that contains `package.json`.
3. Make sure Node.js is installed (the existing project recommends Node.js 24).
4. Double-click `INSTALL_AND_START_WINDOWS.bat` in that folder, or open the VS Code Terminal and run:

   ```powershell
   npm install
   npx expo start -c
   ```

`npm install` is **required** before your first build: this update adds `expo-splash-screen@~58.0.14` to the project's dependency list, but its download and lockfile update could not be performed in this environment because access to the npm registry was unavailable. It must download the package and update `package-lock.json` on your computer. Keep the updated lockfile if you later push the project to GitHub (`npm ci` on GitHub Actions depends on it).

## 2. Set up Firebase to make Sign in / Sign up work

1. Open https://console.firebase.google.com/ and choose your **existing** EchoReader Firebase project (or create one).
2. Under **Project Settings -> Your apps**, select the Web app (`</>`) and copy the `firebaseConfig` values. They are public client identifiers, **not** your private service account key.
3. In **Authentication -> Sign-in method**, enable **Email/Password**. Make sure the Identity Toolkit API has not been disabled and that you have the correct Firebase project.
4. Copy `env.example` to `.env.local` in the **echoreader** folder. Replace the example placeholders with the matching Firebase Web app values. Keep `.env.local` private and never upload credentials or secrets.
5. Restart Expo completely, with `npx expo start -c`.
6. Test: **Create account -> Sign out -> Sign in -> Forgot password**.

A configuration notice is displayed if the Firebase values are missing. There is **no Continue as Guest** option in this version.

For your GitHub Pages website, also set the matching values under GitHub repository **Settings -> Secrets and variables -> Actions -> Variables**, named as in `env.example`. Then rerun the Deploy web demo GitHub Action; the local `.env.local` is not part of the GitHub build.

## 3. Make ElevenLabs / Google narration work

The client already connects to a **secure Firebase Functions** gateway in `functions/`. It does not contain a safe way to run provider keys on GitHub Pages. To activate cloud narration:

1. Deploy and configure the existing Functions backend **only after reviewing Firebase/Firestore and provider billing**.
2. Set the backend Secret Manager variable `TTS_PROVIDER_KEYS` with valid provider API keys; **never** use `EXPO_PUBLIC_` for a private voice-provider key.
3. After deployment, put the public HTTPS **function endpoint** in `.env.local` as `EXPO_PUBLIC_TTS_PROXY_URL`, and in GitHub Actions repository Variables for your website. The endpoint must support `/status`, `/voices`, and `/tts`.
4. Restart/rebuild the app. Voice availability is checked at runtime for signed-in users. A voice provider will remain disabled if the function or credential is unavailable.

Read the original `README.md` for the backend's rate limits and provider deployment instructions. Cloud Functions/Firestore/Google TTS/ElevenLabs may cost money. The backend is **not deployed by this ZIP**.

## 4. See your splash screen

- The placeholder grid was replaced with EchoReader's own logo in `assets/echoreader-splash.png`.
- `app.json` configures an Expo SDK 58 native splash screen via `expo-splash-screen` and uses a black background, plus an in-app branded loading view while Firebase restores the session.
- You must install the package and **rebuild a standalone Android app** to see the full native splash effect. Expo Go often displays its own icon/splash instead.

## 5. What was changed

- Removed guest mode entry, guest login button and the guest-only tab conditions.
- Added password confirmation in registration and made missing Firebase configuration more understandable.
- Added continuous progress feedback: `expo-audio` current-time updates for cloud audio, `expo-speech` boundaries where supported, with an **approximation** when no boundaries are available.
- Seeking within a chunk and pausing/resuming keep a better position than the old chunk-only progress line. Rewind/forward are approximate for device speech, not sample-accurate.
- Added **Save bookmark** and **Go to bookmark** buttons, saved listening position and playback-speed preference using local AsyncStorage. Imported full book contents are **not** persisted between app restarts; you must reimport them. Listening position is restored when the same document is loaded again.
- Used the existing `expo-audio` native playback system, avoiding the old `ExponentAV` module.
- Kept the existing dark/purple/cyan design with a more compact player layout.

## 6. What was tested

- **Passed**: TypeScript compile (`tsc --noEmit -p tsconfig.json`).
- **Passed**: Firebase Functions Node.js unit tests, 11/11.
- **Passed**: Expo web export for the modified app **with the new native splash plugin temporarily disabled**, because that package could not be downloaded in this environment. It is configured in the delivered source for when you install the package.
- **Not verified**: a standalone Android app, Firebase login with your real configuration, paid cloud voice synthesis, native splash display, or the automated browser interaction test (Playwright Chromium browser was unavailable here).

To finish, install dependencies, configure Firebase, test on Android and web, then deploy when you are satisfied. **No external changes have been made.**
