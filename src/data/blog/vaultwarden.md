---
title: "Self-hosting Vaultwarden: my passwords on my hardware"
author: Josh Forrest
pubDatetime: 2026-04-10T23:50:00Z
slug: vaultwarden
featured: false
draft: false
tags:
  - homelab
  - vaultwarden
  - bitwarden
  - security
  - self-hosting
description: "Why I moved my password manager off the cloud and onto my own hardware, how Vaultwarden is set up, and the security trade-offs of self-hosting the most sensitive thing you own."
---

## Table of contents

## Why self-host this, of all things

A password manager is the single most sensitive piece of software in most people's lives. It's the one thing that, if it gets compromised, *every other account you own* gets compromised at the same time. It's also, for that exact reason, the thing most people are nervous about self-hosting - and rightly so. Getting it wrong is much worse than getting your photo gallery wrong.

So why do it?

For me, it came down to two things:

1. **Trust.** Cloud password managers have a pretty strong track record of being well-engineered, but the last few years have shown that even the best of them get breached eventually. When that happens, every customer's encrypted vault is in the hands of whoever did the breaching, and the only thing standing between them and your passwords is the strength of your master password. If I'm trusting *something*, I'd rather trust a server I can see and control.
2. **Cost.** Mostly a side benefit, but Bitwarden's premium tier is a few quid a month, and Vaultwarden gives you the equivalent feature set for free. Over years, that adds up.

