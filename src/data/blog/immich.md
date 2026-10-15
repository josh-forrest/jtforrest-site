---
title: "Self-hosting Immich: replacing iCloud Photos"
author: Josh Forrest
pubDatetime: 2026-04-10T23:30:00Z
slug: immich
featured: false
draft: false
tags:
  - homelab
  - immich
  - self-hosting
  - photos
  - linux
description: "How I replaced iCloud Photos with a self-hosted Immich instance running on my Proxmox homelab - the setup, the trade-offs, and why I bothered."
---

## Table of contents

## Why I bothered

For years my photos lived in iCloud. It was convenient - phone takes a picture, photo appears on every Apple device I own, no thought required. Then I started bumping up against the free 5GB tier, started paying for more, and started thinking about how much of my life - every photo I'd ever taken on a phone - was sitting on Apple's servers, behind an account I'd lose access to the moment I left the ecosystem, governed by terms of service I'd never read.

[Immich](https://immich.app) is an open-source, self-hosted alternative that has matured rapidly over the last couple of years. It does the things I actually used iCloud Photos for - automatic phone backup, a clean gallery, search, albums, sharing - and it does them on hardware I own, on a network I control, with no monthly fee.

This post is a write-up of how I run it, what I learned getting there, and the bits that took longer than I expected.

## Where it runs

Immich runs in an LXC container on proxmox1 in my [two-node Proxmox cluster](/posts/homelab/). It sits on the container VLAN (`10.10.20.0/24`), separated from the Proxmox host network for the same blast-radius reasons I segment everything else.

Storage-wise, Immich's library lives on the 1TB HDD I have mounted at `/mnt/media` on proxmox1, exposed into the container as a bind mount at `/mnt/media/immich`. Originals, uploads, and database backups all live there. The LXC's own NVMe-backed root disk handles the things that benefit from being fast - thumbnails, the PostgreSQL database - which keeps the gallery responsive even when the underlying media disk is spinning rust.

## How it's exposed

This was the part that took the most thinking. I wanted to be able to upload from my phone wherever I was - out for the day, on holiday, whatever - without opening ports on my home router and without my photos being directly reachable from the public internet.

The answer uses my IONOS edge VPS as an intermediary. The architecture works like this:

1. A **WireGuard tunnel** connects the edge VPS to my homelab. The homelab end runs in a dedicated LXC container. Critically, both ends of the tunnel are locked down by IP: the VPS can only route to Immich's specific IP and port through the tunnel, and the homelab-side iptables rules drop everything else.
2. **Nginx** on the VPS acts as a reverse proxy - `photos.jtforrest.com` resolves to the VPS's public IP, Nginx terminates TLS (via Let's Encrypt) and forwards the request through the WireGuard tunnel to Immich.
3. My home IP is never in the picture. The VPS is the only thing publicly reachable, and its blast radius is limited to itself.

This is different from a Cloudflare Tunnel, which I use for some other services. The reason for the distinction is practical: Cloudflare's free plan has a 100MB upload limit, which makes it unsuitable for photo uploads. The edge VPS approach has no such constraint.

For uploads, the Immich mobile app just points at `https://photos.jtforrest.com` and runs in the background on my phone the way the iCloud Photos sync used to. New photos get backed up automatically over Wi-Fi or mobile data. I haven't touched it in months - it just works.

## What I gained

A few things have surprised me about running my own photo backup:

- **The mobile app is genuinely good.** It's not a downgrade from iCloud Photos. The UI is clean, search works, sharing albums works. I expected to be making compromises and I haven't really had to.
- **No more storage anxiety.** iCloud trains you to think in 50GB / 200GB / 2TB tiers and to pay every month for the privilege. With a 1TB drive and years of headroom, it's a one-time hardware cost instead of a recurring bill.
- **I look at my old photos more.** When my photos were trapped behind an iCloud account I rarely opened on a desktop, I never browsed them. Having them at `photos.jtforrest.com` - bookmarked, fast, mine - means I actually scroll through old albums every now and then.
- **I'm not locked in anymore.** If I want to move off Immich tomorrow, the photos are sitting on a disk I own, in a folder structure I can read, in their original formats. No proprietary container, no export request, no waiting.

## What I'd do differently

- **Plan the storage layout earlier.** I started with the library on the LXC's root disk and moved it to the bind-mounted HDD later, which involved a fiddly migration. Decide where the bulk data lives before the library is big enough to make moving it painful.
- **Set up the offsite backup *before* importing the entire iCloud archive.** Bootstrapping cloud backups of an already-large library is much slower and more expensive than backing up incrementally as it grows.
- **Turn off iCloud Photos sync on the phone before starting.** Trying to import an iCloud archive while the phone is still actively syncing to iCloud creates duplicates and confuses both systems. Switch the phone to Immich-only first, then do the historical import.

## What's next

- **Backups.** This is the honest gap in my setup right now - the photos exist in exactly one place, on one server, on one HDD. Losing it would be losing everything. Sorting this out is the next thing on the list, and it'll probably look like Proxmox Backup Server locally plus an encrypted offsite copy via rclone to cloud storage.
- **Family sharing.** Inviting a couple of family members so it can be the household photo solution, not just mine.
- **Properly tagging old photos.** Years of dumped phone backups with no structure. Immich's albums and search make this much more achievable than iCloud's flat timeline ever did, but it's still a job.

If you're thinking about getting your photos out of iCloud, [Immich](https://immich.app) is the answer in 2026. Spin it up, request your Apple export, point your phone at it, and you'll wonder why you didn't do it sooner.
