# @video-admiral/webos

Packages the shared web UI (`@video-admiral/web`) as a native LG webOS TV app.
The app ships the SPA inside the `.ipk`; on first launch it asks for the address
of your Video Admiral server (e.g. `192.168.0.200:5555`) and remembers it.
Change it later from Settings → System → Change Server.

## Remote control support

- D-pad arrows → spatial focus navigation (same as the browser UI)
- OK → activate
- Back (461) → back navigation
- Play / Pause / Stop / Rewind / Fast-forward media keys work in the player

## Build & install

One-time setup on the TV: enable [Developer Mode](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app)
(install the "Developer Mode" app from the LG Content Store, sign in, turn Dev Mode on).

One-time setup on your machine:

```sh
npm install -g @webos-tools/cli
ares-setup-device        # register the TV (IP + passphrase from the Dev Mode app)
```

Then from this folder (or `npm run build:webos` at the repo root):

```sh
npm run build                          # -> dist/ (SPA + appinfo.json + icons)
ares-package dist --outdir out         # -> out/dev.kylewest.videoadmiral_0.1.0_all.ipk
ares-install out/*.ipk --device <tv>   # install on the TV
ares-launch dev.kylewest.videoadmiral --device <tv>
```

`npm run package` does build + ares-package in one step.

## Notes

- `disableBackHistoryAPI: true` in `appinfo.json` makes the remote's Back button
  arrive as keyCode 461, which the app handles itself.
- The server must be reachable from the TV. CORS is already enabled on the
  server, so the packaged app (a `file://` origin) can call it directly.
- Dev Mode installs expire after ~50 hours of TV uptime; re-run the Dev Mode
  app's timer or re-install as needed.
