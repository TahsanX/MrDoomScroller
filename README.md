# MrDoomScroller

Counts the short-form videos you scroll past — Instagram Reels, YouTube Shorts,
TikTok, Facebook Reels, Snapchat Spotlight — and puts that number where you cannot
avoid it: floating over the feed while you scroll, and on your home screen when you
are not.

Everything is stored on the device. No accounts, no servers, no analytics. The app
ships **without Android's `INTERNET` permission**, so it is structurally incapable of
sending your data anywhere.

Android only. See [Why not iOS](#why-not-ios).

---

## Status

| Layer | State |
| --- | --- |
| Native module, service, detector, storage, overlay, widget, limits | Written |
| TypeScript app (dashboard, onboarding, limits, history, settings, calibration) | Written, `tsc --noEmit` clean |
| Detection profiles for the five apps | **Unverified guesswork — see below** |
| Gradle / Kotlin compile | **Never run.** No JDK or Android SDK on the dev machine |
| Device testing | **Never run** |

The honest summary: the architecture and all the code are in place, and the
TypeScript half is verified. The Kotlin half has never been through a compiler, and
the detection profiles have never seen a real device. Both are the first thing to do.

## Why not iOS

No iOS API can observe an individual swipe. `DeviceActivity` reports app-level time
in coarse, opaque buckets that an app cannot read eagerly. An iOS build could show
screen time and Shield-based blocking, but never a reel count — which is the whole
product. So iOS is an explicit non-goal rather than a half-built tab.

## Two things to know before shipping

**Google Play.** Using `AccessibilityService` for anything other than assisting users
with disabilities is grounds for removal, and screen-time apps are an actively
enforced category. Plan on direct APK distribution, GitHub releases or F-Droid. A
Play listing is possible with a prominent in-app disclosure and a privacy policy, but
expect review friction. This does not affect sideloading or a demo.

**There is no unbreakable block, and the app says so.** Android strips overlays over
system dialogs, the back gesture and notification shade keep working, and the user can
always disable the accessibility service in system settings. The reliable enforcement
primitive is `GLOBAL_ACTION_HOME`; the overlay is the message, not the lock. The
limits screen states this plainly rather than overselling.

---

## Architecture

Kotlin owns all detection and all data. TypeScript owns all UI. One module boundary.

```text
┌─ TypeScript (Expo Router) ──────────────────────────────────┐
│  Dashboard · Brain State · History · Limits · Onboarding    │
│  Settings · Calibration                                     │
└──────────────▲────────────────────────────┬─────────────────┘
      events   │  (live count, limit hit)   │  function calls
               │                            ▼
┌─ Local Expo Module: doomscroll-core (Kotlin) ───────────────┐
│  DoomScrollCoreModule  JS-facing API + event emitter        │
│  CounterBus            in-process service → JS fan-out      │
│  ScrollWatchService    AccessibilityService, the observer   │
│  ReelDetector          pure state machine, 3 detection tiers│
│  NodeScanner           bounded node-tree reads              │
│  LimitEnforcer         cap → notify / nudge / home          │
│  OverlayController     floating counter (WindowManager)     │
│  BlockOverlay          full-screen limit panel              │
│  CounterWidgetProvider home-screen widget (RemoteViews)     │
│  MaintenanceWorker     retention pruning + day rollover     │
│  db/ (Room)            the only source of truth             │
└─────────────────────────────────────────────────────────────┘
```

### Why the JS layer is never in the write path

`onAccessibilityEvent` fires while the user's thumb is moving. Crossing the RN bridge
there would stutter the app being watched, and would break outright in the normal
case — the service runs with MrDoomScroller closed and no JS context alive at all. So
the service writes to Room on its own single-threaded dispatcher, and JS only reads
aggregates and subscribes to `CounterBus` for live updates while the app is open.

### Why the native code lives in the module, not in `android/`

The service declaration, permissions, layouts and `res/xml` configs are all in
`modules/doomscroll-core/android/src/main/`. Android's manifest merger folds them into
the app. This means `expo prebuild --clean` cannot destroy any of it and `android/` is
genuinely disposable generated output — unlike the usual approach of committing
`android/` and treating it as source.

---

## How counting actually works

Hardcoding `viewIdResourceName` strings is the obvious approach and the one that
breaks on every app update: Instagram and TikTok are largely custom-drawn and expose
very few stable ids. `ReelDetector` instead tries three tiers, in order of how much
each can be trusted:

1. **Adapter index.** When the scroll source reports `toIndex`/`itemCount`, a page
   change is unambiguous, and a multi-page fling is recovered exactly.
2. **Scroll delta** (API 28+). Accumulate `scrollDeltaY` and emit one advance per
   container-height crossed. Comparing horizontal against vertical movement is what
   rejects carousels.
3. **Debounced event count.** Last resort: one advance per event, rate-limited.

Before any of that, structural checks reject the three biggest sources of phantom
counts: a container covering less than ~85% of screen height (comment sheet, caption,
story tray), clearly horizontal movement (carousel, tab swipe), and an unrecognised
container class with no like/comment/share column to vouch for it.

### Counting is not gated on dwell time

An earlier design only counted a reel after ≥1.2s on screen. That is backwards: a fast
fling through twenty reels is the *worst* kind of doomscrolling and would have scored
zero. Dwell time is recorded as data — it drives the hour heatmap, the average, and
"40 reels at 3 seconds each" — but the count follows page advances.

Scrolling **back up** never counts, in any tier. Otherwise rocking a thumb up and down
would inflate the number.

### Deriving the profiles (the real first task)

`assets/detection_profiles.json` currently holds informed guesses, every one marked
`experimental: true`, and the UI surfaces that to the user. To fix a profile:

```bash
# 1. See the real node tree while a Reel is on screen
adb shell uiautomator dump /sdcard/w.xml && adb pull /sdcard/w.xml

# 2. Turn on debug logging in Settings, then watch what the detector actually sees
adb logcat -s DoomScroll/Service
```

Each scroll event logs its container class, adapter index range, deltas, height ratio
and whether the action column was found. Fit the profile to that, then confirm with
the in-app **Calibration** screen: scroll a known number of reels, type it in, read
the error. Under-counting means the surface markers or height ratio are too strict;
over-counting means something that is not a reel is slipping through, which is the
worse direction to be wrong in.

Budget realistically: Instagram and YouTube in an afternoon. TikTok, Facebook and
Snapchat are messier and are the right things to defer.

---

## Getting it running

### You need a toolchain first

Neither a JDK nor the Android SDK is installed on the machine this was written on, so
nothing Android has been compiled. Pick one:

**Local builds** — install JDK 17 and Android Studio (or just the command-line
tools), set `ANDROID_HOME`, then:

```bash
npx expo run:android                      # debug build on a connected device
npx expo run:android --variant release    # release build
```

**Cloud builds (no local toolchain)** — EAS has a free tier:

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview    # produces a sideloadable APK
```

`eas.json` is not committed yet; `eas build:configure` writes it. Use a `preview`
profile with `"android": { "buildType": "apk" }` so you get an APK rather than an AAB.

### First run on a device

1. Install and open the app. Onboarding explains the permission before asking.
2. Grant **Accessibility** → find MrDoomScroller, switch it on. Android shows a blunt
   warning here; the onboarding screen gives the honest version of what is read.
3. Grant **Draw over other apps** (optional — counting works without it, you just
   lose the floating counter).
4. Open Instagram Reels and scroll. The floating pill should increment per swipe.
5. Add the home-screen widget; it should match.

---

## Verification

What can be run without a device:

```bash
npx tsc --noEmit        # passes
npm run lint
```

What needs a JDK:

```bash
cd android && ./gradlew :doomscroll-core:test
```

`ReelDetectorTest` is the important one. The detector is a pure state machine, so
these cases are pinned down with no device: one advance per page, a three-page fling
counting three, scroll-up counting zero, comment-sheet scroll rejected on height,
carousel rejected on axis, an event burst from one gesture counting once, dwell
attributed to the reel being left, and the last reel of a session being closed out on
exit.

What needs a device, per target app:

- Scroll exactly 20 reels; compare against the counter (or use Calibration).
- Repeat with the comment sheet open, a carousel post, a Live, and the Explore grid.
  All four must count **zero**.
- Record pass/fail per app here, so the limits are documented rather than implied.

| App | Verified | Notes |
| --- | --- | --- |
| Instagram | ☐ | |
| YouTube | ☐ | |
| TikTok | ☐ | highest-risk profile |
| Facebook | ☐ | News Feed must not count as Reels |
| Snapchat | ☐ | expect under-counting |

Battery, after an hour idle with the service enabled — expect effectively zero, since
the service is scoped to five packages in `ds_accessibility_service_config.xml`:

```bash
adb shell dumpsys batterystats --charged com.mrdoomscroller.app
```

---

## Data model

| Table | Retention | Why |
| --- | --- | --- |
| `daily_stats` | forever | date, total, attributed watch time |
| `daily_app_stats` | forever | per-app daily counts, normalised by app id |
| `reel_events` | 30 days | one row per reel; powers the heatmap and dwell averages |
| `app_settings` | — | single row |

Per-app counts are a separate table rather than fixed columns because TikTok ships
under two different package names by region and both must fold into one app — and so
a sixth target app needs no migration.

Daily totals are never pruned. Only the granular event table has a retention window,
because nothing needs per-reel detail after a month.

Settings → **Export everything** hands the whole database over as JSON through the
system share sheet, so the user picks the destination.

---

## Deliberate deviations from the original plan

- **RemoteViews instead of Glance** for the widget. Glance needs the Compose compiler
  plugin inside the module, coupling the build to a specific Kotlin version — exactly
  the thing that breaks on an Expo SDK bump. The widget is a number and a label.
- **Dwell time records, it does not gate** (see above).
- **Native code in the module manifest**, not in `android/` (see above).
- **No config plugin.** The module's own manifest contributes the permissions, so
  there is nothing left for a plugin to do.
- **Session cap added** alongside the daily cap: a limit that lands while you are
  still in the habit tends to stick better than one that arrives at the end of the
  day.

## Layout

```text
src/app/            Expo Router screens
src/components/     charts (plain Views), brain state, shared UI
src/constants/      validated colour tokens — do not hand-edit a hue
src/hooks/          data + permission hooks
modules/doomscroll-core/
  src/              TypeScript API and types
  android/src/main/ Kotlin, layouts, res/xml, detection profiles
  android/src/test/ detector unit tests
```

Chart colours in `src/constants/doomscroll-theme.ts` were validated against the dark
card surface for lightness band, chroma floor, adjacent-pair colour-vision
separation, normal-vision separation and 3:1 contrast. Re-validate the set if you
change a hue.
