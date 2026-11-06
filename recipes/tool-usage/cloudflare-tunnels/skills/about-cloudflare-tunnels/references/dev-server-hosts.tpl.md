# Dev Servers That Refuse an Unknown Host Name

A dev server often answers only requests addressed to `localhost`. This protects the developer from
"DNS rebinding", where a malicious website tricks the browser into reading the dev server. A
request through a tunnel is addressed to the tunnel's host name (`<random-words>.trycloudflare.com`),
so such a server refuses it, usually with HTTP 403. `tunnel start` recognizes the refusals below and
names the fix.

Every quick tunnel's host name ends in `.trycloudflare.com`, so allowing that suffix once allows
every future tunnel; a server that takes a list usually writes the suffix with a leading dot. Each
fix below needs a restart of the dev server, except the `--host-header` workaround.

## The Fix for Each Server

These were checked against each server itself (Storybook 9, Vite 6, webpack-dev-server 5 and
Next.js 16).

- **Storybook** answers `403 Invalid host`. Either set `core.allowedHosts` in `.storybook/main.ts`
  (or `main.js`), or start Storybook with `--host 0.0.0.0`. With `--host 0.0.0.0` and no
  `allowedHosts`, it accepts every host, and it also listens on every network interface, so anyone
  on the local network can open it too. `allowedHosts: true` turns the check off entirely.

  ```ts
  // .storybook/main.ts
  const config = {
    // ...
    core: {
      allowedHosts: ['.trycloudflare.com'],
    },
  };
  ```

- **Vite** answers `403 Blocked request. This host ("...") is not allowed.` Set
  `server.allowedHosts`; `true` turns the check off. A framework built on Vite (SvelteKit, Astro,
  Nuxt, Angular 17 and later) passes the same setting through its own config.

  ```js
  // vite.config.js
  export default {
    server: {
      allowedHosts: ['.trycloudflare.com'],
    },
  };
  ```

- **webpack-dev-server** (also inside Create React App, Vue CLI and the Angular CLI before 17)
  answers `Invalid Host header`. Set `devServer.allowedHosts` to `['.trycloudflare.com']` or `'all'`,
  or pass `--allowed-hosts all`. Create React App reads `DANGEROUSLY_DISABLE_HOST_CHECK=true` from
  the environment instead.

- **Next.js** serves the page to any host, but in development it refuses its own scripts' live
  connections (`/_next/...`, including hot reload) from an origin it does not know, and logs
  `Blocked cross-origin request to Next.js dev resource`. The page loads, then never updates and
  may stay half-working. Add the tunnel to `allowedDevOrigins`:

  ```js
  // next.config.js
  module.exports = {
    allowedDevOrigins: ['*.trycloudflare.com'],
  };
  ```

A server not listed here that refuses with a message about the host has the same kind of check,
usually under a setting named like `allowedHosts`.

## Without Touching the Server

`tunnel start <port> --host-header localhost` makes cloudflared rewrite every request's `Host`
header to `localhost` before it reaches the server, so the host check passes with no restart and no
config change. It was tested against Vite 6, including its hot-reload websocket.

It does not help a server that also checks the `Origin` header the browser sends on a websocket,
because that header still names the tunnel: Next.js refuses hot reload this way, and
webpack-dev-server can too. For those, use the server's own setting above.

Either way, allowing the tunnel lets anyone with the URL reach everything the dev server serves,
which is more than the page: see "Facts that shape every use" in `about-cloudflare-tunnels`.

## Hot Reload Through a Tunnel

Hot reload runs over a websocket from the page back to the server, and quick tunnels carry
websockets. A page that loads but never updates is almost always a refused websocket: look at the
browser console, or at the dev server's own output, for a refusal naming the host or the origin.

Two other causes, both rarer:

- The server tells the page an explicit websocket address (Vite's `server.hmr.host` or
  `server.hmr.clientPort`, webpack-dev-server's `client.webSocketURL`). Remove it, or point it at
  the tunnel's host name and port 443.
- The page was opened over plain `http`. Quick tunnels are `https` only, and the page then needs
  `wss`, which every current dev server picks on its own.
