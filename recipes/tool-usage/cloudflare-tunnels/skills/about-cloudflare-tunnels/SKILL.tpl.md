---
name: about-cloudflare-tunnels
description: >
  YOU MUST load this skill when the user wants to open a local server (a dev server, a Storybook,
  a preview) from another machine, a phone or a VM's host, share a temporary public link to a local
  port, or list or stop a Cloudflare quick tunnel, and when running /create-temporary-cloudflare-tunnel.
user-invocable: false
---

# About Cloudflare Tunnels

A **quick tunnel** is a temporary public URL, shaped `https://<random-words>.trycloudflare.com`,
that forwards every request to a port on this machine. Cloudflare provides it free and with no
account: the `cloudflared` program connects out to Cloudflare, so no firewall or router changes are
needed. It is the simplest way for the user to open a local server from somewhere else, for example
a Storybook running in a VM whose browser lacks WebGL, viewed from the VM's host.

Facts that shape every use:

- **Anyone who has the URL can open it**, until the tunnel stops. The address is hard to guess, but
  it is not a secret once sent anywhere. A dev server shows more than the page: Vite and Storybook
  serve the project's source files, and Storybook's websocket can write files in the project.
- **Cloudflare's email login can guard it.** With `--allowed-mail`, a visitor first meets
  Cloudflare's login page and gets through only by proving they own one of the listed email
  addresses. The agent SHOULD offer this whenever the server shows anything private.
- **The URL changes every time** a tunnel starts, and a tunnel keeps running after the session
  ends, until it is stopped or the machine restarts.
- **Limits:** no uptime guarantee, at most 200 requests in flight (more get HTTP 429), and no
  Server-Sent Events. Websockets, and so hot reload, work. Anything long-lived or production-like
  needs a named Cloudflare Tunnel on a Cloudflare account instead, which this skill does not cover.

## The Script

`scripts/tunnel.mjs`, in this skill's folder (the folder this file was loaded from), does all the
work. It needs Node 18 or newer and no packages. The examples below write it as `tunnel`, meaning
`node <this skill's folder>/scripts/tunnel.mjs`.

- `tunnel start <port>` opens a tunnel to that port and prints its id and URL. A full URL works in
  place of the port, such as `https://localhost:8443` for a server with a self-signed certificate.
  It refuses when nothing is listening on the port. It then loads the URL once and reports what
  came back, naming the setting to change when the server refused the tunnel's host name.
  - `--allowed-mail <emails>` puts the email login in front. It takes a comma-separated list of
    email addresses; cloudflared also accepts wildcard domains there.
  - `--host-header <host>` makes the server see that host name instead of the tunnel's, which gets
    past a server's host check without restarting it (see the reference below).
- `tunnel list` prints every running tunnel: id, URL, port, age, and the folder it was started
  from. Tunnels started in other sessions or projects are included.
- `tunnel stop <id | port | all>` stops tunnels.

`cloudflared` is taken from the PATH. When it is not there, the script downloads the release for
this OS and CPU from Cloudflare's GitHub releases into `<sous home>/cloudflare-tunnels/bin/`, once;
the sous home is `SOUS_HOME`, or `~/.sous`. The running tunnels are recorded beside it, in
`<sous home>/cloudflare-tunnels/tunnels/`, with one log file per tunnel.

## Using a Tunnel

1. **Make sure the server is running.** If the agent starts it, it starts it in the background, and
   with the host setting from the reference below already applied when it knows the server.
2. **Decide on the email login.** If the user named who will open the page, or the server shows
   anything private, the agent SHOULD offer `--allowed-mail` with the user's own address.
3. **Start the tunnel** and give the user the URL, saying plainly that it is public (or who the
   email login admits).
4. **Act on the check.** When the script reports that the server refused the host name, the agent
   loads [references/dev-server-hosts.md](references/dev-server-hosts.md) and fixes it in the least
   invasive way: a command-line flag on a server the agent started, or `--host-header localhost`.
   The agent MUST NOT edit the project's committed dev server config to allow the tunnel without
   the user's agreement, because that config is shared with everyone on the project.
5. **Stop the tunnel** when the user is done with it. Before the session ends, the agent runs
   `tunnel list` and reminds the user of any tunnel it started that is still running.

Example of the report to the user:

```text
Storybook is reachable from anywhere at https://river-candle-orbit-plain.trycloudflare.com
(tunnel 3f2a, forwarding to port 6006). Anyone with that link can open it, so I'll stop it when
you're done; say the word, or run `/create-temporary-cloudflare-tunnel` again for a new one.
```

## Reference Files

- [dev-server-hosts.md](references/dev-server-hosts.md): servers that refuse an unknown host name
  (Storybook, Vite, webpack-dev-server, Next.js), the fix for each, and hot reload through a tunnel

The official documentation for quick tunnels:
https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/

## Source for this Skill

This skill comes from the `tool-usage/cloudflare-tunnels` recipe, installed by sous from a recipe
repository. It was compiled from a template, so edit the source, never this output file. To
change it, run `sous repo contribute tool-usage/cloudflare-tunnels`.

- Source Path: {{ sousTemplatePath }}
