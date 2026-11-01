# Host settings behind the launch checks

Where each host keeps the settings that `launch_dev_build`, `launch_soft_404`, `launch_https_redirect`, `launch_www_consistency` and the site-URL problems depend on. Change them in the host's dashboard or config file, deploy, then run the gate against the deployed URL.

## Vercel

- **Build and start**: detected per framework. A custom "Development Command" is only for `vercel dev`; never put `next dev` in the build or start settings.
- **Environment variables**: set the site URL for Production (and Preview, if previews should build). System variables: `VERCEL_ENV`, `VERCEL_URL` (this deployment's own host), `VERCEL_BRANCH_URL`, `VERCEL_PROJECT_PRODUCTION_URL` (the production domain, without `https://`).
- **404s**: Next.js handles them. Static output: a `404.html` in the output is served with status 404. A catch-all in `vercel.json` (`"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]`) makes every unknown URL a 200; narrow it or prerender the routes.
- **HTTPS**: automatic. **www and apex**: add both domains under Domains and set one to redirect to the other.
- **Previews**: Deployment Protection answers checkers and platform fetchers with 401. Run the gate on production, or on the local production build.

## Netlify

- **Build**: `command` and `publish` in `netlify.toml`.
- **Environment**: `URL` is the production URL; `DEPLOY_URL` and `DEPLOY_PRIME_URL` name the deploy; `CONTEXT` is `production`, `deploy-preview` or `branch-deploy`.
- **404s**: a `404.html` in the publish folder is served with status 404 when nothing else matches. The SPA rule `/* /index.html 200` in `_redirects` turns every unknown URL into a 200.
- **HTTPS**: certificates are automatic and http redirects to https. **www and apex**: set the primary domain; domain aliases redirect to it.

## Cloudflare Pages and Workers static assets

- **404s**: Pages treats a project without a top-level `404.html` as a single-page app and answers unknown paths with `index.html` and status 200. Add `404.html` to the output. Workers static assets: set `assets.not_found_handling` to `"404-page"` in the Wrangler config instead of `"single-page-application"`.
- **HTTPS**: SSL/TLS > Edge Certificates > Always Use HTTPS. **www and apex**: a Redirect Rule from one host to the other (Rules > Redirect Rules).
- **Environment**: Pages sets `CF_PAGES_URL` to the deployment's own URL; use your own production site URL variable for links.
- `_headers` and `_redirects` files in the output folder set headers and redirects.

## GitHub Pages

- **404s**: a `404.html` at the root is served with status 404.
- **HTTPS**: Settings > Pages > Enforce HTTPS. **www and apex**: set the custom domain to one of them and configure DNS for both; GitHub Pages redirects the other.
- No custom headers or server redirects: source maps you do not want public must be left out of the published folder.

## Docker and virtual servers

- **Start the production build**: the final image runs the build output, never the dev server:
  ```dockerfile
  FROM node:22-alpine AS build
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  RUN npm run build

  FROM node:22-alpine
  WORKDIR /app
  ENV NODE_ENV=production
  COPY --from=build /app ./
  CMD ["npm", "run", "start"]
  ```
  Check PM2 (`pm2 start npm --name site -- run start`) and systemd units (`ExecStart=/usr/bin/npm run start`) the same way. Build-time variables such as `NEXT_PUBLIC_SITE_URL` and `VITE_*` must be present during `npm run build`, so pass them as build arguments, not only at run time.
- **nginx in front**: redirect http and the second host name, then proxy the canonical host:
  ```nginx
  server {
    listen 80;
    server_name example.com www.example.com;
    return 301 https://www.example.com$request_uri;
  }
  server {
    listen 443 ssl;
    server_name example.com;
    # ssl_certificate and ssl_certificate_key as for www below
    return 301 https://www.example.com$request_uri;
  }
  server {
    listen 443 ssl;
    server_name www.example.com;
    # ssl_certificate /etc/letsencrypt/live/www.example.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/www.example.com/privkey.pem;
    location / {
      proxy_pass http://127.0.0.1:3000;
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-Proto $scheme;
    }
  }
  ```
- **Apache**: `RewriteEngine On`, `RewriteCond %{HTTPS} off`, `RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]`, plus a second rule for the host name you do not use.

## Render, Railway and Fly.io

- Set the start command to the production start (`npm run start`), never `npm run dev`.
- HTTPS is automatic on all three; on Fly.io keep `force_https = true` under `[http_service]` in `fly.toml`.
- Static sites on Render: rewrite rules in the dashboard can create the same catch-all 200 as a SPA rule.

## WordPress hosts

- Settings > General: both addresses on the production `https://` host. Settings > Reading: "Discourage search engines" off.
- HTTPS and www redirects: the host's dashboard, or the nginx or Apache rules above.
- Plugins that redirect every 404 to the homepage cause `launch_soft_404`; remove them.
