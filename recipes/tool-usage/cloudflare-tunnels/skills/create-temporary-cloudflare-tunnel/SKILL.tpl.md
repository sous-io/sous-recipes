---
name: create-temporary-cloudflare-tunnel
description: Open a temporary public URL (a Cloudflare quick tunnel) to a local port, and report the link.
argument-hint: "[port or URL] [--allowed-mail <emails>]"
disable-model-invocation: true
---

# Create a Temporary Cloudflare Tunnel

What to tunnel: $ARGUMENTS

If nothing is named above, take the local server the last roughly 10 turns are about (the one most
recently started or mentioned), and name its port in the first line of the reply. If no server is
running and none was mentioned, say so and stop; a tunnel to nothing is no use.

The agent performing this command MUST load `about-cloudflare-tunnels` first and follow "Using a
Tunnel" there; this command adds only what is particular to opening one on request.

1. Run `tunnel start <port>`, passing along any `--allowed-mail` or `--host-header` the user gave.
2. Report the URL, the tunnel's id, the port it forwards to, and who can open it, as in the example
   below.
3. If the check reported a refused host name, fix it as `about-cloudflare-tunnels` says, then load
   the URL again to confirm it answers before reporting success.

Example of the reply:

```text
Port 5173 is open at https://silver-lantern-ocean-trail.trycloudflare.com (tunnel 9c41).
The check got HTTP 200, so the page answers. Anyone with that link can open it; I'll stop the
tunnel when you're done, or run `tunnel stop 9c41` yourself.
```

## Source for this Skill

This skill comes from the `tool-usage/cloudflare-tunnels` recipe, installed by sous from a recipe
repository. It was compiled from a template, so edit the source, never this output file. To
change it, run `sous repo contribute tool-usage/cloudflare-tunnels`.

- Source Path: {{ sousTemplatePath }}
