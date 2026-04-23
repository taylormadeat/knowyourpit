// WidgetKit complications require watchOS 9.0+.
// The Complication Widget Extension target (KnowYourPitComplications) sets
// WATCHOS_DEPLOYMENT_TARGET = 9.0 accordingly.
// Devices running watchOS 7–8 will not see this complication on their watch face.
import SwiftUI
import WidgetKit

// ---------------------------------------------------------------------------
// MARK: - App Group constants (must match WatchDataModel)
// ---------------------------------------------------------------------------

private let kSuiteName = "group.com.knowyourpit.app"
private let kCookKey   = "kyp_complication_cook"

// ---------------------------------------------------------------------------
// MARK: - Snapshot type (mirrors the struct in WatchDataModel)
// ---------------------------------------------------------------------------

private struct ComplicationSnapshot: Codable {
    var cookName: String?
    var probeTempF: Double?
    var targetTempF: Double?
    var estimatedRemainingMs: Double?
}

private func loadSnapshot() -> ComplicationSnapshot {
    guard
        let defaults = UserDefaults(suiteName: kSuiteName),
        let data = defaults.data(forKey: kCookKey),
        let snap = try? JSONDecoder().decode(ComplicationSnapshot.self, from: data)
    else { return ComplicationSnapshot() }
    return snap
}

// ---------------------------------------------------------------------------
// MARK: - Timeline entry
// ---------------------------------------------------------------------------

struct ProbeTempEntry: TimelineEntry {
    var date: Date
    var cookName: String?
    var probeTempF: Double?
    var targetTempF: Double?
    var estimatedRemainingMs: Double?
}

// ---------------------------------------------------------------------------
// MARK: - Timeline provider  (15-minute background refresh)
// ---------------------------------------------------------------------------

struct ProbeTempProvider: TimelineProvider {
    func placeholder(in context: Context) -> ProbeTempEntry {
        ProbeTempEntry(
            date: Date(),
            cookName: "Brisket",
            probeTempF: 165,
            targetTempF: 203,
            estimatedRemainingMs: 5_400_000
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (ProbeTempEntry) -> Void) {
        let snap = loadSnapshot()
        completion(ProbeTempEntry(
            date: Date(),
            cookName: snap.cookName,
            probeTempF: snap.probeTempF,
            targetTempF: snap.targetTempF,
            estimatedRemainingMs: snap.estimatedRemainingMs
        ))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ProbeTempEntry>) -> Void) {
        let snap = loadSnapshot()
        let entry = ProbeTempEntry(
            date: Date(),
            cookName: snap.cookName,
            probeTempF: snap.probeTempF,
            targetTempF: snap.targetTempF,
            estimatedRemainingMs: snap.estimatedRemainingMs
        )
        let nextRefresh = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
    }
}

// ---------------------------------------------------------------------------
// MARK: - Shared formatting helpers
// ---------------------------------------------------------------------------

private func formatTemp(_ f: Double?) -> String {
    guard let f else { return "--" }
    return "\(Int(f.rounded()))°"
}

private func formatTempFull(_ f: Double?) -> String {
    guard let f else { return "--°F" }
    return "\(Int(f.rounded()))°F"
}

private func cookProgress(probe: Double?, target: Double?) -> Double {
    guard let p = probe, let t = target, t > 0 else { return 0 }
    return min(p / t, 1.0)
}

private func formatRemaining(_ ms: Double?) -> String {
    guard let ms, ms > 0 else { return "-- remaining" }
    let mins = Int(ms / 60_000)
    return mins >= 60 ? "~\(mins / 60)h \(mins % 60)m left" : "~\(mins)m left"
}

// ---------------------------------------------------------------------------
// MARK: - Complication views
// ---------------------------------------------------------------------------

struct CircularComplicationView: View {
    let entry: ProbeTempEntry

    var body: some View {
        Gauge(value: cookProgress(probe: entry.probeTempF, target: entry.targetTempF)) {
            Image(systemName: "flame.fill").foregroundStyle(.orange)
        } currentValueLabel: {
            Text(formatTemp(entry.probeTempF))
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .minimumScaleFactor(0.6)
        }
        .gaugeStyle(.accessoryCircular)
        .tint(Gradient(colors: [.orange, .red]))
    }
}

struct RectangularComplicationView: View {
    let entry: ProbeTempEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 4) {
                Image(systemName: "thermometer.medium")
                    .foregroundStyle(.orange)
                    .font(.caption2)
                Text(entry.cookName ?? "Cook")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Text(formatTempFull(entry.probeTempF))
                .font(.system(size: 18, weight: .bold, design: .rounded))
            ProgressView(value: cookProgress(probe: entry.probeTempF, target: entry.targetTempF))
                .tint(.orange)
            Text(formatRemaining(entry.estimatedRemainingMs))
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }
}

struct CornerComplicationView: View {
    let entry: ProbeTempEntry

    var body: some View {
        Gauge(
            value: cookProgress(probe: entry.probeTempF, target: entry.targetTempF)
        ) {
            Image(systemName: "flame.fill")
        } currentValueLabel: {
            Text(formatTemp(entry.probeTempF))
        } minimumValueLabel: {
            Text("0")
        } maximumValueLabel: {
            Text("\(Int((entry.targetTempF ?? 203).rounded()))")
        }
        .gaugeStyle(.accessoryCircular)
        .tint(Gradient(colors: [.yellow, .orange, .red]))
    }
}

struct InlineComplicationView: View {
    let entry: ProbeTempEntry

    var body: some View {
        if let temp = entry.probeTempF {
            Label("\(Int(temp.rounded()))°F", systemImage: "flame.fill")
        } else {
            Label("No active cook", systemImage: "flame")
        }
    }
}

// ---------------------------------------------------------------------------
// MARK: - Entry view dispatcher
// ---------------------------------------------------------------------------

struct ProbeTempComplicationEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: ProbeTempEntry

    var body: some View {
        switch family {
        case .accessoryCircular:    CircularComplicationView(entry: entry)
        case .accessoryRectangular: RectangularComplicationView(entry: entry)
        case .accessoryCorner:      CornerComplicationView(entry: entry)
        case .accessoryInline:      InlineComplicationView(entry: entry)
        default:                    CircularComplicationView(entry: entry)
        }
    }
}

// ---------------------------------------------------------------------------
// MARK: - Widget
// ---------------------------------------------------------------------------

struct ProbeTempComplication: Widget {
    static let kind = "com.knowyourpit.app.ProbeTemp"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: Self.kind, provider: ProbeTempProvider()) { entry in
            ProbeTempComplicationEntryView(entry: entry)
                .widgetURL(WatchDeepLink.activeCook)
        }
        .configurationDisplayName("Probe Temp")
        .description("Current probe temperature and cook progress.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryCorner,
            .accessoryInline,
        ])
    }
}
