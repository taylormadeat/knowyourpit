import Foundation
import WatchKit

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

@MainActor
final class WatchDataModel: ObservableObject {
    @Published var cook: WatchCookData? = nil
    @Published var lastUpdated: Date? = nil
    @Published var stall = WatchStallData(isStalled: false, stalledForMinutes: 0, probeTempF: 0, targetTempF: 0)
    @Published var fuelTimer = WatchFuelTimerData(intervalMinutes: 60, elapsedMinutes: 0, fuelType: "Apple Wood")
    @Published var lastFuelReset = Date()
    @Published var pitMasterInsight = "Ask PitMaster what to do next."
    @Published var pitMasterLoading = false
    @Published var aiResponse: String? = nil

    private var stallSnoozedUntil: Date? = nil
    private var lastStallNotified = false
    private var lastFuelIntervalMinutes = 60
    private var fuelTickTimer: Timer?

    func applyContext(_ context: [String: Any]) {
        applyCook(context)
        applyStall(context)
        applyFuelTimer(context)
        applyPitMaster(context)
    }

    func applyPitMasterResponse(_ context: [String: Any]) {
        guard
            let action = context["action"] as? String, action == "pitMasterResponse",
            let response = context["response"] as? String
        else { return }
        aiResponse = response
        pitMasterLoading = false
    }

    private func applyCook(_ context: [String: Any]) {
        guard
            let dict = context["cook"] as? [String: Any],
            let data = try? JSONSerialization.data(withJSONObject: dict),
            let decoded = try? JSONDecoder().decode(WatchCookData.self, from: data)
        else {
            if context["cook"] is NSNull { cook = nil }
            return
        }
        let prevProbe = cook?.probeTempF
        cook = decoded
        lastUpdated = Date()

        if let probe = decoded.probeTempF,
           let target = decoded.targetTempF,
           probe >= target,
           let prev = prevProbe, prev < target {
            WKInterfaceDevice.current().play(.notification)
        }
    }

    private func applyStall(_ context: [String: Any]) {
        guard
            let dict = context["stall"] as? [String: Any],
            let data = try? JSONSerialization.data(withJSONObject: dict),
            let decoded = try? JSONDecoder().decode(WatchStallData.self, from: data)
        else { return }

        let wasStalled = stall.isStalled

        if let snoozeUntil = stallSnoozedUntil, Date() < snoozeUntil {
            var muted = decoded
            muted.isStalled = false
            stall = muted
            lastStallNotified = false
            return
        }
        stallSnoozedUntil = nil
        stall = decoded

        if decoded.isStalled && !wasStalled && !lastStallNotified {
            WKInterfaceDevice.current().play(.directionUp)
            lastStallNotified = true
        } else if !decoded.isStalled {
            lastStallNotified = false
        }
    }

    private func applyFuelTimer(_ context: [String: Any]) {
        guard
            let dict = context["fuelTimer"] as? [String: Any],
            let data = try? JSONSerialization.data(withJSONObject: dict),
            let decoded = try? JSONDecoder().decode(WatchFuelTimerData.self, from: data)
        else { return }

        // Start the tick on first context apply (fuelTickTimer == nil) or when
        // the interval changes, so expiry haptics fire even with the default interval.
        // Initialize lastFuelReset by back-calculating from the phone-pushed
        // elapsedMinutes so that progress/remaining are correct after a cold
        // launch or Watch restart.
        if fuelTickTimer == nil || decoded.intervalMinutes != lastFuelIntervalMinutes {
            lastFuelIntervalMinutes = decoded.intervalMinutes
            lastFuelReset = Date().addingTimeInterval(-Double(decoded.elapsedMinutes) * 60)
            startFuelTick(interval: decoded.intervalMinutes)
        }
        fuelTimer = decoded
    }

    private func applyPitMaster(_ context: [String: Any]) {
        guard
            let dict = context["pitMaster"] as? [String: Any],
            let data = try? JSONSerialization.data(withJSONObject: dict),
            let decoded = try? JSONDecoder().decode(WatchPitMasterInsight.self, from: data)
        else { return }
        pitMasterInsight = decoded.insight
    }

    func startFuelTick(interval: Int) {
        fuelTickTimer?.invalidate()
        fuelTickTimer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor in
                let elapsed = Int(Date().timeIntervalSince(self.lastFuelReset) / 60)
                let atLimit = elapsed >= self.fuelTimer.intervalMinutes
                self.fuelTimer = WatchFuelTimerData(
                    intervalMinutes: self.fuelTimer.intervalMinutes,
                    elapsedMinutes: min(elapsed, self.fuelTimer.intervalMinutes),
                    fuelType: self.fuelTimer.fuelType
                )
                if atLimit && elapsed == self.fuelTimer.intervalMinutes {
                    WKInterfaceDevice.current().play(.click)
                }
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

    func snoozeStall() {
        stallSnoozedUntil = Date().addingTimeInterval(20 * 60)
        var muted = stall
        muted.isStalled = false
        stall = muted
        lastStallNotified = false
    }

    var fuelProgress: Double {
        guard fuelTimer.intervalMinutes > 0 else { return 0 }
        let elapsed = Int(Date().timeIntervalSince(lastFuelReset) / 60)
        return min(Double(elapsed) / Double(fuelTimer.intervalMinutes), 1.0)
    }

    var fuelMinutesRemaining: Int {
        max(fuelTimer.intervalMinutes - Int(Date().timeIntervalSince(lastFuelReset) / 60), 0)
    }

    func elapsedString() -> String {
        guard let ms = cook?.elapsedMs, ms > 0 else { return "--" }
        let totalMins = Int(ms / 60_000)
        return totalMins >= 60 ? "\(totalMins / 60)h \(totalMins % 60)m" : "\(totalMins)m"
    }

    func remainingString() -> String {
        guard let ms = cook?.estimatedRemainingMs, ms > 0 else { return "--" }
        let totalMins = Int(ms / 60_000)
        return totalMins >= 60 ? "~\(totalMins / 60)h \(totalMins % 60)m" : "~\(totalMins)m"
    }
}
