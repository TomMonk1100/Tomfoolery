# Understory — Capacitor Wrap (Deferred Future Step)

NOT executed in this build session. Recorded as the documented next step for
turning the PWA into an app-store-packaged native shell. The web codebase does
not change — Capacitor ingests the same `dist/` output.

## Steps (when ready)

1. `npm install @capacitor/core @capacitor/cli`
2. `npx cap init Understory com.understory.app --web-dir=dist`
3. `npm run build` (produce a fresh `dist/`)
4. Add platforms:
   - `npx cap add ios`
   - `npx cap add android`
5. `npx cap sync` after each web build to copy `dist/` into the native projects.
6. Open native IDEs to configure signing / icons / splash:
   - `npx cap open ios` (Xcode)
   - `npx cap open android` (Android Studio)

## Notes
- Keep `webDir` pointed at `dist`.
- Portrait orientation lock is already declared in the PWA manifest; mirror it
  in the native project configs (Info.plist `UISupportedInterfaceOrientations`,
  Android `android:screenOrientation="portrait"`).
- Audio: the Web Audio ambient bed works inside the Capacitor WebView; no native
  audio plugin required for MVP.
- No server component — fully client-side with localStorage — so no native
  networking entitlements are needed.
