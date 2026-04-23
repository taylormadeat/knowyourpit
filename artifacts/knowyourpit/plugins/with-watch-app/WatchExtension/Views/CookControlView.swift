import SwiftUI
import WatchKit

struct CookControlView: View {
    @EnvironmentObject var model: WatchDataModel

    @State private var confirmingStop = false
    @State private var holdProgress: CGFloat = 0

    var body: some View {
        if let cook = model.cook {
            switch cook.status {
            case "active":
                activeControls(cook: cook)
            case "planned":
                plannedControls(cook: cook)
            default:
                noCookView()
            }
        } else {
            noCookView()
        }
    }

    @ViewBuilder
    private func activeControls(cook: WatchCookData) -> some View {
        VStack(spacing: 6) {
            VStack(alignment: .leading, spacing: 1) {
                Text("Cook in progress")
                    .font(.system(size: 8))
                    .foregroundStyle(.secondary)
                Text(cook.name)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                if let temp = cook.probeTempF, let target = cook.targetTempF {
                    Text("\(Int(temp))°F → \(Int(target))°F target")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(Color(red: 0.92, green: 0.42, blue: 0.17))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Spacer(minLength: 2)

            // Stop button — hold 2s
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color.red.opacity(0.85))

                if holdProgress > 0 {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Color.white.opacity(0.15))
                        .frame(width: (WKInterfaceDevice.current().screenBounds.width - 24) * holdProgress)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                }

                Text(confirmingStop ? "Release to stop" : "⏹  Stop Cook")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.white)
            }
            .frame(height: 40)
            .onLongPressGesture(minimumDuration: 2, maximumDistance: 10, pressing: { pressing in
                if pressing {
                    confirmingStop = true
                    withAnimation(.linear(duration: 2)) { holdProgress = 1 }
                } else {
                    confirmingStop = false
                    withAnimation(.easeOut(duration: 0.2)) { holdProgress = 0 }
                }
            }, perform: {
                WKInterfaceDevice.current().play(.success)
                WatchSessionDelegate.send(action: "stopCook", payload: ["cookId": model.cook?.id ?? ""])
                holdProgress = 0
                confirmingStop = false
            })

            // Mark done
            Button {
                WKInterfaceDevice.current().play(.click)
                WatchSessionDelegate.send(action: "markDone", payload: ["cookId": model.cook?.id ?? ""])
            } label: {
                Label("Mark Done", systemImage: "checkmark")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.green)
            }
            .buttonStyle(.plain)
            .frame(height: 32)
            .frame(maxWidth: .infinity)
            .background(Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 9))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
    }

    @ViewBuilder
    private func plannedControls(cook: WatchCookData) -> some View {
        VStack(spacing: 10) {
            Text(cook.name)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)

            Text("Planned cook ready to start")
                .font(.system(size: 9))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Button {
                WKInterfaceDevice.current().play(.success)
                WatchSessionDelegate.send(action: "startCook", payload: ["cookId": cook.id])
            } label: {
                Label("Start Cook", systemImage: "flame.fill")
                    .font(.system(size: 12, weight: .bold))
            }
            .tint(Color(red: 0.92, green: 0.42, blue: 0.17))
            .buttonStyle(.borderedProminent)
        }
        .padding(10)
    }

    @ViewBuilder
    private func noCookView() -> some View {
        VStack(spacing: 6) {
            Image(systemName: "flame.slash")
                .font(.system(size: 26, weight: .thin))
                .foregroundStyle(.secondary)
            Text("Nothing planned")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.secondary)
            Text("Open KnowYourPit on your phone to start a cook.")
                .font(.system(size: 9))
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)
        }
        .padding(10)
    }
}
