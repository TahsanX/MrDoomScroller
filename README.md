# ScrollWise

**Ellie counts the reels.**

ScrollWise counts the short-form videos you scroll past — Instagram Reels, YouTube Shorts,
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
| Detection profiles for the five apps | View ids taken from a shipped competitor APK; **not yet confirmed on a device** |
| Gradle / Kotlin compile | **Never run locally.** No JDK or Android SDK on the dev machine; EAS builds it |
| Device testing | One round done. Accuracy was under 30%; detection has since been rebuilt |

The honest summary: the TypeScript half is verified by `tsc` and ESLint, and the
counting rules are pure functions with unit tests. The Kotlin has never been through
a compiler on this machine, and the rebuilt detection has not yet been measured on a
device. The in-app **Calibration** screen exists to measure exactly that.

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
┌─ Local Expo Module: scrollwise-core (Kotlin) ───────────────┐
│  ScrollWiseCoreModule  JS-facing API + event emitter        │
│  CounterBus            in-process service → JS fan-out      │
│  ScrollWatchService    AccessibilityService; schedules looks│
│  PagerProbe            reads the screen: feed? which reel?  │
│  ReelCounter           pure state machine: new / same / seen│
│  Fingerprint           anonymous per-reel identity (hashed) │
│  AdDetector            sponsored markers                    │
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
case — the service runs with ScrollWise closed and no JS context alive at all. So
the service writes to Room on its own single-threaded dispatcher, and JS only reads
aggregates and subscribes to `CounterBus` for live updates while the app is open.

### Why the native code lives in the module, not in `android/`

The service declaration, permissions, layouts and `res/xml` configs are all in
`modules/scrollwise-core/android/src/main/`. Android's manifest merger folds them into
the app. This means `expo prebuild --clean` cannot destroy any of it and `android/` is
genuinely disposable generated output — unlike the usual approach of committing
`android/` and treating it as source.

---

## How counting actually works

### The approach that failed

The first version counted `TYPE_VIEW_SCROLLED` events, inferring page changes from
adapter indices and scroll deltas. On a device it scored **under 30%**, and the three
failures were all structural rather than tuning problems:

- **Profile scrolling counted as reels.** "Am I on a reel feed?" was decided on window
  events. Instagram sends none when you switch tabs, so opening a creator's profile
  from Reels left the feed "open" and every post scrolled past was counted.
- **The same reel counted repeatedly.** Nothing identified *which* reel was on screen,
  so a bounce-back swipe, a comment sheet or a like tap all looked like movement.
- **Indices and deltas are not trustworthy.** Instagram and TikTok report them
  inconsistently, and one swipe emits a burst of events.

### What replaced it

Accessibility events are now only a signal for **when to look**, never evidence of
what happened. Each settled look (`PagerProbe`) answers two questions from the live
screen, and `ReelCounter` decides from the answers.

**1. Is the short-form feed on screen?** Three mechanisms, in order:

- a visible node with one of the app's **surface ids** (`clips_viewer_view_pager`,
  `reel_recycler`, …);
- else the **geometry**: the innermost full-screen scrollable is a vertical pager
  whose visible pages are each the height of the pager. A home feed's posts, a profile
  grid's rows and a comment list all fail that shape;
- else an **edge action column**: three or more like/comment/share buttons stacked
  vertically in the outer quarter of the screen. A feed post lays the same buttons out
  in a row, so it does not match.

There is no separate "profile detector" — a profile satisfies none of these, so it
simply never counts.

**2. Is this a reel we have not just seen?** `Fingerprint` reduces the reel's labels
(author, caption) to a short hash. Digits are stripped, so a like count ticking from
12.3K to 12.4K does not change it; action words are stripped, so tapping Like
("Like" → "Unlike") does not either. The counter then classifies the hash as **new**,
**the same one**, or **seen recently** (a 30-minute window), and counts only the first.
That single comparison is what fixes bounce-backs, rewatches and comment sheets at once.

A comment sheet or snackbar (`pauseIds`) suspends the probe outright: nothing about the
current reel has changed, and scrolling the comments must not read as a swipe.

This is the same shape the established counters on the Play Store use. BrainRot's
`ReelsAccessibilityService` logs its decisions as `New scroll:` / `Recently counted,
skipping:` — one identity, three outcomes.

### Dwell time records, it does not gate

