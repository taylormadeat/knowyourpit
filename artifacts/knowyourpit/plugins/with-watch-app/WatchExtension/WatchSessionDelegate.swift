import Foundation
import WatchKit
import WatchConnectivity

// ---------------------------------------------------------------------------
// WatchSessionDelegate
// Receives data pushed from the iPhone app via WCSession and applies it to
// the shared WatchDataModel.
// ---------------------------------------------------------------------------

final class WatchSessionDelegate: NSObject, WCSessionDelegate, ObservableObject {

    private let model: WatchDataModel

    init(model: WatchDataModel) {
        self.model = model
        super.init()
        activateSession()
    }

    // MARK: - Activation

    private func activateSession() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    // MARK: - WCSessionDelegate

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        guard activationState == .activated else { return }
        // Apply any context that was already set before activation
        Task { @MainActor in
            self.model.applyContext(session.receivedApplicationContext)
        }
    }

    // Called when the phone pushes a new application context
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        Task { @MainActor in
            self.model.applyContext(applicationContext)
        }
    }

    // Called when the phone sends an immediate message (for stop/start cook responses)
    func session(
        _ session: WCSession,
        didReceiveMessage message: [String: Any],
        replyHandler: @escaping ([String: Any]) -> Void
    ) {
        Task { @MainActor in
            self.model.applyContext(message)
            replyHandler(["status": "ok"])
        }
    }

    // Called when the phone sends a message without reply handler
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        Task { @MainActor in
            // Route PitMaster responses separately so they don't overwrite cook/stall state
            if let action = message["action"] as? String, action == "pitMasterResponse" {
                self.model.applyPitMasterResponse(message)
            } else {
                self.model.applyContext(message)
            }
        }
    }

    // MARK: - Outgoing — Watch → Phone

    static func send(action: String, payload: [String: Any] = [:]) {
        guard WCSession.isSupported(),
              WCSession.default.activationState == .activated,
              WCSession.default.isReachable else {
            return
        }
        var msg = payload
        msg["action"] = action
        WCSession.default.sendMessage(msg, replyHandler: nil, errorHandler: { error in
            print("[WatchSession] send error: \(error.localizedDescription)")
        })
    }
}
