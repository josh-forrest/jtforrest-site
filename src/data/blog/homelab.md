---
title: "Building a two-node Proxmox homelab"
author: Josh Forrest
pubDatetime: 2026-04-10T22:17:18.524Z
slug: homelab
featured: true
draft: false
tags:
  - homelab
  - proxmox
  - linux
  - networking
  - self-hosting
description: "How and why I built a two-node Proxmox cluster at home, what it runs, what I learned, and what's next."
---

## Table of contents

## Why I built it

I didn't set out to learn Linux systems administration, networking, or infrastructure security. I set out to stop paying monthly for things I thought I could run myself: photo backup, a password manager, a bit of ad-blocking. One Proxmox install later, I had a homelab, and things got away from me in the best possible way.

This post is a write-up of what I've built: the hardware, the network, the services, and (most importantly) what I've actually learned from it.

## The hardware

The cluster runs on two small form-factor office PCs, both with Intel i5-8500T 6-core CPUs and around 15.5GB of RAM:

- **proxmox1** - HP ProDesk 400 G4 DM with a 500GB NVMe boot drive and a 1TB HDD for media storage
- **proxmox2** - Dell OptiPlex 3060 with a 500GB NVMe boot drive and a 6TB USB HDD for the Plex media library

Both machines have Intel UHD 630 integrated graphics, which I pass through into LXC containers where needed - currently used by the AI Workers container for hardware-accelerated video decoding.

Networking is handled by a Ubiquiti EdgeRouter 4 and a Netgear GS308E managed switch, which together give me VLAN support - the thing that makes the rest of this setup possible.

## The network

Everything is segmented across two VLANs:

- **VLAN 10** (`10.10.10.0/24`) - the Proxmox hosts themselves
- **VLAN 20** (`10.10.20.0/24`) - the LXC containers running services

Separating the host management interfaces from the containers they run is a small thing that pays off the moment you start thinking about blast radius: if something inside a container gets compromised, it doesn't sit on the same network as the hypervisors that could reboot or reimage the whole stack.

## What it runs

Across the two nodes, the cluster runs around fifteen LXC containers, all Linux. The services I actually use every day:

- **[AdGuard Home](/posts/adguard/)** (primary + secondary) - DNS and network-wide ad blocking, with an AdGuardHome-Sync container keeping the two instances in sync
- **[Immich](/posts/immich/)** - self-hosted photo backup and gallery, replaces iCloud Photos
- **[Vaultwarden](/posts/vaultwarden/)** - self-hosted Bitwarden-compatible password manager
- **[Plex](/posts/plex/)** - media server, backed by the 6TB drive on proxmox2
- **[Uptime Kuma](/posts/uptimekuma/)** - service monitoring and status dashboard
- **Mealie** - self-hosted recipe manager
- **n8n** - workflow automation, currently used for automatic recipe import from TikTok and Instagram via a Telegram bot
- **AI Workers** - a Flask API wrapping Ollama (llama3.2:3b) and Whisper, used by the recipe automation to transcribe audio, detect recipes, and extract structured data
- **Mediastack** - Docker Compose stack running Radarr, Sonarr, Prowlarr, and RDT-Client for automated media acquisition
- **Tailscale** - mesh VPN for remote admin access
- **MeTube** - web UI for downloading videos locally

...and a handful of others.

## Exposing services safely

A few of these services need to be reachable from outside my network - Immich so I can upload photos from my phone, Vaultwarden so it syncs across devices, n8n so Telegram webhooks can reach it.

The thing I *didn't* want to do was open ports on my home router directly. So I built a two-track approach depending on the service:

**Track 1 - Edge VPS with WireGuard (photos, Plex, Uptime Kuma):**

1. A small VPS on IONOS runs **Nginx** as a reverse proxy.
2. The VPS is connected back to my homelab over a **WireGuard** tunnel - the homelab end runs in a dedicated LXC container.
3. The WireGuard config on both ends is locked down: the VPS can only reach specific homelab IPs (Immich and Plex), and the homelab-side iptables rules only forward traffic on the exact ports those services use.
4. Public traffic hits the VPS, Nginx proxies it down the tunnel to the relevant container, and the response comes back the same way.
5. TLS is handled by Let's Encrypt on the VPS via Certbot.

**Track 2 - Cloudflare Tunnel (Vaultwarden, n8n):**

For services where I wanted zero infrastructure to manage on the public side, I use a Cloudflare Tunnel - a persistent outbound connection from an LXC container in my homelab to Cloudflare's edge. Traffic hits Cloudflare, gets routed down the tunnel, no VPS involved.

The split is deliberate. The Cloudflare Tunnel has a 100MB upload limit on the free plan, which makes it unsuitable for Immich (photos) and Plex (video). The edge VPS handles the bandwidth-heavy services; Cloudflare handles the low-traffic ones.

Either way: my home IP is never exposed. If the VPS ever gets compromised, the blast radius is one small Ubuntu machine and not the entire homelab behind my router.

For internal admin access (SSH, Proxmox web UI, service dashboards) I use **Tailscale** - no public exposure needed at all.

## What I learned

The technical stuff - Linux, networking, reverse proxies, VPN tunnels, container management - I could have learned from a book. What the homelab actually taught me was the *mindset*:

- **Blast radius thinking.** Every time I add a new service, the question isn't just "does it work," it's "what happens if this specific thing gets compromised?"
- **Segmentation matters more than perimeter.** A single flat network where everything can talk to everything else is the thing you regret the first time something goes wrong.
- **Monitoring is load-bearing.** Running services is easy. Knowing when one breaks at 2am without you having to notice is the actual work.
- **Nothing is ever "done."** The homelab is a continuously-evolving system, and that's the point.

It's also the biggest reason cyber security is what I want to build a career in. Running infrastructure you actually care about - where a mistake means losing your own photos or your own passwords - is a very good teacher.

## What's next

Things I'm working on or planning:

- **Offsite backups.** My current backup story doesn't have an offsite chapter yet. I'm looking at Proxmox Backup Server locally, plus encrypted offsite copies via rclone to cloud storage.
- **SSO in front of everything.** Right now each service has its own login. I want to put Authentik (or similar) in front of the lot so there's one identity, one place to audit logins, and 2FA everywhere without having to set it up per-service.
- **Proxmox QDevice.** A two-node cluster has no quorum on single-node failure, which means services can stall if one node goes down unexpectedly. A Raspberry Pi acting as a third voter fixes this.
- **A proper network diagram on this site.** Because a good diagram is worth three paragraphs of prose, and this post is already running long.

If you'd like to chat about any of this, or you're running something similar, [get in touch](/about/).
