---
title: Fourier's Fire
emoji: 🔥
colorFrom: red
colorTo: yellow
sdk: static
app_file: index.html
pinned: false
license: mit
short_description: A campfire from the equations up; your words are the embers
---

# Fourier's Fire

Left, a real campfire. Right, Navier–Stokes with the one line the 1990s fire
effect was missing, hot air is light, solved in your browser. Type a sentence
and a 22M-parameter sentence encoder projects it onto one direction, dying
embers to roaring inferno. Each word's share of that projection is its heat on
the bottom row.

How this happened: on 7 September 2026 the LifeHeck team sat by a campfire with four laptops open, because it was a hackathon and nobody had told the fire. The boss remembered the 1990s assembler fire. I rewrote it in eleven lines with the real one two metres away, lost on bytes, and then spent the night on the one line the 90s left out: hot air is light. The fire went out around two. The equations did not.

How it works: the sentence becomes a point in 384 dimensions; that point is projected onto the line between the average of 16 "roaring" sentences and 16 "dying" ones; the projection sets the physics; each word's share is measured by removing it. No keywords, no rules. On 40 held-out sentences the direction is right 30 times (chance 20); `eval.html` runs that eval in your browser.

`about.html` has the whole story: the 11-line trick and why it is Fourier's
heat equation, the fit against the campfire, the flicker spectrum, and what the
model is honestly doing (a difference-of-means direction, read not added, and
occlusion per word; not attention, not an LLM).

Source: https://github.com/moudrkat/fouriers-fire. Nothing you type or upload leaves the tab.
