import SwiftUI

// ---------------------------------------------------------------------------
// Root tab navigation for the Watch app.
// Swipe horizontally to move between the 5 screens.
// ---------------------------------------------------------------------------

struct ContentView: View {
    @EnvironmentObject var model: WatchDataModel

    var body: some View {
        TabView {
            ActiveCookView()
            CookControlView()
            PitMasterView()
            StallAlertView()
            FuelTimerView()
        }
        .tabViewStyle(.page)
        .environmentObject(model)
    }
}
