# Art Gallery

A free, self-hosted online gallery for your artwork. Runs entirely on Netlify's
free tier — no server to manage, no database to pay for, no code to write.

*(Add a screenshot or GIF of your deployed gallery here once you have one —
it's the best way to show people what they're getting.)*

**[Deploy your own gallery →](https://app.netlify.com/start/deploy?repository=https://github.com/abe-mart/ArtGallery)**

> The button above deploys straight from this repository. If it 404s, the
> repo may have moved or been renamed — see [Deploying](#deploying) below for
> the manual steps.

## What you get

- **A gallery wall** your visitors can browse, with a detail view for each piece
- **An admin panel** at `/admin` to add, edit, and remove paintings — including
  built-in tools to straighten, dewarp, white-balance, and even out lighting
  in phone photos of your art, right in the browser
- **A Settings tab** to set your name, site title, hero text, and about page —
  no code editing required
- **An optional PIN** so only people you share it with can see the gallery
- **Basic protection against AI scrapers** — known AI-training bots are
  blocked, and a "no AI training" signal is sent with every image
- **$0/month hosting** on Netlify's free tier for a typical portfolio

## Deploying

You'll need a GitHub account and a Netlify account (you can sign up for
Netlify with your GitHub account in one click). No coding required. This
takes about 10 minutes.

1. Click **[Deploy to Netlify](https://app.netlify.com/start/deploy?repository=https://github.com/abe-mart/ArtGallery)**.
2. Netlify will ask to connect to GitHub and create a copy of this repo in
   your own account. Approve that.
3. You'll be asked for one setting: **`ADMIN_PASSWORD`**. Choose a password
   you'll use to log into your admin panel — you can change it later.
4. Click **Deploy site**. Netlify will build and publish your gallery —
   this takes a minute or two.
5. Once it says **Published**, open your site. You'll see an empty gallery —
   that's expected, you haven't added any art yet.
6. Go to `yoursite.netlify.app/admin` and log in with the password from
   step 3.
7. Use the **Settings** tab to set your name and site title, then use the
   **Paintings** tab to upload your first piece.
8. Optional: in Netlify's site settings, rename your site from something
   like `jolly-pika-123.netlify.app` to a name of your choosing, or connect
   a domain you already own.

That's it — no database to set up, no server to configure.

## Protecting your art

No online gallery can make images fully uncopiable — anything a browser can
display, someone can screenshot. What this app does is raise the bar and make
your position clear:

| Setting | What it does | What it doesn't do |
|---|---|---|
| **PIN gate** (Settings tab) | Requires a PIN before anyone — including bots — can see any painting or image data. This is the strongest option available. | Anyone you give the PIN to can share it further. |
| **Block AI bots** (Settings tab, on by default) | Blocks well-known AI-training crawlers (GPTBot, ClaudeBot, CCBot, and others) from fetching your images or data, sends a `Tdm-Reservation` opt-out header, and publishes a `/robots.txt` disallowing them. | Only stops crawlers that identify themselves honestly — a determined scraper can lie about who it is. |
| **Downscaled uploads** (automatic) | Your art is compressed and capped at 2400px on the long edge before it's stored — the original file on your computer never leaves your browser. | A capped image is still a usable image. |

If you want to go further:
- Put your domain behind [Cloudflare](https://www.cloudflare.com/) (free
  plan) and turn on its **Block AI bots** setting for a second layer of
  crawler blocking that works even for requests your app never sees.
- Consider running your images through [Glaze](https://glaze.cs.uchicago.edu/)
  before uploading — a tool designed to disrupt AI style-mimicry. It's an
  extra manual step outside this app, and how well it holds up is genuinely
  debated, but it's there if you want it.
- Turn on the PIN if you're not trying to be found by the public at all —
  e.g. a private gallery for family, clients, or a specific buyer.

## Backing up your gallery

Your paintings and images live in Netlify Blobs, tied to your Netlify site.
There's no built-in export yet (see [Roadmap](#roadmap)) — in the meantime,
your admin **Download** button on each image saves the current processed
version, and the source photos on your own computer are your backup of the
originals.

## FAQ

**Is this really free?**
Yes, for a typical personal portfolio. Netlify's free tier includes 100GB of
bandwidth and generous function usage per month; a personal gallery uses a
small fraction of that. Check [Netlify's current pricing](https://www.netlify.com/pricing/)
if you're unsure your usage will fit.

**I forgot my admin password.**
In the Netlify dashboard for your site, go to **Site configuration > Environment
variables**, edit `ADMIN_PASSWORD` to a new value, and redeploy (or trigger
**Clear cache and deploy site** from the Deploys tab).

**Can I use my own domain?**
Yes — add it under **Domain management** in your Netlify site settings.
Netlify provisions HTTPS for it automatically.

**How do I get updates to this template?**
If the Deploy button created a real GitHub fork, GitHub's **Sync fork**
button pulls in updates, and Netlify will redeploy automatically. If it
created a plain copy instead, you'll need to merge changes manually — check
this repository's releases for what changed.

**I found a bug / have a feature idea.**
Open an issue on this repository.

## Roadmap

Ideas that would make this better, not yet built:
- Export/import for backing up your whole gallery
- A separate low-resolution "grid" thumbnail apart from the viewing-size
  image, so even less of the original resolution is exposed
- A live demo site with public-domain artwork

## Local development

```bash
npm install
netlify dev
```

(Requires the [Netlify CLI](https://docs.netlify.com/cli/get-started/):
`npm install -g netlify-cli`.) Create a `.env` file from `.env.example` and
set `ADMIN_PASSWORD` for local testing.

## Project structure

- `src/` — React frontend (Vite + Tailwind)
- `netlify/functions/` — serverless backend (auth, settings, PIN gate, CRUD)
- `public/` — static assets

## License

The code in this repository is MIT-licensed — see [LICENSE](LICENSE). That
license covers the software only; the copyright to any artwork you upload
remains entirely yours.