A fast fling through twenty reels is the *worst* kind of scrollwiseing, so counting is
never gated on watch time. Dwell is recorded as data — it drives the hour heatmap and
the per-reel average — with one exception: the reel already on screen when you *arrive*
must stay there ~750ms before it counts, so passing through the Reels tab on the way
somewhere else counts nothing.

Scrolling **back up** never counts. Otherwise rocking a thumb up and down would inflate
the number.

### Ads

Sponsored reels are counted like any other — swiping past one is still a swipe — but
tagged, so the dashboard can show how many of the day's reels were ads. Detection is on
whole labels, not words inside a caption: `Sponsored Reel by …` (Instagram), a bare
`Ad` badge (YouTube), `Sponsored` / `Paid partnership` (Facebook), and the fixed
call-to-action button labels every platform's ads carry.

### Privacy

The labels exist only inside `Fingerprint.of()` and are hashed before it returns.
Nothing readable is stored, logged or transmitted — debug logging prints the *reason*
and the first six characters of the hash, never the text. Combined with the absent
`INTERNET` permission, there is no path by which a caption could leave the device.

Bangla is handled explicitly: its vowel signs are combining marks, and treating them as
word separators would shred every Bangla caption into fragments. Bangla control words
and count words (হাজার, লাখ) are stripped like their English equivalents.

### Tuning a profile

`assets/detection_profiles.json` holds the view ids, read from BrainRot 21.0.632's
shipped APK, plus geometry thresholds. Every profile is marked `experimental: true`
until confirmed on a device, and the UI tells the user so. To re-tune one:

```bash
# 1. See the real node tree while a Reel is on screen
adb shell uiautomator dump /sdcard/w.xml && adb pull /sdcard/w.xml

# 2. Turn on debug logging in Settings, then watch what the probe concludes
adb logcat -s ScrollWise/Service
```

Each probe logs how the feed was recognised (`id`, `shape:p1/o0`, `action-column`) or
why it was not, the label count, and a hash prefix. Then confirm with the in-app
**Calibration** screen: scroll a known number of reels, type it in, read the error.
Under-counting means the surface test is too strict; over-counting means something that
is not a reel is getting through, which is the worse direction to be wrong in.

---

## Ellie

The mascot, and the app's voice. A cat, drawn in `react-native-svg` rather than
imported: a mood changes her shapes — eyes, brows, ear angle, mouth — instead of
swapping an asset, which is why she can blink, why every mood is free, and why she
adds nothing measurable to the APK.

### She talks without a model

`src/lib/ellie.ts` is a pure function over the user's own numbers. No network, no
LLM, nothing on device pretending to be one.

The rule that matters: **every line must be earned by the data.** Each rule returns
`null` rather than a fallback string, so Ellie can only say things the counts
actually support. The tests check the negative case for every rule — that it stays
silent when its condition does not hold — because her telling someone something
their numbers do not say would be worse than her saying nothing.

What she can notice: how today sits against the cap, the hour most of it happens in,
which app dominates, how many of today's reels were ads, how fast the pace is, how
today compares to yesterday and to the week's average, and a streak under the limit.

Asking her is a sheet of tap-to-ask chips, not a text box. A text box would promise
a conversation the app cannot have; the chips say exactly what she can answer.

This is the reason the app still ships with **no `INTERNET` permission**. A cloud
chatbot would have demoed better and would have cost the one claim the project
actually makes.

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
2. Grant **Accessibility** → find ScrollWise, switch it on. Android shows a blunt
   warning here; the onboarding screen gives the honest version of what is read.
3. Grant **Draw over other apps** (optional — counting works without it, you just
   lose the floating counter).
4. Open Instagram Reels and scroll. The floating pill should increment per swipe.
5. Add the home-screen widget; it should match.

---

## Verification

What can be run without a device:

```bash
npm run typecheck   # app and tests, separately
npm run lint
npm test            # 18 tests over Ellie's rules
```

What needs a JDK:

```bash
cd android && ./gradlew :scrollwise-core:test
```

`ReelCounterTest` is the important one. The counter is a pure state machine, so
these cases are pinned down with no device: each new reel counting once, the same reel
seen again counting zero, scrolling back to an earlier reel counting zero, labels
changing on their own (auto-captions) counting zero, a profile scroll counting zero,
leaving Reels closing the sitting immediately, passing through Reels in under 750ms
counting zero, and dwell attributed to the reel being left.

