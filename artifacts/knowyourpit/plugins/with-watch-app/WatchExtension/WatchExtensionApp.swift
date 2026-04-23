import SwiftUI

@main
struct KnowYourPitWatchApp: App {

    @StateObject private var model: WatchDataModel
    @StateObject private var session: WatchSessionDelegate
    @State private var selectedTab: Int = 0

    init() {
        let m = WatchDataModel()
        _model = StateObject(wrappedValue: m)
        _session = StateObject(wrappedValue: WatchSessionDelegate(model: m))
    }

    var body: some Scene {
        WindowGroup {
            ContentView(selectedTab: $selectedTab)
                .environmentObject(model)
                .onOpenURL { url in
                    // Complication tap delivers knowyourpit://active-cook.
                    // Route to ActiveCookView (tab 0) regardless of cook state;
                    // ActiveCookView handles the no-cook fallback itself.
                    if WatchDeepLink.isActiveCook(url) {
                        selectedTab = 0
                    }
                }
        }
    }
}
