# EchoReader

## Web demo

The **Deploy web demo** workflow builds the app into `dist` and publishes it to GitHub Pages on pushes to `master`. You can also start it manually from the **Actions** tab.

In the repository settings, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**. When the workflow succeeds, open [the EchoReader web demo](https://equinoxsilverstar.github.io/echoreader/).

To build locally, use Node.js 24 and run `npm ci` followed by `npm run build:web`. The static site is exported to `dist` with the GitHub Pages base path `/echoreader`, configured in `app.json`.

Run backend tests with `npm test`. For browser checks, build the web export, install Chromium once with `npx playwright install chromium`, then run `npm run test:e2e`.

See **[START_HERE.md](START_HERE.md)** for setup, limitations and the current repair status.

The library is for your own books. Import EPUB, TXT, or Markdown (`.md`) files from your device, then open a book from your shelf to listen or read it. Imported books and reading position remain in memory for the current session.

Device narration uses the voices installed on the user's device or browser; the reader now requires a signed-in account. Device voices do not require paid TTS provider credentials. ElevenLabs and Google narration use an authenticated Cloudflare Worker. Set `EXPO_PUBLIC_TTS_PROXY_URL` to its public HTTPS URL to enable cloud voices.

### Optional cloud narration backend

Follow [Cloudflare voice setup](cloudflare/README.md) to deploy the Worker and configure the voice providers. EchoReader continues to use Firebase Authentication on Spark. The Worker uses the existing TTS routes and keeps provider secrets server-side.

Run `npm start`, `npm run android`, or `npm run ios` to start native development with values from the local `Api.env` file. Use `npm run web` for web development; it does not load `Api.env`.

## Real accounts

1. Create a project in the [Firebase console](https://console.firebase.google.com/) and register a **Web** app in it. Copy the values from its Web app configuration.
2. In **Authentication → Sign-in method**, enable **Email/Password**. Set the minimum password length to 8 under **Authentication → Settings → Password policy** to match the signup form. EchoReader uses Firebase's hosted password reset page. Add an authorized domain if you later configure an OAuth provider or set a custom return URL in account emails.
3. In GitHub, open **Settings → Secrets and variables → Actions → Variables** and create these four repository variables.

   | Repository variable | Firebase web config field |
   | --- | --- |
   | `EXPO_PUBLIC_FIREBASE_API_KEY` | `apiKey` |
   | `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | `projectId` |
   | `EXPO_PUBLIC_FIREBASE_APP_ID` | `appId` |

4. Open **Actions → Deploy web demo → Run workflow** to rebuild the site with those values. Test by creating an account, signing out and back in, and requesting a password reset link.

For local development, put the same four values in `.env.local`. For a local production export, set them in your shell before running `npm run build:web`, which skips loading dotenv files. These are public client configuration values. Keep service-account credentials and voice provider keys out of the client build.

Guest mode has been removed. Firebase web app configuration is required to log in. The new client saves lightweight listening positions, bookmarks, and playback speed on the device. Imported full book contents and the profile picture remain session-only.
