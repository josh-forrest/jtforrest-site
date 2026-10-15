---
title: "Self-hosting Uptime Kuma: monitoring my homelab from inside and out"
author: Josh Forrest
pubDatetime: 2026-04-10T23:58:00Z
slug: uptime-kuma
featured: false
draft: false
tags:
  - homelab
  - uptime-kuma
  - monitoring
  - self-hosting
description: "How I monitor a dozen self-hosted services with two Uptime Kuma instances - one inside the homelab, one on the VPS - and get Telegram notifications the moment anything breaks."
---

## Table of contents

## Why monitoring matters more than you'd think

When you run a single self-hosted service, you don't really need monitoring. If it's down, you'll notice when you try to use it.

When you run a dozen, the maths changes. Some services you use every day (DNS, photo backup, password manager). Some you only touch occasionally (the recipe manager, the workflow automation). And some you don't actively use at all but other people do - Plex is the obvious example. The result is that without monitoring, services can be quietly broken for *days* before you notice, and the way you usually find out is someone telling you.

That's not how I want to learn that something has been down. I'd rather know about it the moment it happens, before anyone else does.

[Uptime Kuma](https://github.com/louislam/uptime-kuma) is the open-source self-hosted answer to this. It's a small Node.js application that periodically checks whether your services are up - by hitting an HTTP endpoint, pinging an IP, checking a DNS record, validating a TLS certificate, etc - and notifies you when they go down. It's simple, it's free, it has a clean UI, and it's become one of the services I'd genuinely struggle to do without.

## Two instances, two viewpoints

Here's the slightly clever bit, and the thing I'm most pleased with about my monitoring setup: I run **two Uptime Kuma instances** - one inside my homelab, and one on the VPS that sits on the public internet. They watch different things from different places, and together they cover the failure modes that a single instance would miss.

**The internal instance** runs in an LXC on `proxmox2`. It monitors all the services on my home network from the inside - Immich, Vaultwarden, Plex, AdGuard, the Proxmox web UIs, the LXCs themselves. Because it's on the same network as the things it's monitoring, it can hit them directly by their internal IPs without any of the public-internet routing in the middle. If something on the homelab goes down, the internal instance is the first to know.

**The external instance** runs on the VPS - the same VPS that handles reverse-proxying my publicly-exposed services. It monitors the same services *but from the public internet*, using the public hostnames (`photos.jtforrest.com`, `vault.jtforrest.com`, `plex.jtforrest.com`, etc). It also monitors the VPS itself, the WireGuard tunnel back to the homelab, and a few external dependencies I care about.

Why two instances? Because a single instance has a blind spot for *its own failure modes*.

If the internal instance can't reach Immich, that tells me Immich is down. But what if my entire homelab is down? The internal instance is *also* down, so it can't notify me. The external instance, sitting on a completely separate machine on a completely separate network, sees the homelab as unreachable and tells me about it.

The reverse is also true. If the VPS is down, the internal instance still works and can tell me. If only the public route to a service is broken (a misconfigured Cloudflare Tunnel, an Nginx config mistake, a DNS issue) but the service itself is fine, the external instance flags it as down and the internal instance shows it as up - which tells me exactly where the problem is. The two instances together don't just tell me *what* is down, they help me localise *why*.

This is the kind of thing that you don't need until you really need it, and then you're very glad you set it up.

## Notifications

Both instances notify me directly via Telegram. I created a private Telegram bot, gave both Uptime Kuma instances the bot token, and configured them to message me when anything goes down or comes back up.

Telegram for this is great, for a few reasons:

- **It's instant.** Push notifications hit my phone the moment something fires, not whenever I happen to check email next.
- **It's free.** No paid notification service, no SMS gateway charges.
- **It works on every device I own.** Phone, tablet, laptop - wherever I have Telegram, I get the alerts.
- **The bot API is dead simple.** Setting it up took about ten minutes including making the bot.

The format is also useful: each notification tells me which monitor fired, whether it went down or came back up, the response code or error, and how long it had been in the previous state. So I get messages like "Immich is DOWN - connection refused - was up for 14 days" and "Immich is UP - was down for 3 minutes." That's enough context to know whether something is a transient blip or a real outage, without me having to open the dashboard.

## What I monitor

A non-exhaustive list of what's currently in Uptime Kuma:

- **All my main self-hosted services** by HTTP check - [Immich](/posts/immich/), [Vaultwarden](/posts/vaultwarden/), [Plex](/posts/plex/), [AdGuard Home](/posts/adguard/) (×2), n8n, and the rest
- **The Proxmox host web interfaces** themselves - if a node goes offline, I want to know before its containers start failing
- **Both AdGuard instances independently**, so I can tell if one has dropped while the other's still running
- **The VPS itself**, monitored from the homelab side - confirms the WireGuard tunnel is up
- **A few external services** I depend on, mostly as sanity checks
- **TLS certificate expiry** for my public hostnames - Uptime Kuma can warn you N days before a cert expires, which has saved me at least once

The dashboard ends up looking like a wall of green most of the time, which is exactly what you want from a monitoring tool: boring.

## What I learned

- **Monitor things from the place your users are.** Monitoring Plex from inside the homelab tells you whether the Plex server is up. Monitoring it from the public internet tells you whether *anyone can actually reach it*. These are different questions and they have different answers when something is wrong.
- **Notifications are more important than dashboards.** I almost never actively look at the Uptime Kuma dashboard. What I care about is being told when something is wrong, immediately, on the device I'm holding. If you set this up and don't configure notifications, you've built a website that nobody (including you) reads.
- **TLS expiry monitoring is cheap insurance.** Cloudflare handles most of my certificates automatically, but for the ones I manage myself, getting a "this certificate expires in 14 days" warning two weeks before the fact is the difference between a calm Sunday afternoon and an emergency.
- **Start small and add monitors as you go.** I tried to add everything at once when I first set this up and got notification fatigue from a few flaky services. Better to start with the things that really matter, get them stable, and only then add the more peripheral stuff.

## What's next

- **Proper status page.** Uptime Kuma supports public status pages - a clean, minimal page showing the current state and history of your services, suitable for sharing. I'd like to set one up at `status.jtforrest.com` so my family can check whether Plex is actually down before asking me about it.
- **Push monitors for cron jobs.** Uptime Kuma has a "push" monitor type, which is essentially a dead-man's-switch - a cron job has to ping a URL on a schedule, and if it stops pinging, Uptime Kuma alerts. Useful for things like backup jobs, where the failure mode is "the job didn't run" rather than "the service is down."
- **Better grouping and tagging.** The list of monitors is starting to get long enough that I want to organise it more carefully - group by host, by criticality, by who cares if it goes down.

If you're running more than a few self-hosted services, this is the one I'd set up next. It takes an hour to install and configure, and within a week of running it you'll have caught at least one outage you wouldn't have noticed otherwise.