# EchoReader cloud voices on Cloudflare

The Worker accepts Firebase ID tokens from the existing EchoReader project, `echo-reader-39cec`. Keep that project on Spark. The Worker uses a SQLite Durable Object for usage limits and can run on Cloudflare Workers Free. ElevenLabs and Google Cloud TTS have separate provider quotas and billing.

## Deploy the Worker

From the extracted project folder, open a terminal and run these commands using Node.js 24.

```powershell
cd cloudflare
npm ci
npx wrangler login
npx wrangler whoami
npm run deploy
```

Choose the Cloudflare account that should own `echoreader-voices`. If prompted, set up the account's free `workers.dev` subdomain. Save the exact HTTPS URL printed by Wrangler. Open that URL followed by `/health`. The expected response has `"ready":true`. Visiting `/status` without signing in should return HTTP 401.

## Add provider credentials in Cloudflare

Open **Workers & Pages → echoreader-voices → Settings → Variables and Secrets**. Add each value as a **Secret**.

| Secret | Value |
| --- | --- |
| `ELEVENLABS_API_KEY` | An ElevenLabs API key with permission to list voices and generate speech. Set a provider credit limit where available. |
| `GOOGLE_TTS_SERVICE_ACCOUNT` | The complete JSON credentials for a dedicated service account in a separate Google Cloud project with billing and the Cloud Text-to-Speech API enabled. Give the account only the access needed by that project to use Text-to-Speech. |

You can configure either provider first. For Google, use a separate project with its own quotas and never link billing to the EchoReader Firebase project. For each provider, set quota and cost controls in its own dashboard before activating it. Keep these values out of GitHub, Expo configuration, and chat. Provider status reflects whether the secret is present. A voice listing and an audio preview are the live checks for a valid secret and usable quota.

The Worker permits the existing GitHub Pages origin, `https://equinoxsilverstar.github.io`, and local web development at `http://localhost:8081` or `http://127.0.0.1:8081`. Android sends requests without an Origin header. The Worker requires a signed-in Firebase account for voice routes. It checks token signature, issuer, project, expiration and authentication claims. Already-issued tokens can remain valid until they expire after account disablement or revocation.

Cloud voice requests are limited to 10 per minute and 100 per UTC day per user, and 250 requests and 25,000 submitted text characters per UTC day across the Worker. Both voice listing and synthesis count toward request limits. The shared limit is intended for initial testing. Provider costs depend on the API plan and selected voice.

## Connect EchoReader

1. In the app project's `.env.local`, set `EXPO_PUBLIC_TTS_PROXY_URL` to the Worker URL without a route suffix. Keep the four Firebase web settings already used by the app. Run `npx expo start -c` from the project folder.
2. Sign in to EchoReader. Open Narrators, load each configured provider's voices, and play a short preview. Check device narration separately.
3. When you're ready to update the public site, set `EXPO_PUBLIC_TTS_PROXY_URL` in GitHub under **Settings → Secrets and variables → Actions → Variables** and run the **Deploy web demo** workflow on a branch containing the updated app source. The existing workflow reads this variable when building the site.
4. Rebuild Android with the same public URL in the build environment if you distribute an installed Android build.

## Verify locally

Run `npm test` inside `cloudflare` for signed-token, CORS, provider and limit tests. These tests mock the provider services and require Node.js 24 and OpenSSL. Run `npm run deploy -- --dry-run` to verify that Wrangler can bundle the Worker and read its binding configuration.
