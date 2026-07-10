/// MAP-01/07 — reproduces the RN reference's geometry math
/// (`apps/mobile/src/map/geometry.ts`) exactly. Expected values were
/// computed independently in Python from the same formulas (see PR
/// description / CHANGELOG) rather than derived from `MapGeometry` itself,
/// so these tests actually catch a formula regression.
import XCTest

@testable import SwabCore

final class MapGeometryTests: XCTestCase {
    private let accuracy = 1e-9

    func test_MAP01_mapSizeAndRingsMatchReference() {
        XCTAssertEqual(MapGeometry.mapSize, 320)
        XCTAssertEqual(MapGeometry.rings, [1, 2, 3, 4])
    }

    func test_MAP07_ringRadiusMatchesReferenceForEveryRing() {
        XCTAssertEqual(MapGeometry.ringRadius(1), 58.78260869565218, accuracy: accuracy)
        XCTAssertEqual(MapGeometry.ringRadius(2), 93.56521739130436, accuracy: accuracy)
        XCTAssertEqual(MapGeometry.ringRadius(3), 128.34782608695653, accuracy: accuracy)
        XCTAssertEqual(MapGeometry.ringRadius(4), 163.13043478260872, accuracy: accuracy)
    }

    func test_MAP07_positionOnMatchesReferenceForFixedRingIndexPairs() {
        let p1 = MapGeometry.positionOn(ring: 1, index: 0)
        XCTAssertEqual(p1.left, 190.7826086956522, accuracy: accuracy)
        XCTAssertEqual(p1.top, 146.0, accuracy: accuracy)

        let p2 = MapGeometry.positionOn(ring: 2, index: 1)
        XCTAssertEqual(p2.left, 63.00793514442299, accuracy: accuracy)
        XCTAssertEqual(p2.top, 209.20241207775143, accuracy: accuracy)

        let p3 = MapGeometry.positionOn(ring: 3, index: 2)
        XCTAssertEqual(p3.left, 143.22084296694595, accuracy: accuracy)
        XCTAssertEqual(p3.top, 18.143607338706843, accuracy: accuracy)

        let p4 = MapGeometry.positionOn(ring: 4, index: 3)
        XCTAssertEqual(p4.left, 231.2549851524078, accuracy: accuracy)
        XCTAssertEqual(p4.top, 275.460367196908, accuracy: accuracy)
    }

    /// Same (ring, index) always yields the same point — the re-tag
    /// animation (MAP-04) depends on this determinism, not randomness.
    func test_MAP07_positionOnIsDeterministic() {
        let a = MapGeometry.positionOn(ring: 2, index: 5)
        let b = MapGeometry.positionOn(ring: 2, index: 5)
        XCTAssertEqual(a, b)
    }

    /// Distinct indices on the same ring must not collide (the whole point
    /// of the golden-angle spread).
    func test_MAP07_positionOnSpreadsDistinctIndicesApart() {
        let a = MapGeometry.positionOn(ring: 1, index: 0)
        let b = MapGeometry.positionOn(ring: 1, index: 1)
        XCTAssertNotEqual(a, b)
    }

    func test_MAP01_clampBoundsValueIntoRange() {
        XCTAssertEqual(MapGeometry.clamp(5, 0, 10), 5)
        XCTAssertEqual(MapGeometry.clamp(-5, 0, 10), 0)
        XCTAssertEqual(MapGeometry.clamp(15, 0, 10), 10)
    }

    func test_MAP07_panBoundIsZeroAtRestAndGrowsWithScale() {
        XCTAssertEqual(MapGeometry.panBound(scale: 1), 0)
        XCTAssertEqual(MapGeometry.panBound(scale: 2), 160.0, accuracy: accuracy)
        XCTAssertEqual(MapGeometry.panBound(scale: 3), 320.0, accuracy: accuracy)
    }

    /// The map can never be pushed off-screen: a scale below 1 (shouldn't
    /// happen given MIN_SCALE=1, but the formula itself must not go
    /// negative) still floors at zero.
    func test_MAP07_panBoundNeverNegative() {
        XCTAssertEqual(MapGeometry.panBound(scale: 0.5), 0)
    }

    func test_MAP03_nodeSizeStepsDownPerRing() {
        XCTAssertEqual(MapGeometry.nodeSize(ring: 1), 44)
        XCTAssertEqual(MapGeometry.nodeSize(ring: 2), 40)
        XCTAssertEqual(MapGeometry.nodeSize(ring: 3), 36)
        XCTAssertEqual(MapGeometry.nodeSize(ring: 4), 32)
    }
}
