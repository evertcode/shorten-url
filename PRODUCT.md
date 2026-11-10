# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One person: the owner of the short domain. They open the page to turn a long URL into a short link, usually in the middle of doing something else (writing a message, a post, a document), and leave within seconds. Everyone else never sees the page: they only follow short links, and land on the "Link not found" page when a link does not exist.

## Product Purpose

A personal URL shortener running on the owner's own domain. Success is: paste a URL, optionally choose an alias, get the short link copied, and go back to what they were doing. The list of existing links is there to find and copy a link made earlier.

## Positioning

The links live on the owner's own domain and in their own Cloudflare account. It is a personal tool, not a service: no accounts, no analytics, no marketing.

## Operating Context

- Used alone, on desktop and on a phone, in short visits.
- Creating a link requires an access code (a shared secret sent with the request). The owner types it or lets the browser fill it.
- Links are stored in a Cloudflare KV namespace. A link is an alias (hash) plus a destination URL.
- Aliases can be chosen by the owner or generated at random.

## Capabilities and Constraints

- Create a short link, with a custom or random alias.
- See the created short link and copy it.
- List existing links with their destinations, copy any of them, change a destination or delete a link. Editing and deleting use the access code typed in the form.
- Unknown short links answer with a "Link not found" page.
- No analytics, click counts or expiry dates. An alias cannot be renamed.
- Frontend: Vite + TypeScript without a UI framework, hand written CSS, no CDN and no external requests. Light and dark themes follow the system setting.
- UI copy is in English.
- The `api` alias and the `assets/` prefix are reserved.

## Brand Commitments

- The product is named after the domain it is served from: the host is the wordmark. There is no separate product name.
- No prior visual identity exists. The owner has given full freedom to define one.
- The result must not read as a generic SaaS template (white shadowed cards, indigo or violet accent, everything rounded), must not be over decorated (effects, gradients, illustration or animation that gets in the way of a tool used in seconds), must not be cold and characterless, and must not be a dark terminal or hacker aesthetic.

## Evidence on Hand

- Real content is limited to the owner's own links: aliases and destination URLs.
- There are no testimonials, customers, metrics or press, and none may be invented.

## Product Principles

- Seconds, not sessions: every visit should end with a copied link as fast as possible.
- The short link is the product: it deserves more presence than the chrome around it.
- Personal, not corporate: it belongs to one person and may look like it.
- Say what went wrong where it went wrong: errors sit next to the field that caused them.

## Accessibility & Inclusion

Text contrast of at least 4.5:1 in both themes, full keyboard operation, visible focus, results and errors announced to assistive technology, and reduced motion respected.
