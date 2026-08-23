---
name: App Store Connect category updates
description: How to handle category changes for KnowYourPit’s App Store listing.
---

# App Store Connect Category Updates

## Rule

Set or change the App Store listing's secondary category through an update to
the parent app-info resource, then verify it in the App Store Connect web UI.

**Why:** The App Store Connect REST API rejects a direct PATCH to the
`secondaryCategory` relationship as forbidden, but accepts the same relationship
data when it is included in a PATCH to the parent app-info resource.

**How to apply:** PATCH the draft's app-info resource with
`relationships.secondaryCategory.data` set to the desired `appCategories` ID.
During final ASC review, confirm Food & Drink is primary and Utilities is
secondary.