# Access anywhere with Tailscale (free)

## Start the app

```powershell
scripts\start-tailscale.bat
```

Open on any device with **Tailscale ON** (same tailnet):

**https://YOUR-MACHINE.tailXXXX.ts.net**

(Run `tailscale status` on your PC to see your exact URL.)

Works on mobile data — no home Wi‑Fi, no certificate install.

---

## Add people

1. [Tailscale admin → Users](https://login.tailscale.com/admin/users) → **Invite users**
2. They install Tailscale and sign in
3. They open your machine URL in Chrome/Safari
4. **Add to Home screen** / **Install app**

---

## Share with anyone (no Tailscale on their phone)

```powershell
scripts\start-tailscale-public.bat
```

Enable **Funnel** once in [Tailscale admin → DNS](https://login.tailscale.com/admin/dns), then share the public `https://` link it prints.

---

## Stop

```powershell
scripts\stop-urban-map.bat
```

---

## Dev on PC (hot reload)

```powershell
docker compose up -d
cd frontend && npm install && npm run dev
```

Open http://localhost:5173
