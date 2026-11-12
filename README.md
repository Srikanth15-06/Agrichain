# AgriChain

AgriChain is a Node.js/Express marketplace for farmers and buyers. The Express
service serves both the static frontend and the API, so the production app can
be deployed as one Render web service.

## Requirements

- Node.js 20.x or later (up to 24.x)
- MongoDB, locally or through MongoDB Atlas

## Run locally

1. Install dependencies from the repository root:

   ```powershell
   npm ci
   ```

2. Copy `backend/.env.example` to `backend/.env` and set `MONGO_URI` and a
   private `JWT_SECRET` (at least 32 random characters recommended). Keep this
   file out of source control.
3. Start the server:

   ```powershell
   npm run dev
   ```

4. Open `http://localhost:5000`. The server also serves the frontend on the
   same origin. If you run a separate static frontend on port 3000, its API
   calls are routed to port 5000 automatically.

## Render deployment

1. Push the project to a Git provider and create a Render Blueprint from the
   repository using `render.yaml`.
2. Set `MONGO_URI` to a MongoDB Atlas connection string. Configure Atlas
   network access to allow the Render service to connect; avoid broad database
   permissions and restrict network access where practical.
3. Render generates `JWT_SECRET`. Keep it private and do not rotate it casually:
   existing login tokens become invalid when it changes.
4. Configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and
   `CLOUDINARY_API_SECRET` in Render from your Cloudinary dashboard. Do not
   commit or share the API secret. Image uploads return a service-unavailable
   response until these values are configured.
5. Deploy. Render uses `npm ci`, `npm start`, and `/readyz` to verify that the
   service and database are ready.
6. Add optional environment variables in Render only for services you enable:
   `WEATHER_API_KEY` (OpenWeatherMap), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and the
   `SMTP_*` settings. Configure the Stripe webhook URL as
   `https://<your-render-host>/api/payment/webhook`.

New produce images are uploaded directly to Cloudinary, so they persist
independently of Render's filesystem. MongoDB stores each image's secure URL and
Cloudinary public ID. Older records that still use `/uploads/...` need their
image files migrated to Cloudinary before those files are removed from the
local project. Invoice files are still generated on the service filesystem and
should not be treated as permanent records.

## Health and tests

- `GET /healthz` reports that the process is running.
- `GET /readyz` reports readiness only after MongoDB connects.
- Run the deployment smoke tests with `npm test`.

## Optional integrations

- **Image storage:** Cloudinary credentials are required for new produce image
  uploads. The app validates uploads, stores them in the `agrichain/produce`
  folder, and saves the secure URL and public ID in MongoDB.
- **Weather:** set `WEATHER_API_KEY` to an OpenWeatherMap API key. Weather
  requests are proxied by the backend; never put the provider key in frontend
  code. Rotate any key previously exposed in client code or shared publicly.
- **Stripe:** set both Stripe keys and configure the webhook endpoint above.
  Payment routes return a clear service-unavailable response until configured.
- **Password reset email:** set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
  `SMTP_PASS`, `SMTP_FROM`, and optionally `SMTP_SECURE=true` for implicit TLS.
  Reset links use `FRONTEND_URL` when set, otherwise the Render service URL or
  the current request origin.
