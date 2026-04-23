import SwiftUI
import WatchKit

// ---------------------------------------------------------------------------
// Screen 3 — PitMaster AI
// Shows the latest AI insight from the phone. "Ask" opens Siri Dictation and
// sends the transcribed question to the phone → /api/ai/chat → response back.
// ---------------------------------------------------------------------------

struct PitMasterView: View {
    @EnvironmentObject var model: WatchDataModel
    @State private var showDictation = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {

            // Header
            HStack(spacing: 5) {
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color(red: 0.92, green: 0.42, blue: 0.17))
                    .frame(width: 18, height: 18)
                    .overlay(
                        Text("🤖")
                            .font(.system(size: 11))
                    )
                Text("PitMaster")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Color(red: 0.92, green: 0.42, blue: 0.17))
                Spacer()
                if model.pitMasterLoading {
                    ProgressView()
                        .scaleEffect(0.6)
                        .tint(.secondary)
                }
            }
            .padding(.bottom, 6)

            // Insight bubble
            Group {
                if let response = model.aiResponse {
                    Text(response)
                        .font(.system(size: 10))
                        .foregroundStyle(.white)
                } else {
                    Text(model.pitMasterInsight)
                        .font(.system(size: 10))
                        .foregroundStyle(Color.white.opacity(0.85))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(8)
            .background(Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 10))

            Spacer(minLength: 6)

            // Action buttons
            HStack(spacing: 6) {
                // Check temps — sends a message to the phone to refresh
                Button {
                    WKInterfaceDevice.current().play(.click)
                    model.aiResponse = nil
                    WatchSessionDelegate.send(action: "refreshTemps")
                } label: {
                    VStack(spacing: 2) {
                        Image(systemName: "thermometer")
                            .font(.system(size: 13))
                        Text("Temps")
                            .font(.system(size: 8))
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.plain)
                .frame(height: 38)
                .background(Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 9))
                .foregroundStyle(.secondary)

                // Ask PitMaster — Siri Dictation
                Button {
                    WKInterfaceDevice.current().play(.click)
                    presentTextInputController()
                } label: {
                    VStack(spacing: 2) {
                        Image(systemName: "mic.fill")
                            .font(.system(size: 13))
                        Text("Ask")
                            .font(.system(size: 8, weight: .semibold))
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.plain)
                .frame(height: 38)
                .background(Color(red: 0.92, green: 0.42, blue: 0.17).opacity(0.2), in: RoundedRectangle(cornerRadius: 9))
                .foregroundStyle(Color(red: 0.92, green: 0.42, blue: 0.17))
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
    }

    // MARK: - Siri Dictation

    private func presentTextInputController() {
        WKExtension.shared().visibleInterfaceController?.presentTextInputController(
            withSuggestions: ["What should I do next?", "How's the stall?", "Time to wrap?"],
            allowedInputMode: .plain
        ) { results in
            guard let text = (results as? [String])?.first else { return }
            model.pitMasterLoading = true
            model.aiResponse = nil
            WatchSessionDelegate.send(action: "pitMasterAsk", payload: ["question": text])
            // Response arrives via WCSession message handled in WatchSessionDelegate
            DispatchQueue.main.asyncAfter(deadline: .now() + 10) {
                model.pitMasterLoading = false
            }
        }
    }
}
