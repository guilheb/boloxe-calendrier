# Running on a Raspberry Pi (kiosk mode)

Goal: the Pi boots straight into a full-screen browser showing the calendar.

The app isn't just static files. The calendar feeds go through Vite's proxy at `/feeds/<id>` (see `vite.config.js`), which keeps the private feed URLs out of the browser and avoids CORS. So the Pi has to run a small server alongside the browser. `vite preview` does that, because it reuses the same proxy routes.

## 1. Set up the Pi

- Use a Pi 4 or 5. A Pi 3 will work but Chromium is slow on it.
- Flash **Raspberry Pi OS (64-bit, with desktop)** using Raspberry Pi Imager. In the Imager settings, set the Wi-Fi, a username and SSH access before writing the card, so you can configure the Pi from your PC without a keyboard.
- Run `sudo raspi-config`:
  - **System → Boot / Auto Login → Desktop Autologin**, so it boots straight to the desktop without a login prompt.
  - **Display → Screen Blanking → Off**, so the screen doesn't go dark after 10 minutes.

## 2. Install the app

- Install Node.js. The version in the default apt repo is often too old for Vite 8, so use NodeSource or `nvm` to get Node 20 or later.
- Copy the project over (git clone or `scp`), leaving out `node_modules`, then run `npm ci`.
- Copy `.env` too. It isn't in git and it holds the feed URLs.
- Run `npm run build`.

## 3. Run the server as a service

- Create a systemd unit that runs `npx vite preview --port 4173` from the project folder, with `Restart=always`.
- Enable it with `sudo systemctl enable --now boloxe-cal`. It will then start on every boot, before the desktop is up.

## 4. Open the browser in kiosk mode at login

- Recent Raspberry Pi OS uses Wayland with the **labwc** window manager. Add a line like this to `~/.config/labwc/autostart`:

  ```
  chromium-browser --kiosk --noerrdialogs --disable-infobars --incognito http://localhost:4173 &
  ```

- `--incognito` stops Chromium from showing a "restore pages?" bar after a power cut.
- Optionally, install `unclutter` (or the Wayland equivalent) to hide the mouse cursor.
- The browser can start before the server is ready. To handle that, either wrap the launch in a small script that waits until `curl localhost:4173` succeeds, or have the page reload itself if the first load fails.

## 5. Finishing touches

- Make sure the calendar refreshes itself on a timer so the display stays current without anyone touching it.
- To rotate the screen, use the Screen Configuration tool in the desktop.
- To exit kiosk mode for maintenance, press `Alt+F4` with a keyboard plugged in, or just SSH in.

## Other options

- **Smaller setup:** run Raspberry Pi OS Lite with only `cage`, a minimal Wayland kiosk compositor, plus Chromium instead of the full desktop. It boots faster but takes more setup.
- **No Node on the Pi:** build the app on your PC and serve `dist/` with Caddy or nginx, configured to proxy `/feeds/*` to the calendar URLs. It's lighter at runtime, but the proxy rules would then live in two places.
