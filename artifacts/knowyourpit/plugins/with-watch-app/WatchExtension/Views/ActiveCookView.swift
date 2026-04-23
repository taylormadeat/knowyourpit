import SwiftUI

// ---------------------------------------------------------------------------
// Screen 1 — Active Cook Overview
// The main glance screen: probe temp hero number, cook name, elapsed & ETA.
// ---------------------------------------------------------------------------

struct ActiveCookView: View {
    @EnvironmentObject var model: WatchDataModel

    var body: some View {
        if let cook = model.cook, cook.status == "active" {
            activeCookBody(cook: cook)
        } else {
            noCookBody()
        }
    }

    // MARK: - Active state

    @ViewBuilder
    private func activeCookBody(cook: WatchCookData) -> some View {
        VStack(alignment: .leading, spacing: 0) {

            // Status badge + cook name
            HStack(spacing: 4) {
                Circle()
                    .fill(Color(red: 0.92, green: 0.42, blue: 0.17))
                    .frame(width: 6, height: 6)
                Text("ACTIVE")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(Color(red: 0.92, green: 0.42, blue: 0.17))
                Spacer()
                if let last = model.lastUpdated {
                    Text(last, style: .time)
                        .font(.system(size: 8))
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.bottom, 2)

            Text(cook.name)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
                .lineLimit(1)

            // Hero probe temp
            Spacer(minLength: 4)
            HStack(alignment: .firstTextBaseline, spacing: 1) {
                if let temp = cook.probeTempF {
                    Text(String(format: "%.0f", temp))
                        .font(.system(size: 42, weight: .thin))
                        .foregroundStyle(Color(red: 0.92, green: 0.42, blue: 0.17))
                    Text("°F")
                        .font(.system(size: 14, weight: .regular))
                        .foregroundStyle(Color(red: 0.92, green: 0.42, blue: 0.17))
                        .offset(y: -4)
                } else {
                    Text("--")
                        .font(.system(size: 42, weight: .thin))
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .center)

            if let target = cook.targetTempF {
                Text("Target \(Int(target))°F")
                    .font(.system(size: 9))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
            }

            Spacer(minLength: 4)
            Divider().overlay(Color.white.opacity(0.1))

            // Footer: elapsed + remaining
            HStack {
                VStack(alignment: .leading, spacing: 1) {
                    Text("Elapsed")
                        .font(.system(size: 8))
                        .foregroundStyle(.secondary)
                    Text(model.elapsedString())
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 1) {
                    Text("Est. finish")
                        .font(.system(size: 8))
                        .foregroundStyle(.secondary)
                    Text(model.remainingString())
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                }
            }
            .padding(.top, 4)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
    }

    // MARK: - No cook state

    @ViewBuilder
    private func noCookBody() -> some View {
        VStack(spacing: 8) {
            Image(systemName: "flame")
                .font(.system(size: 28, weight: .thin))
                .foregroundStyle(.secondary)
            Text("No Active Cook")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(.secondary)
            Text("Start one on your phone")
                .font(.system(size: 10))
                .foregroundStyle(Color.secondary.opacity(0.6))
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
