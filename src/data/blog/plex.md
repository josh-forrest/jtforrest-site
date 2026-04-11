---
title: "Self-hosting Plex: media at home, exposed via a VPS"
author: Josh Forrest
pubDatetime: 2026-04-10T23:55:00Z
slug: plex
featured: false
draft: false
tags:
  - homelab
  - plex
  - media
  - self-hosting
description: "How I run Plex on my Proxmox homelab - installed via community scripts, exposed remotely through a VPS reverse proxy over WireGuard, and shared with family."
---

## Table of contents

## Why Plex

Plex is the part of my [homelab](/posts/homelab/) that actually justifies it to people who don't care about homelabs. Photos, password managers, DNS - these are all things that produce a *technically improved* version of something most people are perfectly happy with from a hosted service. Plex is different. Plex is "all of our films and shows, in one app, on every screen in the house, for free, forever, with no ads and no random catalogue removals."

That's a thing people understand without me having to explain VLANs first.

## Where it runs

Plex runs in an LXC container on `proxmox2` - my Dell OptiPlex 3060 - at `10.10.20.26`. I installed it using the [Proxmox community helper scripts](https://community-scripts.github.io/ProxmoxVE/), which handle the bare-metal install and systemd service setup in a single command. No Docker, no Compose file - it runs directly in the container as a native service.

The media lives on a 6TB USB hard drive plugged directly into `proxmox2`, mounted at `/mnt/plex` on the host and bind-mounted into the Plex LXC. This means the container reads media files directly from the disk without any networked storage protocol in the middle - fast, simple, and no dependency on the other node. The drive came pre-loaded with an existing library, so from Plex's perspective it was just a case of adding `/mnt/plex/Movies` and `/mnt/plex/Series` as library folders and letting the scanner do its thing.

## Automated downloads

Plex doesn't work in isolation - it's the front end for a broader automated media stack running in a separate Docker Compose LXC on the same node. The stack is:

- **Prowlarr** - manages indexers for finding content
- **Radarr** - automates movie acquisition
- **Sonarr** - automates TV show acquisition
- **RDT-Client** - acts as a fake qBittorrent client but routes everything through Real-Debrid, meaning torrents are downloaded on Real-Debrid's servers and served back to me over HTTPS at full speed
- **Seerr** - a request portal where I (or family) can search for something and kick off the whole chain

The entire stack routes outbound through a Mullvad WireGuard VPN connection via Gluetun, so indexer traffic and download requests all exit through a London VPN endpoint rather than my home IP.

When something is requested in Seerr, the flow is: Seerr → Radarr or Sonarr → Prowlarr finds a torrent → RDT-Client sends the magnet to Real-Debrid → Real-Debrid downloads it on their end → the completed file is pulled down via HTTPS to `/mnt/plex/downloads` → Radarr or Sonarr moves it to the library → Plex picks it up automatically.

## How it's exposed remotely

Plex has its own built-in remote access feature, which works by punching a hole through your home router and exposing the server directly to the public internet. I don't use it.

Two reasons. First, I don't like opening inbound ports on my home router - every public-facing service is one more thing that has to be patched, monitored, and trusted. Second, I have no static home IP, so relying on Plex's relay or direct port forwarding introduces unnecessary fragility.

Instead, Plex is reachable through my VPS reverse-proxy setup. The flow:

1. A client connects to `plex.jtforrest.com`
2. DNS resolves to my IONOS VPS at `88.208.242.212`
3. Nginx on the VPS terminates TLS and proxies the request down a WireGuard tunnel into my homelab
4. The tunnel exits at a dedicated WireGuard LXC which forwards traffic to the Plex container at `10.10.20.26:32400`
5. Plex responds back the same way

The WireGuard tunnel is locked down at the iptables level - the only traffic allowed through is TCP on port 32400 destined for the Plex LXC. Everything else on the homelab network is unreachable from the VPS. My home IP is never exposed, no inbound ports are open on my router, and if the VPS were ever compromised the blast radius is one Ubuntu machine, not the whole homelab.

Plex's built-in remote access is disabled. The custom server URL is set to `https://plex.jtforrest.com`, which tells Plex clients where to find the server without going through Plex's relay infrastructure.

## Who uses it

Plex isn't just mine - my family use it too, on phones, on the TV, on tablets, all pointing at the same server. This is the part of the homelab that gets used the most by the most people, and the thing that means it has to be *reliable* in a way that some of my other services don't. If Immich is down for an hour while I'm tinkering, I'm the only person who notices. If Plex is down on a Friday evening, everyone notices.

This is one of the reasons I think carefully before touching the Plex container - it's the closest thing my homelab has to a production service.

## What I learned

- **Community scripts make this genuinely easy.** The Proxmox community helper scripts handle the bare-metal install, systemd service, and all the dependencies in one shot. It's a much cleaner setup than running Plex in Docker if you're already on Proxmox.
- **Don't expose Plex directly.** The built-in remote access works, but routing through a reverse proxy of your own is a much better security posture and only takes an evening to set up properly.
- **A WireGuard tunnel beats a Cloudflare tunnel for media.** Cloudflare's free plan has a 100MB upload limit which makes it useless for Immich and painful for Plex. A cheap VPS with Nginx and WireGuard has no such limitation.
- **Plex Pass is worth it for serious use.** Hardware transcoding, offline sync, and the full remote access feature set all require Plex Pass. Given how much use the server gets, the lifetime purchase has already paid for itself.
- **Reliability matters more once other people use it.** A homelab service that only you use is a hobby. A homelab service that your family uses is something you have to keep working - and that pressure has been good for the rest of the setup, because it forces me to be more careful.

## What's next

- **Hardware-accelerated transcoding.** Both my proxmox nodes have Intel i5-8500T CPUs with UHD 630 iGPUs. Passing the GPU into the Plex LXC and enabling Intel Quick Sync would let Plex transcode 4K streams at near-zero CPU cost. The device passthrough is straightforward on Proxmox but I haven't done it yet - it's the highest priority improvement to the Plex setup.
- **Better library organisation.** My library has grown faster than my willingness to keep it tidy. There's stuff in there with broken metadata, missing artwork, and inconsistent naming. A weekend cleanup is overdue.
- **Backing up the Plex metadata database.** If the Plex LXC died tomorrow I could rebuild it, but I'd lose watch history, custom posters, collections, and the muscle memory of where everything is. The media files are easy to back up; the database that turns them into a usable library is the bit I haven't given enough thought to.

If you have a homelab and you're not running Plex, this is probably the second thing I'd add after [AdGuard Home](/posts/adguard/). It's the one your family will actually thank you for.
