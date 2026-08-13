# Padel Club Naas

Coming-soon site for a local padel club in Naas, Co. Kildare.

Live features include a landing page, booking interest form, QR code for the booking page, and an investor contact section.

**Repo:** [github.com/PMooney03/JoshPadel](https://github.com/PMooney03/JoshPadel)

## Stack

- React + Vite
- React Router
- Framer Motion
- qrcode.react

No database — static site, fine for free hosting on Vercel.

## Setup

You need [Node.js](https://nodejs.org) (LTS) and [Git](https://git-scm.com).

```bash
git clone https://github.com/PMooney03/JoshPadel.git
cd JoshPadel
npm install
npm run dev
```

Open the local URL Vite prints (usually `http://localhost:5173`).

To view on your phone (same Wi‑Fi):

```bash
npm run dev -- --host
```

Then open the **Network** address shown in the terminal on your phone.

## Scripts

| Command           | What it does              |
| ----------------- | ------------------------- |
| `npm run dev`     | Local development server  |
| `npm run build`   | Production build → `dist` |
| `npm run preview` | Preview the production build |
| `npm run lint`    | Run the linter            |

## Deploy on Vercel

You’re ready when the code is on GitHub (this repo already is).

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub  
2. **Add New → Project**  
3. Import **PMooney03/JoshPadel**  
4. Leave the defaults (Vite is detected automatically)  
5. Click **Deploy**

You’ll get a live URL like `https://joshpadel.vercel.app`.  
Later pushes to `main` will auto-update the site.

## Contact

- Email: [josh.hyland@icloud.com](mailto:josh.hyland@icloud.com)
- Phone: [083 874 4737](tel:+353838744737)
