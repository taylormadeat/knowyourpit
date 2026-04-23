import SwiftUI
import WatchKit

struct StallAlertView: View {
    @EnvironmentObject var model: WatchDataModel
    @State private var actioned = false
    @State private var actionLabel = ""

    var body: some View {
        let stall = model.stall

        if actioned {
            actionedView()
        } else if stall.isStalled {
            stallActiveView(stall: stall)
        } else {
            noStallView()
        }
    }

    // MARK: - Stall active

    @ViewBuilder
    private func stallActiveView(stall: WatchStallData) -> some View {
        VStack(alignment: .leading, spacing: 0) {

            // Warning header
            HStack(spacing: 5) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(.yellow)
                    .font(.system(size: 12))
                VStack(alignment: .leading, spacing: 0) {
                    Text("Stall Detected")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.yellow)
                    Text("Flat for \(stall.stalledForMinutes) min")
                        .font(.system(size: 8))
                        .foregroundStyle(.secondary)
                }
                Spacer()
            }
            .padding(.bottom, 6)

            // Stalled temp
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(String(format: "%.0f", stall.probeTempF))
                    .font(.system(size: 34, weight: .thin))
                    .foregroundStyle(.yellow)
                Text("°F")
                    .font(.system(size: 12))
                    .foregroundStyle(.yellow)
                    .offset(y: -3)
                Spacer()
                Text("→ \(Int(stall.targetTempF))°F")
                    .font(.system(size: 9))
                    .foregroundStyle(.secondary)
            }
            .padding(.bottom, 4)

            Text("Wrap in butcher paper to push through, or ride it out.")
                .font(.system(size: 9))
                .foregroundStyle(Color.white.opacity(0.7))
                .padding(.bottom, 8)

            // Actions
            VStack(spacing: 5) {
                Button {
                    WKInterfaceDevice.current().play(.success)
                    var payload: [String: Any] = ["choice": "wrap"]
                    if let cookId = model.cook?.id { payload["cookId"] = cookId }
                    WatchSessionDelegate.send(action: "stallAction", payload: payload)
                    actionLabel = "Wrap logged ✓"
                    actioned = true
                } label: {
                    Label("Wrap It", systemImage: "newspaper.fill")
                        .font(.system(size: 11, weight: .bold))
                        .frame(maxWidth: .infinity)
                }
                .tint(.orange)
                .buttonStyle(.borderedProminent)
                .frame(height: 34)

                Button {
                    WKInterfaceDevice.current().play(.click)
                    WatchSessionDelegate.send(action: "stallAction", payload: ["choice": "ride"])
                    model.snoozeStall()
                    actionLabel = "Snoozed 20 min"
                    actioned = true
                } label: {
                    Text("Ride It Out")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.plain)
                .frame(height: 28)
                .background(Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 9))
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
    }

    // MARK: - Actioned

    @ViewBuilder
    private func actionedView() -> some View {
        VStack(spacing: 8) {
            Image(systemName: "checkmark.circle")
                .font(.system(size: 28, weight: .thin))
                .foregroundStyle(.green)
            Text(actionLabel)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.white)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - No stall

    @ViewBuilder
    private func noStallView() -> some View {
        VStack(spacing: 8) {
            Image(systemName: "thermometer.sun")
                .font(.system(size: 26, weight: .thin))
                .foregroundStyle(.green)
            Text("No Stall")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(.secondary)
            Text("Temps progressing normally")
                .font(.system(size: 9))
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
