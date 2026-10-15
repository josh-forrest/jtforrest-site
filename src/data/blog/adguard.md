---
title: "Self-hosting AdGuard Home: network-wide ad blocking with no single point of failure"
author: Josh Forrest
pubDatetime: 2026-04-10T23:45:00Z
slug: adguard
featured: false
draft: false
tags:
  - homelab
  - adguard
  - dns
  - networking
  - self-hosting
description: "How I run AdGuard Home as a primary/secondary DNS setup across both Proxmox nodes, what it actually blocks, and why DNS is the single highest-leverage thing you can self-host."
---

## Table of contents

## Why DNS is the right place to do this

Browser ad blockers are great. They work, they're free, and if you've never installed one you should stop reading and go do that instead. But they only block ads in browsers - not in apps on your phone, not on your TV, not on the random IoT devices that talk to tracking servers in the background, not on guests' devices when they connect to your Wi-Fi.

DNS-level blocking solves all of that in one place. Every device on the network - phones, laptops, smart TVs, doorbells, whatever - has to ask a DNS server to resolve a domain before it can talk to it. If your DNS server says "I don't know, that domain doesn't exist," the connection never happens. One install, every device covered, no per-device configuration.

[AdGuard Home](https://adguard.com/en/adguard-home/overview.html) is the open-source, self-hosted tool for doing this. It's what I run on my [homelab](/posts/homelab/), and it's quietly become one of the services I'd miss most if it went away.

## The setup

I run AdGuard Home as **two separate instances** - a primary and a secondary - on different physical nodes in my Proxmox cluster:

- **Primary** on `proxmox2`
- **Secondary** on `proxmox1`

Both are configured as DNS servers on my router (a Ubiquiti EdgeRouter 4), so every device on the network gets handed both addresses via DHCP. If the primary is down - for an update, a reboot, a kernel panic, whatever - devices fall back to the secondary automatically. No device-side configuration, no manual failover, no "the internet is broken" while I'm rebooting a container.

This was the single most important architectural decision in my whole homelab setup. DNS is one of those services where if it stops working, *everything* stops working - and the failure mode is the worst kind, because nothing tells you "DNS is broken," you just see websites mysteriously not loading. Running two instances on two physical nodes means a single hardware failure, software upgrade, or me-induced misconfiguration doesn't take the whole house offline.

## Keeping the two in sync

The catch with running two AdGuard instances is that any change you make to one - adding a blocklist, whitelisting a domain, creating a DNS rewrite - has to be made to the other one too, or they'll drift apart. Doing that by hand is exactly the kind of thing that gets forgotten, then bites you a week later when you can't work out why a domain is blocked on one device but not another.

The answer is [AdGuardHome-Sync](https://github.com/bakito/adguardhome-sync), a small open-source tool that does exactly what the name suggests: it watches the primary instance and pushes any configuration changes to the secondary on a schedule. I run it as its own LXC container. Once it's set up, I just edit the primary AdGuard UI as if it were the only instance, and everything else takes care of itself.

## Upstream DNS

For the actual DNS resolution - i.e. when AdGuard *doesn't* block a request and needs to forward it to find the real answer - I use [Cloudflare's 1.1.1.1](https://1.1.1.1) over DNS-over-HTTPS (DoH).

I picked Cloudflare for the obvious reasons: it's fast, it's free, it has a reasonable privacy policy, and I'm already inside the Cloudflare ecosystem for the rest of my homelab so it's not adding a new trust relationship. The DoH bit is important - without it, every DNS query my entire house makes would be sent over plain UDP to my ISP's resolver in cleartext, which is exactly the kind of traffic an ISP can (and does) log and sell. DoH wraps the queries in HTTPS, which doesn't make them anonymous, but it does mean nobody between me and Cloudflare gets to see them.

The "more paranoid" alternative is to run [Unbound](https://nlnetlabs.nl/projects/unbound/about/) as a recursive resolver alongside AdGuard, which means you talk directly to the authoritative DNS servers for each domain instead of trusting any single upstream. I haven't bothered yet - Cloudflare is good enough for what I need - but it's on the list of "things I might do for the learning experience."

## What it actually blocks

Out of the box, AdGuard Home comes with the AdGuard DNS filter enabled, which is a solid baseline. I've layered a few additional blocklists on top of it - specifically the [OISD](https://oisd.nl) list, which is one of the better-curated general-purpose blocklists and aggressive enough to catch most trackers and ads without breaking real websites.

A few rough numbers from my own AdGuard dashboard, which I find genuinely interesting every time I look at it:

- Roughly 15-25% of all DNS queries on my network get blocked
- Most of the blocked queries come from phones in the background, not from anything I'm actively doing
- A handful of specific apps (no names, but you can guess) are responsible for a wildly disproportionate share of the noise - some of them make hundreds of telemetry requests per hour to domains with names that very obviously aren't load-bearing for the app to function

That last point is the one that changed how I think about software in general. Until you put DNS-level blocking in front of your network and look at the logs, you don't really appreciate how much background chatter the average app generates.

## What I learned

A few things from running this for long enough to have opinions:

- **Two instances on two nodes is non-negotiable.** I started with one and lived with one for a while. The day I had to reboot it during an upgrade and the entire house's internet stopped working for ninety seconds was the day I built the second one.
- **Don't block too aggressively.** The temptation when you first set this up is to subscribe to every blocklist you can find. Don't. You'll break legitimate services, your family will be angry, and you'll spend the next two weeks whitelisting things one by one. Start with the AdGuard default + OISD, give it a week, and only add more if you have a specific reason.
- **The query log is genuinely useful for debugging.** When something on the network can't reach a service it should be able to reach, the AdGuard query log is the first place I look - nine times out of ten the answer is "the device is trying to talk to a domain that's blocked by an overly aggressive blocklist," and the fix is one whitelist entry.
- **DNS rewrites are underrated.** I use AdGuard's DNS rewrites to point internal hostnames at LXC IPs, so I can hit `immich.home.local` from inside the network instead of remembering its IP address. I have entries for every service - `mealie.home.local`, `n8n.home.local`, `vault.home.local`, and so on. It's a small quality-of-life thing that adds up across a dozen containers.

## What's next

- **Probably try Unbound.** Mostly for the learning experience of running a fully recursive resolver, even if it doesn't change anything practical for me day-to-day.
- **More structured monitoring.** Right now I check the AdGuard dashboard manually when I'm curious. Pulling the query stats into something like Grafana so I can see trends over time would be a nice touch.
- **Better blocklist hygiene.** I should probably review what I have subscribed and prune anything that's stale or redundant.

If you have a homelab and you're not running AdGuard Home yet, this is the one I'd start with. It's the smallest amount of effort for the largest improvement to daily internet quality you can get from any self-hosted service.