`FingerprintTest` covers the identity rules: like counts ticking up, tapping Like,
relative timestamps and label order must all leave the hash unchanged, while a
different creator must change it. `AdDetectorTest` covers sponsored markers versus a
caption that merely mentions ads.

What needs a device, per target app:

- Scroll exactly 20 reels; compare against the counter (or use Calibration).
- **Open a creator's profile from Reels and scroll their posts top to bottom.** This
  is the failure that made the first version unusable; it must count **zero**.
- Repeat with the comment sheet open, a carousel post, a Live, and the Explore grid.
  All must count **zero**.
- Swipe back up to a reel already counted — the number must not move.
- Record pass/fail per app here, so the limits are documented rather than implied.

| App | Verified | Notes |
| --- | --- | --- |
| Instagram | ☐ | surface + pause + identity ids all known |
| YouTube | ☐ | `reel_recycler`; the ordinary player must not count |
| TikTok | ☐ | highest risk: ids are obfuscated per build |
| Facebook | ☐ | no ids; relies on the edge action column. News Feed must count zero |
| Snapchat | ☐ | expect under-counting; little is exposed to accessibility |

Battery, after an hour idle with the service enabled — expect effectively zero, since
the service is scoped to five packages in `sw_accessibility_service_config.xml`:

```bash
adb shell dumpsys batterystats --charged com.scrollwise.app
```

---

## Data model

| Table | Retention | Why |
| --- | --- | --- |
| `daily_stats` | forever | date, total, ad count, attributed watch time |
| `daily_app_stats` | forever | per-app daily counts, normalised by app id |
| `reel_events` | 30 days | one row per reel (with its ad flag); powers the heatmap and dwell averages |
| `app_settings` | — | single row |

Per-app counts are a separate table rather than fixed columns because TikTok ships
under two different package names by region and both must fold into one app — and so
a sixth target app needs no migration.

Daily totals are never pruned. Only the granular event table has a retention window,
because nothing needs per-reel detail after a month.

Schema version 2 added the ad columns. The migration is additive (`ALTER TABLE … ADD
COLUMN … DEFAULT 0`), so a user who has been counting for weeks keeps that history
across the update rather than losing it to a destructive rebuild.

Reel fingerprints are **not** a table. They live in memory, bounded to 300 entries and
30 minutes, and die with the service — long enough to recognise a rewatch, short enough
that nothing accumulates.

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
- **Detection rebuilt around screen state**, not scroll events, after the first
  device test (see *How counting actually works*). The plan's three-tier scroll-event
  detector is gone.
- **The floating counter can be dismissed by dragging it onto an ✕**, for the rest of
  the sitting. Turning it off permanently stays a setting, so an accidental drop never
  silently loses it.

## Layout

```text
src/app/(tabs)/     Today · Insights · Limits · Settings
src/app/            onboarding, calibration, the Ellie sheet
src/components/     Ellie, charts, tab icons, shared UI
src/constants/      tokens: validated colours, type ramp, radii, motion
src/hooks/          data, permissions, and Ellie's view of them
src/lib/ellie.ts    what Ellie says, and its tests
modules/scrollwise-core/
  src/              TypeScript API and types
  android/src/main/ Kotlin, layouts, res/xml, detection profiles
  android/src/test/ counter, fingerprint and ad-detector unit tests
```

Chart colours in `src/constants/scrollwise-theme.ts` were validated against the dark
card surface for lightness band, chroma floor, adjacent-pair colour-vision
separation, normal-vision separation and 3:1 contrast. Re-validate the set if you
change a hue.

---

## Where the detection design came from

The rebuilt detection follows the shape used by BrainRot 21.0.632
(`com.brainrot.android`), read from its shipped APK with androguard after the first
device test showed under-30% accuracy. What that established which this project had
guessed wrong:

- its `ReelsAccessibilityService` never counts an accessibility event — it reads the
  screen, derives a per-reel identity, and classifies it as new / same / recently
  counted (its own log lines are `New scroll:` and `Recently counted, skipping:`);
- the view ids each app actually exposes, including the comment-sheet and snackbar
  ids that must *pause* counting rather than end the sitting;
- that ads are identified by whole-label markers and a fixed set of call-to-action
  button labels, not by keywords inside captions;
- that the like/comment/share labels need translating for a non-English phone — it
  ships those words in some eighty languages.

The implementation here is this project's own: the fingerprint, the hashing, the
geometric and action-column fallbacks, and the arrival rule are not copied from it.
