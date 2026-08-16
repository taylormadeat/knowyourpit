---
name: EAS iOS hermesc requires lowered class/async syntax
description: The Pods hermes-engine hermesc on EAS macOS runners rejects ES6 classes, async arrows, for-await, and catch-param destructuring; babel must lower them.
---

EAS iOS release builds compile `main.jsbundle` with
`ios/Pods/hermes-engine/destroot/bin/hermesc` (RN 0.81). That compiler
rejects: `class` statements ("invalid statement encountered"), async
*arrow* functions and `for await` ("async functions are unsupported"),
and destructuring in catch parameters. Plain async function declarations
and generators ARE supported.

**Why:** adding loose class-property plugins top-level in babel.config.js
(done for OTA/linux-hermesc) broke babel-preset-expo's own syntax
lowering, so classes/async leaked into the bundle and three EAS builds
failed XCODE_BUILD_ERROR before diagnosis.

**How to apply:** babel.config.js keeps an inline preset (after
babel-preset-expo) with: stripTsParameterProperties (custom, must visit
`Class` like transform-classes), transform-classes,
transform-async-generator-functions, transform-destructuring,
transform-async-to-generator. Verify locally before burning EAS credits:
`npx expo export:embed ...` then compile the bundle with
`node_modules/react-native/sdks/hermesc/linux64-bin/hermesc -emit-binary`
— exit 0 there guarantees the EAS hermesc accepts it (local one is
stricter).

**Never use `loose: true`** on the class-field/private plugins: loose
emits bare `this.x = ...` assignments, which throw "Cannot assign to
read-only property" when a field shadows a read-only inherited prop
(e.g. Event's NONE getter from the event-target shim). This crashed
build 137 on launch — every fetch died before Clerk could init. Default
(non-loose) output uses Object.defineProperty — ES5-safe on any hermesc.
The pre-submission script now exports the bundle, greps for the loose
pattern, and compiles with linux hermesc before any submit.

Also: EAS `logFiles` URLs (from `eas build:view --json`) are
**brotli-compressed** plain text — decode with node
`zlib.brotliDecompressSync` to read real Xcode errors. And `curl` needs
`-g` for ASC API URLs containing `filter[app]` brackets.
