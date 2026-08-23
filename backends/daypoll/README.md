# Daypoll Worker

This is a minimal Cloudflare Worker API backed by Cloudflare D1. It exposes:

- `POST /api/votes` with `{ "poll", "name", "votes" }`
- `GET /api/results?poll=...`

## Set up

1. Log in and create the D1 database:

   ```sh
   npx wrangler login
   npx wrangler@latest d1 create daypoll
   ```

2. Put the returned database ID in `wrangler.toml`.
3. Optionally replace `ALLOWED_ORIGIN = "*"` with the page's origin, such as
   `https://vinhill.github.io`.
4. Apply the migration to the remote database:

   ```sh
   npx wrangler d1 migrations apply DB --remote
   ```

5. Deploy from this directory:

   ```sh
   npx wrangler deploy
   ```

6. Put the deployed URL in the `daypoll-api-url` meta tag in
   `../../public/daypoll/index.html`.

Until that meta tag is configured (or whenever the Worker cannot be reached),
the page retains its original URL/code sharing behavior and only writes a warning
to the browser console.
