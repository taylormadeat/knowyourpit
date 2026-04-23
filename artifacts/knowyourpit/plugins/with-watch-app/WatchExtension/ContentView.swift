import SwiftUI

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
