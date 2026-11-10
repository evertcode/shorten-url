---
version: 1
slug: "web-index-html"
primary_target: "web/index.html"
related_targets: ["web/404.html"]
---

# Surface: link shortener page and its "Link not found" page

Scope: `web/index.html` (create a link, read and copy existing links) and `web/404.html`. Mode: Operate.

Audience and job: the owner alone, mid-task, pasting a URL and leaving with a copied short link in seconds. Visitors only ever see the 404 page.

Content: the host as wordmark, three fields, the created link, the alphabetical list of links with destinations. No invented data.

Constraints: no CDN or external requests, light and dark themes, English copy, keyboard and screen reader support, element ids used by `web/main.ts` stay.

Unresolved: none.

## Direction contract

THESIS: Every short link is a road sign: a route marker that points at its destination. Refuses the centered white card with a soft shadow and an indigo button.

OWN-WORLD: Guide-sign green panels with a white inset keyline and white legend; yellow route shields with a black border for aliases; white regulatory plates with a black border wherever something is typed or stated; drawn sign arrows; a pale concrete ground by day and asphalt by night, while the signs themselves keep their colours. One highway-gothic family throughout. Red only for errors.

STORY: The owner sees where to type, shortens, reads the new link on a green sign and copies it. The list reads as a column of route markers, each pointing at where it leads.

FIRST VIEWPORT: Full-width green header sign with the host set large on the left and an up-right arrow on the right. Below, two columns on desktop: left, "New link" with the three fields and a full-width green "Shorten URL" button, then the result sign; right, "Recent links" as stacked plates: shield, arrow, destination, Copy. One column on phones, form first.

SIGNATURE: the shield, arrow, destination row, and the result drawn as a full guide sign that wipes in once.

FORM: Wayfinding, the first candidate on the grounded list, chosen by the user over the dealt direction. seed:5febdc5ec5485d85

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
