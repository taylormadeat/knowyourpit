import Foundation
import WatchKit

// ---------------------------------------------------------------------------
// Shared data types pushed from the phone over WCSession
// ---------------------------------------------------------------------------

struct WatchCookData: Codable {
    var id: String
    var name: String
    var status: String
    var probeTempF: Double?
    var ambientTempF: Double?
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
    var fuelType: String
}

struct WatchPitMasterInsight: Codable {
    var insight: String
    var updatedAt: Double
}

// ---------------------------------------------------------------------------
// Observable model — single source of truth for all Watch UI
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
    /// When "Ride It Out" is tapped the alert is suppressed until this date.
    private var stallSnoozedUntil: Date? = nil
    private var lastStallNotified = false

    // Fuel timer
    @Published var fuelTimer: WatchFuelTimerData = WatchFuelTimerData(
        intervalMinutes: 60, elapsedMinutes: 0, fuelType: "Apple Wood"
    )
    @Published var lastFuelReset: Date = Date()
    private var fuelTickTimer: Timer?
    private var lastFuelIntervalMinutes: Int = 60

    // PitMaster
    @Published var pitMasterInsight: String = "Ask PitMaster what to do next."
    @Published var pitMasterLoading: Bool = false
    @Published var aiResponse: String? = nil

    // ---------------------------------------------------------------------------
    // Ingestion — called by WatchSessionDelegate when phone sends new context
    // ---------------------------------------------------------------------------

    func applyContext(_ context: [String: Any]) {
        applyCook(context)
        applyStall(context)
        applyFuelTimer(context)
        applyPitMaster(context)
        applyPitMasterResponse(context)
    }

    // MARK: - Cook

    private func applyCook(_ context: [String: Any]) {
        guard let cookDict = context["cook"] as? [String: Any],
              let cookJSON = try? JSONSerialization.data(withJSONObject: cookDict),
              let decoded = try? JSONDecoder().decode(WatchCookData.self, from: cookJSON) else {
            if context["cook"] is NSNull { cook = nil }
            return
        }

        let prevProbeTemp = cook?.probeTempF
        cook = decoded
        lastUpdated = Date()

        // Haptic: probe reached target temp
        if let probe = decoded.probeTempF,
           let target = decoded.targetTempF,
           probe >= target,
           let prev = prevProbeTemp, prev < target {
            WKInterfaceDevice.current().play(.notification)
        }
    }

    // MARK: - Stall

    private func applyStall(_ context: [String: Any]) {
        guard let stallDict = context["stall"] as? [String: Any],
              let stallJSON = try? JSONSerialization.data(withJSONObject: stallDict),
              let decoded = try? JSONDecoder().decode(WatchStallData.self, from: stallJSON) else { return }

        let wasStalled = stall.isStalled

        // Honour snooze: if snoozed, treat as not stalled
        if let snoozeUntil = stallSnoozedUntil, Date() < snoozeUntil {
            var muted = decoded
            muted.isStalled = false
            stall = muted
            lastStallNotified = false
            return
        } else {
            stallSnoozedUntil = nil
        }

        stall = decoded

        // Haptic: newly entered stall
        if decoded.isStalled && !wasStalled && !lastStallNotified {
            WKInterfaceDevice.current().play(.directionUp)
            lastStallNotified = true
        } else if !decoded.isStalled {
            lastStallNotified = false
        }
    }

    // MARK: - Fuel timer

    private func applyFuelTimer(_ context: [String: Any]) {
        guard let fuelDict = context["fuelTimer"] as? [String: Any],
              let fuelJSON = try? JSONSerialization.data(withJSONObject: fuelDict),
              let decoded = try? JSONDecoder().decode(WatchFuelTimerData.self, from: fuelJSON) else { return }

        if decoded.intervalMinutes != lastFuelIntervalMinutes {
            lastFuelIntervalMinutes = decoded.intervalMinutes
            lastFuelReset = Date()
            startFuelTick(interval: decoded.intervalMinutes)
        }
        fuelTimer = decoded
    }

    // MARK: - PitMaster insight

    private func applyPitMaster(_ context: [String: Any]) {
        guard let insightDict = context["pitMaster"] as? [String: Any],
              let insightJSON = try? JSONSerialization.data(withJSONObject: insightDict),
              let decoded = try? JSONDecoder().decode(WatchPitMasterInsight.self, from: insightJSON) else { return }
        pitMasterInsight = decoded.insight
    }

    // MARK: - PitMaster response (action reply from phone)

    func applyPitMasterResponse(_ context: [String: Any]) {
        guard let action = context["action"] as? String, action == "pitMasterResponse",
              let response = context["response"] as? String else { return }
        aiResponse = response
        pitMasterLoading = false
    }

    // ---------------------------------------------------------------------------
    // Fuel tick — runs locally so the ring animates without phoning home
    // ---------------------------------------------------------------------------

    func startFuelTick(interval: Int) {
        fuelTickTimer?.invalidate()
        fuelTickTimer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            Task { @MainActor in
                let elapsed = Int(Date().timeIntervalSince(self.lastFuelReset) / 60)
                let hitLimit = elapsed >= self.fuelTimer.intervalMinutes

                self.fuelTimer = WatchFuelTimerData(
                    intervalMinutes: self.fuelTimer.intervalMinutes,
                    elapsedMinutes: min(elapsed, self.fuelTimer.intervalMinutes),
                    fuelType: self.fuelTimer.fuelType
                )

                // Haptic: fuel timer expired (at the exact minute boundary)
                if hitLimit && elapsed == self.fuelTimer.intervalMinutes {
                    WKInterfaceDevice.current().play(.click)
                }
            }
        }
    }

    // ---------------------------------------------------------------------------
    // Public actions
    // ---------------------------------------------------------------------------

    func resetFuelTimer() {
        lastFuelReset = Date()
        fuelTimer = WatchFuelTimerData(
            intervalMinutes: fuelTimer.intervalMinutes,
            elapsedMinutes: 0,
            fuelType: fuelTimer.fuelType
        )
    }

    /// Snooze stall alerts for 20 minutes ("Ride It Out").
    func snoozeStall() {
        stallSnoozedUntil = Date().addingTimeInterval(20 * 60)
        var muted = stall
        muted.isStalled = false
        stall = muted
        lastStallNotified = false
    }

    // ---------------------------------------------------------------------------
    // Computed helpers for UI
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
        guard let ms = cook?.elapsedMs, ms > 0 else { return "--" }
        let totalMins = Int(ms / 60_000)
        let hrs = totalMins / 60
        let mins = totalMins % 60
        return hrs > 0 ? "\(hrs)h \(mins)m" : "\(mins)m"
    }

    func remainingString() -> String {
        guard let ms = cook?.estimatedRemainingMs, ms > 0 else { return "--" }
        let totalMins = Int(ms / 60_000)
        let hrs = totalMins / 60
        let mins = totalMins % 60
        return hrs > 0 ? "~\(hrs)h \(mins)m" : "~\(mins)m"
    }
}
