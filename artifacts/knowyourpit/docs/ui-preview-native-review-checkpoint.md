# Preview UI native review checkpoint

**Baseline date:** August 26, 2026  
**Artifact:** iOS simulator development build  
**EAS build:** `55d8bc0c-6823-491a-8d46-33af62151543`  
**Build page:** https://expo.dev/accounts/taylormadeat/projects/knowyourpit/builds/55d8bc0c-6823-491a-8d46-33af62151543

This is the first native review artifact for the redesigned **Preview Mode**.
It is not an OTA update, store build, submission, or release.

## How to enter Preview Mode

1. Open **More**.
2. Scroll to **App Experience**.
3. Turn on **Preview Mode**.

The setting is stored device-wide and remains selected across sign-out and
subsequent launches. Legacy remains the default until Preview is approved.

## Acceptance matrix

| Area | Native review target | Automated/build evidence | Checkpoint status |
| --- | --- | --- | --- |
| Launch and hydration | Cold launch, stalled storage fallback, relaunch persistence | Legacy default plus stored, rejected, and stalled AsyncStorage cases are covered by Jest | Ready for hands-on review |
| Authentication and onboarding | Sign in, onboarding, name prompt, sign out safely | Preview shares the existing auth shell and Home modal paths | Ready for hands-on review |
| Home | Free/trial/Pro, empty/populated, active and upcoming cooks, score, tips, recent cooks, partner card | Preview changes only the hero/actions; behavior-rich sections remain shared with Legacy | Ready for hands-on review |
| Plan | Keyboard entry, single/multi/frozen branches, loading, retry, paywall-adjacent states | Existing planner handlers are shared; planner regression suites pass | Ready for hands-on review |
| Live cook | Start, check-ins, temperature chips, edit times, completion/destructive actions | Cook-detail and temperature/check-in suites pass; Preview is presentation-only | Ready for hands-on review |
| Cook Log | Empty/populated, filters, sessions, edits, deletes, tablet columns | Existing history/session logic remains shared; Preview adds hierarchy and surfaces | Ready for hands-on review |
| PitMaster | Entry, prompt, stream/loading, recoverable errors, free/Pro gates | Existing routes and generated API hooks remain unchanged | Ready for hands-on review |
| Grills and devices | Browse, add/edit, link hardware, permission/error states | Existing behavior and routes remain unchanged | Ready for hands-on review |
| Pro and restore | Feature showcase, purchase-adjacent gates, restore state | RevenueCat behavior is unchanged; native simulator build completed | Ready for hands-on review |
| Accessibility | Safe areas, Dynamic Type, VoiceOver focus/order, 44–48pt targets, contrast | New switch/actions expose roles, labels, hints, state, and 48pt action height | Ready for hands-on review |
| Phone and tablet | Standard iPhone and iPad layouts | App supports iPad and the simulator build compiled for iOS | Ready for hands-on review |
| Screenshot set | Current Preview Home, Plan, Log, grills, PitMaster, Pro | Maestro entry point now enables Preview before capture | Capture not run in Linux workspace |

## Completed verification

- Full workspace TypeScript check passes.
- Mobile Jest passes: **29 suites, 976 tests**.
- Preview state tests cover Legacy default, stored Preview, persistence, rejected
  storage, and stalled storage timeout.
- Shared Preview primitive tests cover surfaces, empty states, section headings,
  and accessible actions.
- Final architecture review passed for functional parity, Legacy preservation,
  provider safety, visual differentiation, and accessibility.
- EAS produced the reviewable iOS simulator artifact from the actual Expo app.
- `git diff --check` passes.

## Native review limitations

This Replit workspace is Linux and cannot boot Xcode Simulator, run Maestro
against iOS, or perform VoiceOver/Dynamic Type inspection. Browser rendering was
not used as approval evidence. The build and capture automation are ready, but
the hands-on iPhone/iPad flow pass and refreshed PNG outputs must be executed on
a macOS simulator runner or device before release approval.

## Review boundary

Feedback from this artifact should be scoped as visual iteration against
Preview Mode. Backend, authentication, purchase, cook, and hardware behavior
remain shared with Legacy and should only change if native review identifies a
regression.