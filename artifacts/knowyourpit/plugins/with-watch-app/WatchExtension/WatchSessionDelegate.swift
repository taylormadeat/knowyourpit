import Foundation
import WatchKit
import WatchConnectivity

final class WatchSessionDelegate: NSObject, WCSessionDelegate, ObservableObject {
    private let model: WatchDataModel

    init(model: WatchDataModel) {
        self.model = model
        super.init()
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        guard activationState == .activated else { return }
        Task { @MainActor in
            self.model.applyContext(session.receivedApplicationContext)
        }
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        Task { @MainActor in self.model.applyContext(applicationContext) }
    }

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

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        Task { @MainActor in
            if let action = message["action"] as? String, action == "pitMasterResponse" {
                self.model.applyPitMasterResponse(message)
            } else {
                self.model.applyContext(message)
            }
        }
    }

    static func send(action: String, payload: [String: Any] = [:]) {
        guard
            WCSession.isSupported(),
            WCSession.default.activationState == .activated,
            WCSession.default.isReachable
        else { return }
        var msg = payload
        msg["action"] = action
        WCSession.default.sendMessage(msg, replyHandler: nil) { error in
            print("[Watch] WCSession send error: \(error.localizedDescription)")
        }
    }
}
