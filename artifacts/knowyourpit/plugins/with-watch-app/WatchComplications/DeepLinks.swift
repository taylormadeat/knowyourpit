// Deep-link URL scheme used when routing from the complication to the Watch app.
// Must be kept in sync with WatchExtension/DeepLinks.swift.
// These are separate binaries so the constant is duplicated intentionally.
enum WatchDeepLink {
    static let activeCook = URL(string: "knowyourpit://active-cook")!

    static func isActiveCook(_ url: URL) -> Bool {
        url.scheme == "knowyourpit" && url.host == "active-cook"
    }
}
