import Foundation
import Combine

// ---------------------------------------------------------------------------
// Shared data types pushed from the phone over WCSession
// ---------------------------------------------------------------------------

struct WatchCookData: Codable {
    var id: String
    var name: String
    var status: String          // "active" | "planned" | "completed"
    var probeTempF: Double?     // MEATER internal temp
    var ambientTempF: Double?   // MEATER ambient (grill temp)
    var targetTempF: Double?
    var elapsedMs: Double?
    var estimatedRemainingMs: Double?
}

struct WatchStallData: Codable {
    var isStalled: Bool
    var stalledForMinutes: Int
    var probeTempF: Double
    var targetTempF: Double
}

struct WatchFuelTimerData: Codable {
    var intervalMinutes: Int
    var elapsedMinutes: Int
    var fuelType: String        // e.g. "Apple Wood", "Charcoal"
}

struct WatchPitMasterInsight: Codable {
    var insight: String
    var updatedAt: Double       // Unix timestamp ms
}

// ---------------------------------------------------------------------------
// Observable model — the single source of truth for all Watch UI
// ---------------------------------------------------------------------------

@MainActor
final class WatchDataModel: ObservableObject {

    // Cook
    @Published var cook: WatchCookData? = nil
    @Published var lastUpdated: Date? = nil

    // Stall
    @Published var stall: WatchStallData = WatchStallData(
        isStalled: false, stalledForMinutes: 0, probeTempF: 0, targetTempF: 0
    )

    // Fuel timer
    @Published var fuelTimer: WatchFuelTimerData = WatchFuelTimerData(
        intervalMinutes: 60, elapsedMinutes: 0, fuelType: "Apple Wood"
    )
    @Published var lastFuelReset: Date = Date()
    private var fuelTickTimer: Timer?

    // PitMaster
    @Published var pitMasterInsight: String = "Ask PitMaster what to do next."
    @Published var pitMasterLoading: Bool = false

    // AI response from dictation
    @Published var aiResponse: String? = nil

    // ---------------------------------------------------------------------------
    // Ingestion — called by WatchSessionDelegate when phone sends context
    // ---------------------------------------------------------------------------

    func applyContext(_ context: [String: Any]) {
        if let cookJSON = context["cook"] as? Data,
           let decoded = try? JSONDecoder().decode(WatchCookData.self, from: cookJSON) {
            cook = decoded
            lastUpdated = Date()
        } else if let cookDict = context["cook"] as? [String: Any],
                  let cookJSON = try? JSONSerialization.data(withJSONObject: cookDict),
                  let decoded = try? JSONDecoder().decode(WatchCookData.self, from: cookJSON) {
            cook = decoded
            lastUpdated = Date()
        }

        if let stallDict = context["stall"] as? [String: Any],
           let stallJSON = try? JSONSerialization.data(withJSONObject: stallDict),
           let decoded = try? JSONDecoder().decode(WatchStallData.self, from: stallJSON) {
            stall = decoded
        }

        if let fuelDict = context["fuelTimer"] as? [String: Any],
           let fuelJSON = try? JSONSerialization.data(withJSONObject: fuelDict),
           let decoded = try? JSONDecoder().decode(WatchFuelTimerData.self, from: fuelJSON) {
            // Only reset the tick timer if interval changed
            if decoded.intervalMinutes != fuelTimer.intervalMinutes {
                lastFuelReset = Date()
                startFuelTick(interval: decoded.intervalMinutes)
            }
            fuelTimer = decoded
        }

        if let insightDict = context["pitMaster"] as? [String: Any],
           let insightJSON = try? JSONSerialization.data(withJSONObject: insightDict),
           let decoded = try? JSONDecoder().decode(WatchPitMasterInsight.self, from: insightJSON) {
            pitMasterInsight = decoded.insight
        }
    }

    // ---------------------------------------------------------------------------
    // Fuel tick — runs locally on the Watch so the ring animates without phone
    // ---------------------------------------------------------------------------

    func startFuelTick(interval: Int) {
        fuelTickTimer?.invalidate()
        fuelTickTimer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            Task { @MainActor in
                let elapsed = Int(Date().timeIntervalSince(self.lastFuelReset) / 60)
                self.fuelTimer = WatchFuelTimerData(
                    intervalMinutes: self.fuelTimer.intervalMinutes,
                    elapsedMinutes: min(elapsed, self.fuelTimer.intervalMinutes),
                    fuelType: self.fuelTimer.fuelType
                )
            }
        }
    }

    func resetFuelTimer() {
        lastFuelReset = Date()
        fuelTimer = WatchFuelTimerData(
            intervalMinutes: fuelTimer.intervalMinutes,
            elapsedMinutes: 0,
            fuelType: fuelTimer.fuelType
        )
    }

    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------

    var fuelProgress: Double {
        guard fuelTimer.intervalMinutes > 0 else { return 0 }
        let elapsed = Int(Date().timeIntervalSince(lastFuelReset) / 60)
        return min(Double(elapsed) / Double(fuelTimer.intervalMinutes), 1.0)
    }

    var fuelMinutesRemaining: Int {
        let elapsed = Int(Date().timeIntervalSince(lastFuelReset) / 60)
        return max(fuelTimer.intervalMinutes - elapsed, 0)
    }

    func elapsedString() -> String {
        guard let ms = cook?.elapsedMs else { return "--" }
        let totalMins = Int(ms / 60000)
        let hrs = totalMins / 60
        let mins = totalMins % 60
        if hrs > 0 { return "\(hrs)h \(mins)m" }
        return "\(mins)m"
    }

    func remainingString() -> String {
        guard let ms = cook?.estimatedRemainingMs, ms > 0 else { return "--" }
        let totalMins = Int(ms / 60000)
        let hrs = totalMins / 60
        let mins = totalMins % 60
        if hrs > 0 { return "~\(hrs)h \(mins)m" }
        return "~\(mins)m"
    }
}
