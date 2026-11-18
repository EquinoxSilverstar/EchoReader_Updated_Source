# EchoReader — start here (Windows / VS Code)

**This is an updated source-code project, not a preinstalled Android APK.** Your original uploaded ZIP contained an empty `Api.env`, so it did not include the Firebase project settings that are needed for account creation and login. I have not deployed the website, backend or an Android binary.

## 1. Open the project

1. Extract `EchoReader_Cloudflare_Setup.zip` (right-click it, then **Extract All**).
2. Open VS Code -> File -> Open Folder -> choose the extracted **echoreader** folder that contains `package.json`.
3. Make sure Node.js is installed (the existing project recommends Node.js 24).
4. Double-click `INSTALL_AND_START_WINDOWS.bat` in that folder, or open the VS Code Terminal and run:

   ```powershell
   npm install
   npx expo start -c
   ```

Install dependencies before your first build. The project includes a lockfile for reproducible installs with `npm ci`.

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

Follow [Cloudflare voice setup](cloudflare/README.md). The Worker uses your existing Firebase sign-in and can run on Cloudflare Workers Free. Add the provider credentials to Cloudflare, then set the deployed Worker URL in EchoReader.

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
- See [Cloudflare voice setup](cloudflare/README.md) for current Worker verification and deployment instructions.
- **Not verified**: a standalone Android app, Firebase login with your real configuration, paid cloud voice synthesis, native splash display, or the automated browser interaction test (Playwright Chromium browser was unavailable here).

To finish, install dependencies, configure Firebase, test on Android and web, then deploy when you are satisfied. **No external changes have been made.**
