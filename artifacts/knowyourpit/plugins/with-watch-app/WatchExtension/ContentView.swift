import SwiftUI

struct ContentView: View {
    @EnvironmentObject var model: WatchDataModel
    @Binding var selectedTab: Int

    var body: some View {
        TabView(selection: $selectedTab) {
            ActiveCookView()
                .tag(0)
            CookControlView()
                .tag(1)
            PitMasterView()
                .tag(2)
            StallAlertView()
                .tag(3)
            FuelTimerView()
                .tag(4)
        }
        .tabViewStyle(.page)
        .environmentObject(model)
    }
}
