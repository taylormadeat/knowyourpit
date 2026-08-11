import ActivityKit
import SwiftUI
import WidgetKit

@available(iOS 16.1, *)
struct CookLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: CookActivityAttributes.self) { context in
            // Lock screen / banner UI
            CookLockScreenView(state: context.state, meatLabel: context.attributes.meatLabel)
                .activityBackgroundTint(Color.black.opacity(0.85))
                .activitySystemActionForegroundColor(Color.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label {
                        Text(context.attributes.meatLabel)
                            .font(.caption)
                            .foregroundColor(.white)
                    } icon: {
                        Image(systemName: "flame.fill")
                            .foregroundColor(.orange)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if let temp = context.state.currentTempF {
                        Text("\(Int(temp))°F")
                            .font(.title3)
                            .bold()
                            .foregroundColor(.orange)
                    } else {
                        Text("—")
                            .font(.title3)
                            .foregroundColor(.gray)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text(timerInterval: timerRange(state: context.state), countsDown: false)
                            .font(.caption)
                            .foregroundColor(.white)
                        Spacer()
                        if let target = context.state.targetTempF {
                            Text("Target \(Int(target))°F")
                                .font(.caption)
                                .foregroundColor(.gray)
                        }
                    }
                }
            } compactLeading: {
                Image(systemName: "flame.fill")
                    .foregroundColor(.orange)
            } compactTrailing: {
                if let temp = context.state.currentTempF {
                    Text("\(Int(temp))°")
                        .foregroundColor(.orange)
                } else {
                    Text("—").foregroundColor(.gray)
                }
            } minimal: {
                Image(systemName: "flame.fill")
                    .foregroundColor(.orange)
            }
            .keylineTint(Color.orange)
        }
    }

    private func timerRange(state: CookActivityAttributes.CookContentState) -> ClosedRange<Date> {
        let start = Date(timeIntervalSince1970: state.startedAtEpochSec)
        // Range end is just "now + a long time" — SwiftUI's
        // Text(timerInterval:) uses the start to compute the elapsed display.
        let end = start.addingTimeInterval(60 * 60 * 24)
        return start...end
    }
}

@available(iOS 16.1, *)
struct CookLockScreenView: View {
    let state: CookActivityAttributes.CookContentState
    let meatLabel: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "flame.fill")
                    .foregroundColor(.orange)
                Text(meatLabel)
                    .font(.headline)
                    .foregroundColor(.white)
                Spacer()
                Text(timerInterval: timerRange, countsDown: false)
                    .font(.subheadline)
                    .monospacedDigit()
                    .foregroundColor(.white)
            }
            HStack(spacing: 16) {
                tempCell(label: "Probe", value: state.currentTempF, accent: .orange)
                tempCell(label: "Target", value: state.targetTempF, accent: .green)
                tempCell(label: "Pit", value: state.cookTempF, accent: .blue)
            }
        }
        .padding(14)
    }

    private var timerRange: ClosedRange<Date> {
        let start = Date(timeIntervalSince1970: state.startedAtEpochSec)
        let end = start.addingTimeInterval(60 * 60 * 24)
        return start...end
    }

    @ViewBuilder
    private func tempCell(label: String, value: Double?, accent: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption2)
                .foregroundColor(.gray)
            if let v = value {
                Text("\(Int(v))°F")
                    .font(.title3)
                    .bold()
                    .foregroundColor(accent)
            } else {
                Text("—")
                    .font(.title3)
                    .foregroundColor(.gray)
            }
        }
    }
}