The thing that makes this realistic is [Vaultwarden](https://github.com/dani-garcia/vaultwarden) - an open-source, drop-in compatible reimplementation of the Bitwarden server, written in Rust, that runs comfortably in a tiny LXC container. It speaks the same API as the real Bitwarden server, which means all the official Bitwarden client apps - browser extensions, mobile apps, desktop apps - work with it unmodified. You're not running a janky alternative client, you're running the real Bitwarden clients against your own server.

## Where it runs

Vaultwarden lives in an LXC container on `proxmox2` at `10.10.20.16`, listening on port 8000, sitting on the container VLAN like the rest of my services. It's a small, single-purpose container - Vaultwarden itself, a SQLite database for the vault, and that's it. Resource usage is essentially zero; it idles below 1% CPU and uses a few hundred MB of RAM.

The data that actually matters - the vault itself - is encrypted at rest using a key derived from my master password, the same way Bitwarden's official server stores it. Even if someone got root on the LXC and copied the database file, they'd still need my master password to decrypt anything inside it. That's the layer of security that makes self-hosting a password manager defensible: the server stores ciphertext, not plaintext, and the decryption key never leaves the client devices.

## How it's exposed

Vaultwarden has to be reachable from outside my home network. The whole point of a password manager is that it works on every device, everywhere - phone, laptop, in the office, on holiday - and a password manager that only works on my home Wi-Fi would be useless.

I expose it via a [Cloudflare Tunnel](https://www.cloudflare.com/en-gb/products/tunnel/) at `vault.jtforrest.com`. A dedicated LXC container (`cloudflared`, CT 105) maintains a persistent outbound connection to Cloudflare's edge - no inbound ports, no VPS required. From the outside, the flow is:

1. Browser extension or mobile app connects to `vault.jtforrest.com`
2. Cloudflare terminates TLS, sits in front as a layer of protection (rate limiting, basic WAF, the lot)
3. Cloudflare routes the request down the tunnel into my homelab
4. The tunnel exits at the Vaultwarden LXC at `10.10.20.16:8000`
5. Vaultwarden responds back the same way

There is **no inbound port open on my home router**. My home IP is never exposed. If someone wanted to attack the Vaultwarden instance directly, they'd have to first get past Cloudflare's edge, which is meaningfully harder than scanning a residential IP range for open ports.

I use a Cloudflare Tunnel here specifically - rather than the edge VPS approach I use for Immich and Plex - because Vaultwarden's traffic is low-bandwidth API calls and sync operations. There's no file upload concern, so the Cloudflare free plan works perfectly and removes the need to manage another piece of infrastructure.

If Cloudflare goes down, the worst-case scenario is that I temporarily can't reach my passwords from outside my house - annoying, but not catastrophic, because the Bitwarden clients cache the vault locally and continue to work offline.

## The security thinking

This is the bit that matters most, and it's the bit that took the most thought before I committed to running this.

The threat model for self-hosting a password manager is genuinely different from self-hosting most other services. With photos or media, the worst case is "someone gets my files," which is bad but bounded. With passwords, the worst case is "someone gets a foothold into every other account I own," which is unbounded and catastrophic. So the security thinking has to be tighter.

A few things I do (or rely on) specifically because it's Vaultwarden:

- **A genuinely strong master password.** Long, random, unique, never used anywhere else. This is the layer that protects me even if everything else fails - if the database is dumped, the master password is the only thing standing between an attacker and my vault.
- **2FA on the Vaultwarden account itself**, using a TOTP app - meaning even if someone somehow had my master password, they'd still need a code from a separate device to log in.
- **Cloudflare in front.** Means I'm not directly exposing the Vaultwarden process to the open internet; I'm exposing it through a layer that has its own DDoS protection and basic attack filtering.
- **The container is on a separated VLAN**, so even if it were somehow compromised, it's not on the same network as my Proxmox hosts.
- **Backups, eventually.** This is the same honest gap I have with [Immich](/posts/immich/) - right now the vault exists in one place, and losing the LXC would mean losing access (though I'd still have the cached copies on every client device, so it's a slow-motion problem rather than instant). Sorting this out is on the list, and for Vaultwarden specifically it'll be a higher priority than for some other services.

The honest summary: self-hosting Vaultwarden is *defensible* if you take the security side seriously, but it's *not* the right choice for everyone. If you're not going to put thought into the master password, the 2FA, the backups, and the network exposure, you're better off with a hosted Bitwarden or 1Password subscription. The convenience of a managed service is worth it if the alternative is doing self-hosting badly.

## What I learned

- **The Bitwarden client apps are excellent and are 90% of the experience.** Vaultwarden is the boring server bit. The thing you actually use every day is the browser extension, the mobile app, and the autofill, and all of that is just Bitwarden. Self-hosting changes nothing about the day-to-day usage experience.
- **The migration from a previous password manager is the hardest part of any password manager move.** Not specific to Vaultwarden - it'd be the same moving to any Bitwarden-compatible setup. The Bitwarden CLI and its CSV import tools handle most of it well, but expect to spend a couple of evenings cleaning up duplicates and updating old entries.
- **2FA codes inside Vaultwarden are convenient but a trade-off.** Vaultwarden can store TOTP codes alongside the password they go with, which is great for ergonomics - you autofill the password and the 2FA code in one click. But it does mean that if your vault is compromised, both factors are compromised together. For my most sensitive accounts (email, banking) I keep the 2FA codes in a separate authenticator app on my phone, not in Vaultwarden. For everything else, the convenience wins.
- **Backups for this need to be the best ones.** See above. I'm not pretending I have this fully sorted yet.

## What's next

- **Backups.** Top of the list. The vault is the most irreplaceable data on my homelab after photos, and right now there's no offsite copy. This needs to be sorted before I add anything else.
- **Possibly Vaultwarden's Send feature.** Vaultwarden supports Bitwarden Send - a way to share encrypted text or files with a one-time link and an expiry. I haven't enabled it yet, but it's a nice "encrypted WeTransfer for short messages" thing that I could see myself using.
- **Properly auditing my vault.** Any password manager that's been in use for years accumulates cruft - old accounts, weak passwords from before I got serious about it, duplicates. Vaultwarden has a built-in vault health report that surfaces all of this; I just need to actually go through it.

If you're thinking about self-hosting your password manager: do it, but do it carefully. It's the service where it's most worth it to slow down and think about security from the start.
