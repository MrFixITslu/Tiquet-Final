# V79 TIQUET Manager

A production-ready job, client, file, payroll, invoice, and business management app that runs as a single Node/React container behind Nginx Proxy Manager.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Create a local environment file from `.env.example` and set the required values.
3. Run the frontend and API together:
   `npm run dev:all`

## Production deployment behind Nginx Proxy Manager

This app is designed to run as a single Node container that serves both the API and the built React frontend. In production, keep the container private and make Nginx Proxy Manager (NPM) the only public entry point.

### Required environment

Create a `.env` file next to `docker-compose.yml`:

```bash
JWT_SECRET=<generate-with-node-crypto-randomBytes-48-hex>
ALLOW_PUBLIC_REGISTRATION=false
HOST_BIND_IP=127.0.0.1
HOST_PORT=18080
```

Generate the secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

`ALLOW_PUBLIC_REGISTRATION=false` is recommended for a private business deployment. Temporarily set it to `true` only when intentionally creating the first account, or add an admin/invite flow before opening registration.

### Nginx Proxy Manager settings

If NPM is installed on the host, the included compose file binds the app to `${HOST_BIND_IP:-127.0.0.1}:${HOST_PORT:-18080}`. This avoids the common `127.0.0.1:8080` conflict with other services. Configure the NPM Proxy Host as:

- Scheme: `http`
- Forward hostname/IP: `127.0.0.1`
- Forward port: `18080` by default, or the value you set for `HOST_PORT`
- Enable SSL certificate
- Enable Force SSL
- Enable HTTP/2 if available
- Set a suitable max upload/body size if users upload large files

If that port is already allocated, change `HOST_PORT` in `.env` and recreate the container. If NPM runs as a Docker container, remove the `ports` mapping from this app, attach both containers to the same Docker network, and proxy to:

- Scheme: `http`
- Forward hostname: `v79-tiquet-manager`
- Forward port: `8080`

Ensure NPM forwards these headers: `Host`, `X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto`. `NODE_ENV=production` and HTTPS are required so session cookies are sent with the `Secure` attribute.
