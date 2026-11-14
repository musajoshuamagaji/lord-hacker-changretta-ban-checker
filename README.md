# LORD HACKER CHANGRETTA — LORD OF BUGS BAN CHECKER

Vercel-ready web application with:
- Single-number check
- Bulk-number check
- Appeal status lookup
- Explicitly confirmed single appeal submission (live environment only)
- Rate-limit header display for check and bulk responses
- Session-only history and CSV export
- Mobile-responsive dark dashboard

No developer credit is displayed in the UI.

## Important provider configuration

The API documentation supplied so far includes endpoint paths and response shapes, but not the provider's actual base URL. The project therefore uses a configurable `BANCHECK_API_URL`; it does not guess a provider domain.

The backend calls:
- `POST {BANCHECK_API_URL}/api/v2/check`
- `POST {BANCHECK_API_URL}/api/v2/bulk-check`
- `GET {BANCHECK_API_URL}/api/v2/appeal-status?phone=...`
- `POST {BANCHECK_API_URL}/api/v2/appeal-submit`

It sends `Authorization: Bearer <BANCHECK_API_KEY>` and an `X-BanCheck-Environment` header (`sandbox` or `live`). Confirm with your API provider that this matches their authentication and environment-selection requirements. If their sandbox/live selection is controlled by separate API keys or a different header, update `api/_config.js` to match their official documentation before deployment.

## Deploy to Vercel

1. Extract this ZIP.
2. Create a new GitHub repository and upload all project files, preserving the `api` folder.
3. Import that repository into Vercel.
4. In Vercel → Project → Settings → Environment Variables, add:

   - `BANCHECK_API_URL` = provider origin only, e.g. `https://api.your-provider.example` (replace with the real provider domain; do not append `/api/v2/check`)
   - `BANCHECK_API_KEY` = your private API key
   - `BANCHECK_ENV` = `sandbox` for testing, or `live` only when ready
   - `BANCHECK_BULK_MAX` = your plan's exact `bulkMax` value

5. Redeploy after adding/changing environment variables.
6. Test single and bulk checks in sandbox first. Sandbox results are mocked and are not live WhatsApp account status.
7. Keep `BANCHECK_ENV=sandbox` until you have verified the provider URL, credentials, request format and API behavior. Appeal submission is blocked by this app in sandbox and requires an explicit browser confirmation in live mode.

## Security notes

- Never put the API key in `site.js`, HTML, GitHub, or any public environment variable.
- Do not commit `.env` files.
- Only check numbers you have a legitimate reason to check. Results are provider responses, not a guarantee of WhatsApp account state.
- Appeal submission contacts the provider's live service. Submit only truthful appeals for accounts you own or are authorized to represent.
- Bulk maximum is configured from your plan. Set `BANCHECK_BULK_MAX` to the provider's documented value; this project defaults to 10 until configured.
- The app does not persist check history on a server. History is in memory for the current browser session only.

## Local preview

Requires Node.js 18+ and Vercel CLI:
```bash
npm install -g vercel
vercel dev
```
Create a local `.env` file from `.env.example` and fill in the real values. Do not commit `.env`.

