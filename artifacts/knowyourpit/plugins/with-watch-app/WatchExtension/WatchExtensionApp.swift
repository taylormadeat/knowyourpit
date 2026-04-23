import SwiftUI

@main
struct KnowYourPitWatchApp: App {

    @StateObject private var model = WatchDataModel()
    @StateObject private var session: WatchSessionDelegate

    init() {
        let m = WatchDataModel()
        _model = StateObject(wrappedValue: m)
        _session = StateObject(wrappedValue: WatchSessionDelegate(model: m))
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(model)
        }
    }
}
