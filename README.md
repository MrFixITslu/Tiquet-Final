<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/3ec87ae8-ef3b-4251-96bd-3c0d7059d2a9

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Production deployment behind Nginx Proxy Manager

This app is designed to run as a single Node container that serves both the API and the built React frontend. In production, keep the container private and make Nginx Proxy Manager (NPM) the only public entry point.

### Required environment

Create a `.env` file next to `docker-compose.yml`:

```bash
JWT_SECRET=<generate-with-node-crypto-randomBytes-48-hex>
ALLOW_PUBLIC_REGISTRATION=false
```

Generate the secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

`ALLOW_PUBLIC_REGISTRATION=false` is recommended for a private business deployment. Temporarily set it to `true` only when intentionally creating the first account, or add an admin/invite flow before opening registration.

### Nginx Proxy Manager settings

If NPM is installed on the host, the included compose file binds the app to `127.0.0.1:8080`, so configure the NPM Proxy Host as:

- Scheme: `http`
- Forward hostname/IP: `127.0.0.1`
- Forward port: `8080`
- Enable SSL certificate
- Enable Force SSL
- Enable HTTP/2 if available
- Set a suitable max upload/body size if users upload large files

If NPM runs as a Docker container, remove the `ports` mapping from this app, attach both containers to the same Docker network, and proxy to:

- Scheme: `http`
- Forward hostname: `v79-tiquet-manager`
- Forward port: `8080`

Ensure NPM forwards these headers: `Host`, `X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto`. `NODE_ENV=production` and HTTPS are required so session cookies are sent with the `Secure` attribute.
