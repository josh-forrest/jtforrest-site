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

I didn't set out to learn Linux systems administration, networking, or infrastructure security. I set out to stop paying monthly for things I thought I could run myself — photo backup, a password manager, a bit of ad-blocking. One Proxmox install later, I had a homelab, and things got away from me in the best possible way.

This post is a write-up of what I've built: the hardware, the network, the services, and — most importantly — what I've actually learned from it.

## The hardware

The cluster runs on two small form-factor office PCs, both with Intel i5-8500T 6-core CPUs and 16GB of RAM:

- **proxmox1** — HP ProDesk 400 G4 DM with a 500GB NVMe drive and a 1TB HDD for media storage
- **proxmox2** — Dell OptiPlex 3060 with a 500GB NVMe drive

Networking is handled by a Ubiquiti EdgeRouter 4 and a Netgear GS308E managed switch, which together give me VLAN support — the thing that makes the rest of this setup possible.

## The network

Everything is segmented across two VLANs:

- **VLAN 10** (`10.10.10.0/24`) — the Proxmox hosts themselves
- **VLAN 20** (`10.10.20.0/24`) — the LXC containers running services

Separating the host management interfaces from the containers they run is a small thing that pays off the moment you start thinking about blast radius: if something inside a container gets compromised, it doesn't sit on the same network as the hypervisors that could reboot or reimage the whole stack.

## What it runs

Across the two nodes, the cluster runs around a dozen LXC containers, all Linux. The services I actually use every day:

- **AdGuard Home** (primary + secondary) — DNS and network-wide ad blocking, with an AdGuardHome-Sync container keeping the two instances in sync
- **Immich** — self-hosted photo backup and gallery, replaces Google Photos
- **Vaultwarden** — self-hosted Bitwarden-compatible password manager
- **Plex** — media server
- **Uptime Kuma** — service monitoring and status dashboard
- **Tailscale** — mesh VPN for remote admin access
- **MeTube** — web UI for downloading videos locally

...and a handful of others.

## Exposing services safely

A few of these services need to be reachable from outside my network — Immich so I can upload photos from my phone, Vaultwarden so it syncs across devices, Uptime Kuma so I can check things from anywhere.

The thing I *didn't* want to do was open ports on my home router directly. So I built it like this:

1. A small VPS on the public internet runs **Nginx** as a reverse proxy.
2. The VPS is connected to my homelab over a **WireGuard** tunnel.
3. Public traffic hits the VPS, gets proxied down the tunnel to the relevant LXC container, and the response comes back the same way.
4. **Cloudflare** sits in front of the VPS, providing DNS, TLS certificates, and an extra layer of protection.

My home IP is never exposed. If the VPS ever gets compromised, the blast radius is one small Ubuntu machine, not the entire homelab behind my router.

For internal admin access (SSH, Proxmox web UI, service dashboards) I use **Tailscale** — no public exposure needed at all.

## What I learned

The technical stuff — Linux, networking, reverse proxies, VPN tunnels, container management — I could have learned from a book. What the homelab actually taught me was the *mindset*:

- **Blast radius thinking.** Every time I add a new service, the question isn't just "does it work," it's "what happens if this specific thing gets compromised?"
- **Segmentation matters more than perimeter.** A single flat network where everything can talk to everything else is the thing you regret the first time something goes wrong.
- **Monitoring is load-bearing.** Running services is easy. Knowing when one breaks at 2am without you having to notice is the actual work.
- **Nothing is ever "done."** The homelab is a continuously-evolving system, and that's the point.

It's also the biggest reason cyber security is what I want to build a career in. Running infrastructure you actually care about — where a mistake means losing your own photos or your own passwords — is a very good teacher.

## What's next

Things I'm working on or planning:

- **Offsite backups.** My current backup story is "PBS to a local HDD," which is fine for hardware failure but not for flood, fire, or theft. I'm looking at layering encrypted backups out to cloud storage.
- **SSO in front of everything.** Right now each service has its own login. I want to put Authentik (or similar) in front of the lot so there's one identity, one place to audit logins, and 2FA everywhere without having to set it up per-service.
- **A proper network diagram on this site.** Because a good diagram is worth three paragraphs of prose, and this post is already running long.

If you'd like to chat about any of this, or you're running something similar, [get in touch](/about/).