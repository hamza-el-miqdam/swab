/// MAP-01/03/04/07 — the radial canvas: ring circles, hairline spokes,
/// « moi » at the center, one node per placed contact, pinch-zoom (1x-3x)
/// + bounded pan. Pure presentation over contacts passed in by `CarteView`
/// — this view never loads anything itself (MAP-05 lives in the view model).
import SwabCore
import SwiftUI

private let minScale: Double = 1
private let maxScale: Double = 3

private let spokeAngles: [Double] = [0, 45, 90, 135]

struct RadialMapView: View {
    let contacts: [VaultContact]
    let onTapContact: (VaultContact) -> Void

    @State private var scale: CGFloat = 1
    @State private var lastScale: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var lastOffset: CGSize = .zero

    private var placedNodes: [(contact: VaultContact, ringIndex: Int)] {
        var perRing: [Int: Int] = [:]
        var result: [(VaultContact, Int)] = []
        for contact in contacts where contact.ring != nil {
            let ring = contact.ring!
            let index = perRing[ring, default: 0]
            perRing[ring] = index + 1
            result.append((contact, index))
        }
        return result
    }

    var body: some View {
        ZStack {
            ForEach(MapGeometry.rings, id: \.self) { ring in
                let r = MapGeometry.ringRadius(ring)
                Circle()
                    .stroke(Color(hex: CarteTheme.ringLine), lineWidth: 1)
                    .frame(width: r * 2, height: r * 2)
                    .position(x: MapGeometry.mapSize / 2, y: MapGeometry.mapSize / 2)
                    .accessibilityHidden(true)
            }

            ForEach(spokeAngles, id: \.self) { angle in
                Rectangle()
                    .fill(Color(hex: CarteTheme.ringLine).opacity(0.6))
                    .frame(width: MapGeometry.mapSize, height: 0.5)
                    .rotationEffect(.degrees(angle))
                    .position(x: MapGeometry.mapSize / 2, y: MapGeometry.mapSize / 2)
                    .accessibilityHidden(true)
            }

            Text(Fr.t(.carteMe))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color(hex: CarteTheme.accentInk))
                .frame(width: 44, height: 44)
                .background(Circle().fill(Color(hex: CarteTheme.accent)))
                .position(x: MapGeometry.mapSize / 2, y: MapGeometry.mapSize / 2)
                .accessibilityHidden(true)

            ForEach(placedNodes, id: \.contact.id) { entry in
                ContactNodeView(
                    contact: entry.contact,
                    index: entry.ringIndex,
                    onTap: onTapContact
                )
            }
        }
        .frame(width: MapGeometry.mapSize, height: MapGeometry.mapSize)
        .scaleEffect(scale)
        .offset(offset)
        .gesture(magnifyGesture.simultaneously(with: dragGesture))
        .accessibilityElement(children: .contain)
    }

    private var magnifyGesture: some Gesture {
        MagnificationGesture()
            .onChanged { value in
                let newScale = MapGeometry.clamp(Double(lastScale) * value, minScale, maxScale)
                scale = CGFloat(newScale)
                boundOffset()
            }
            .onEnded { _ in
                lastScale = scale
            }
    }

    private var dragGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                let bound = MapGeometry.panBound(scale: Double(scale))
                offset = CGSize(
                    width: CGFloat(MapGeometry.clamp(Double(lastOffset.width + value.translation.width), -bound, bound)),
                    height: CGFloat(MapGeometry.clamp(Double(lastOffset.height + value.translation.height), -bound, bound))
                )
            }
            .onEnded { _ in
                lastOffset = offset
            }
    }

    private func boundOffset() {
        let bound = MapGeometry.panBound(scale: Double(scale))
        offset = CGSize(
            width: CGFloat(MapGeometry.clamp(Double(offset.width), -bound, bound)),
            height: CGFloat(MapGeometry.clamp(Double(offset.height), -bound, bound))
        )
        lastOffset = offset
    }
}

/// One contact on the map (`ContactNode.tsx` equivalent). Position animates
/// with `.easeInOut` when the ring/index changes (MAP-04: re-tag → animated
/// move, no teleport) — but the very first mount snaps into place, only
/// *changes* animate, matching the RN reference's `mounted` ref pattern.
private struct ContactNodeView: View {
    let contact: VaultContact
    let index: Int
    let onTap: (VaultContact) -> Void

    @State private var point: CGPoint
    @State private var hasAppeared = false

    init(contact: VaultContact, index: Int, onTap: @escaping (VaultContact) -> Void) {
        self.contact = contact
        self.index = index
        self.onTap = onTap
        _point = State(initialValue: Self.center(contact: contact, index: index))
    }

    private static func center(contact: VaultContact, index: Int) -> CGPoint {
        guard let ring = contact.ring else { return .zero }
        let chip = MapGeometry.positionOn(ring: ring, index: index)
        return CGPoint(
            x: chip.left + MapGeometry.nodeHalfWidth,
            y: chip.top + MapGeometry.nodeHalfHeight
        )
    }

    var body: some View {
        let size = CGFloat(MapGeometry.nodeSize(ring: contact.ring ?? 4))
        let palette = EtatColors.color(for: contact.etat)

        Button {
            onTap(contact)
        } label: {
            Text(CarteLabels.initials(contact.displayName))
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color(hex: CarteTheme.text))
                .frame(width: size, height: size)
                .background(Circle().fill(Color(hex: palette.background)))
                .overlay(Circle().stroke(Color(hex: palette.border), lineWidth: 1))
        }
        .accessibilityLabel(CarteLabels.contactLabel(contact))
        .position(point)
        .onAppear {
            hasAppeared = true
        }
        .onChange(of: MapGeometry.positionOn(ring: contact.ring ?? 4, index: index)) { _, _ in
            let newCenter = Self.center(contact: contact, index: index)
            if hasAppeared {
                withAnimation(.easeInOut(duration: 0.35)) {
                    point = newCenter
                }
            } else {
                point = newCenter
            }
        }
    }
}
