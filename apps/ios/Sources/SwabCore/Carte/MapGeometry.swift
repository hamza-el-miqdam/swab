/// FS-02 radial geometry — pure math, no SwiftUI, no I/O (MAP-01/07).
///
/// 1:1 port of `apps/mobile/src/map/geometry.ts`. Kept byte-for-byte
/// equivalent in behavior (same constants, same golden-angle formula) so a
/// contact placed in one client lands at the same visual spot as another —
/// there is no server-side layout to reconcile against, this math IS the
/// spec (per the task's framing of `apps/mobile/src/map/*` as executable).
import Foundation

public enum MapGeometry {
    public static let mapSize: Double = 320

    public static let rings: [Int] = [1, 2, 3, 4]

    /// Chip offsets used by `positionOn` (half the calibrate chip footprint).
    public static let nodeHalfWidth: Double = 28
    public static let nodeHalfHeight: Double = 14

    /// Golden angle in radians — deterministic angular spread per ring,
    /// stable positions, no jumps, no overlap clumping (MAP-07).
    private static let goldenAngle: Double = 2.399963

    public static func ringRadius(_ ring: Int) -> Double {
        (mapSize / 2) * (Double(ring) / 4.6) + 24
    }

    public struct Point: Equatable, Sendable {
        public let top: Double
        public let left: Double

        public init(top: Double, left: Double) {
            self.top = top
            self.left = left
        }
    }

    /// Deterministic angular spread per ring — same (ring, index) always
    /// yields the same point, so re-tagging a contact animates rather than
    /// jumping to a random new spot.
    public static func positionOn(ring: Int, index: Int) -> Point {
        let angle = Double(index) * goldenAngle
        let r = ringRadius(ring)
        return Point(
            top: mapSize / 2 + r * sin(angle) - nodeHalfHeight,
            left: mapSize / 2 + r * cos(angle) - nodeHalfWidth
        )
    }

    /// Bound a value into `[lo, hi]`.
    public static func clamp(_ value: Double, _ lo: Double, _ hi: Double) -> Double {
        min(max(value, lo), hi)
    }

    /// Max pan offset (either axis) at a given zoom: the scaled map's
    /// overflow on one side. Zero at rest — the map cannot be pushed
    /// off-screen.
    public static func panBound(scale: Double) -> Double {
        max(0, (mapSize * (scale - 1)) / 2)
    }

    /// Node diameter steps down with distance: closer reads bigger
    /// (`ContactNode.tsx`'s `nodeSize`).
    public static func nodeSize(ring: Int) -> Double {
        44 - Double(ring - 1) * 4
    }

    /// Per-ring placement index (0-based), NOT the global array index — two
    /// clients laying out the same contacts must agree on angular position,
    /// and `positionOn`'s golden-angle spread is keyed by "which slot in
    /// this ring", not "which slot overall". `nil` entries (unplaced
    /// contacts) consume no index and their returned value is unspecified
    /// (callers filter them out before using it — see `RadialMapView`).
    public static func perRingIndexes(_ rings: [Int?]) -> [Int] {
        var perRing: [Int: Int] = [:]
        return rings.map { ring in
            guard let ring else { return 0 }
            let index = perRing[ring, default: 0]
            perRing[ring] = index + 1
            return index
        }
    }
}
