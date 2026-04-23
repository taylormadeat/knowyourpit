import SwiftUI
import WatchKit

// ---------------------------------------------------------------------------
// Screen 5 — Fuel / Wood Timer
// A circular progress ring counting down to the next "add fuel" reminder.
// Interval and fuel type are configured on the phone and pushed via WCSession.
// The ring animates locally on the Watch each minute without needing the phone.
// ---------------------------------------------------------------------------

struct FuelTimerView: View {
    @EnvironmentObject var model: WatchDataModel

    // Tick once per minute to animate the ring
    let timer = Timer.publish(every: 60, on: .main, in: .common).autoconnect()
    @State private var tickCount = 0

    var body: some View {
        VStack(spacing: 0) {

            // Header
            Text("Add \(model.fuelTimer.fuelType)")
                .font(.system(size: 9, weight: .medium))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .tracking(0.6)
                .padding(.bottom, 4)

            // Ring + countdown
            ZStack {
                Circle()
                    .stroke(Color.white.opacity(0.1), lineWidth: 9)

                Circle()
                    .trim(from: 0, to: model.fuelProgress)
                    .stroke(
                        Color(red: 0.92, green: 0.42, blue: 0.17),
                        style: StrokeStyle(lineWidth: 9, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .animation(.linear(duration: 0.4), value: model.fuelProgress)

                VStack(spacing: 0) {
                    Text("\(model.fuelMinutesRemaining)")
                        .font(.system(size: 34, weight: .thin))
                        .foregroundStyle(.white)
                        .monospacedDigit()
                    Text("min left")
                        .font(.system(size: 8))
                        .foregroundStyle(.secondary)
                }
            }
            .frame(width: 100, height: 100)
            .padding(.vertical, 6)

            // Every X min label
            Text("Every \(model.fuelTimer.intervalMinutes) min")
                .font(.system(size: 9))
                .foregroundStyle(.tertiary)
                .padding(.bottom, 8)

            // Reset button
            Button {
                WKInterfaceDevice.current().play(.success)
                model.resetFuelTimer()
                WatchSessionDelegate.send(action: "fuelAdded", payload: [
                    "fuelType": model.fuelTimer.fuelType,
                    "timestamp": Date().timeIntervalSince1970
                ])
            } label: {
                Label("Added — Reset", systemImage: "arrow.clockwise")
                    .font(.system(size: 11, weight: .semibold))
                    .frame(maxWidth: .infinity)
            }
            .tint(Color(red: 0.92, green: 0.42, blue: 0.17))
            .buttonStyle(.bordered)
            .frame(height: 34)
        }
        .padding(.horizontal, 10)
        .padding(.bottom, 8)
        .onReceive(timer) { _ in
            tickCount += 1
        }
    }
}
