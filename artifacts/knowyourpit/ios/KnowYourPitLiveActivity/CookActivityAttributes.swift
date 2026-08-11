import ActivityKit
import Foundation

@available(iOS 16.1, *)
public struct CookActivityAttributes: ActivityAttributes {
    public typealias ContentState = CookContentState

    public struct CookContentState: Codable, Hashable {
        public var currentTempF: Double?
        public var targetTempF: Double?
        public var cookTempF: Double?
        public var meatLabel: String
        public var startedAtEpochSec: Double
        public var status: String

        public init(
            currentTempF: Double?,
            targetTempF: Double?,
            cookTempF: Double?,
            meatLabel: String,
            startedAtEpochSec: Double,
            status: String
        ) {
            self.currentTempF = currentTempF
            self.targetTempF = targetTempF
            self.cookTempF = cookTempF
            self.meatLabel = meatLabel
            self.startedAtEpochSec = startedAtEpochSec
            self.status = status
        }
    }

    public var meatLabel: String

    public init(meatLabel: String) {
        self.meatLabel = meatLabel
    }
}
