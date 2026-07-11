/// ONB-04/05/06: radial calibration. « moi » at the center; select a person,
/// then tap the ring that fits. Everything written here goes to the VAULT
/// ONLY (ONB-05) — no network import exists in this file, by design.
///
/// The radial placement math below is an inlined subset of FS-02's geometry
/// (`apps/mobile/src/map/geometry.ts`, `ringRadius`/`positionOn`) just
/// enough to visually prefigure the map per ONB-04. It is deliberately NOT
/// the full `MapGeometry` port — that is Wave 2 scope (`rn-audit-map.md`)
/// and lands as its own module with its own tests.
///
/// Accessibility: list mode offers identical placement capability with
/// screen-reader-friendly rows (spec non-functional requirement).
import SwabCore
import SwiftUI

private enum CalibrateGeometry {
    static let mapSize: CGFloat = 320
    static let nodeHalfWidth: CGFloat = 28

    static func ringRadius(_ ring: Int) -> CGFloat {
        (mapSize / 2) * (CGFloat(ring) / 4.6) + 24
    }

    static func position(ring: Int, index: Int) -> CGPoint {
        let angle = Double(index) * 2.399963  // golden angle, avoids overlap clumping
        let r = ringRadius(ring)
        return CGPoint(
            x: mapSize / 2 + r * CGFloat(cos(angle)),
            y: mapSize / 2 + r * CGFloat(sin(angle))
        )
    }
}

public struct CalibrateView: View {
    @State private var viewModel: CalibrateViewModel
    private let onContinue: () -> Void

    private static let etats = [Fr.t(.etatAvailable), Fr.t(.etatBusy), Fr.t(.etatAway)]
    private static let ressentis = [Fr.t(.ressentiLight), Fr.t(.ressentiPrecious), Fr.t(.ressentiPaused)]
    private static let ringLabels: [Int: String] = [1: Fr.t(.ring1), 2: Fr.t(.ring2), 3: Fr.t(.ring3), 4: Fr.t(.ring4)]

    public init(viewModel: CalibrateViewModel, onContinue: @escaping () -> Void) {
        _viewModel = State(initialValue: viewModel)
        self.onContinue = onContinue
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(Fr.t(.brandName)).font(.headline)
            Text(Fr.t(.calibrateTitle)).font(.title2)
            Text(Fr.t(.calibrateHint)).font(.footnote)

            Toggle(Fr.t(.calibrateListMode), isOn: $viewModel.listMode)
                .accessibilityLabel(Fr.t(.calibrateListMode))

            ScrollView {
                if viewModel.contacts.isEmpty {
                    Text(Fr.t(.calibrateEmpty))
                }

                if viewModel.listMode {
                    listBody
                } else {
                    radialBody
                }

                ringButtons

                optionalLayer
            }

            Button(Fr.t(.calibrateContinue)) {
                Task {
                    await viewModel.advance()
                    onContinue()
                }
            }
            .accessibilityLabel(Fr.t(.calibrateContinue))
        }
        .padding()
        .task { await viewModel.refresh() }
    }

    @ViewBuilder
    private var listBody: some View {
        ForEach(viewModel.contacts, id: \.id) { contact in
            Button {
                viewModel.selectedId = contact.id
            } label: {
                HStack {
                    Text(contact.displayName)
                    Spacer()
                    Text(contact.ring.flatMap { Self.ringLabels[$0] } ?? "—")
                }
            }
            .accessibilityLabel(
                contact.ring.flatMap { ring in "\(contact.displayName) — \(Self.ringLabels[ring] ?? "")" }
                    ?? contact.displayName
            )
        }
    }

    @ViewBuilder
    private var radialBody: some View {
        if !viewModel.contacts.isEmpty {
            ZStack {
                ForEach([1, 2, 3, 4], id: \.self) { ring in
                    Circle()
                        .stroke(.secondary, lineWidth: 1)
                        .frame(width: CalibrateGeometry.ringRadius(ring) * 2, height: CalibrateGeometry.ringRadius(ring) * 2)
                }
                Text(Fr.t(.calibrateMe))
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(.tint))

                let placed = viewModel.contacts.enumerated().filter { $0.element.ring != nil }
                ForEach(Array(placed), id: \.element.id) { index, contact in
                    let point = CalibrateGeometry.position(ring: contact.ring!, index: index)
                    Button(contact.displayName) {
                        viewModel.selectedId = contact.id
                    }
                    .accessibilityLabel("\(contact.displayName) — \(Self.ringLabels[contact.ring!] ?? "")")
                    .position(x: point.x, y: point.y)
                }
            }
            .frame(width: CalibrateGeometry.mapSize, height: CalibrateGeometry.mapSize)
        }

        if !viewModel.unplaced.isEmpty {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 80))]) {
                ForEach(viewModel.unplaced, id: \.id) { contact in
                    Button(contact.displayName) {
                        viewModel.selectedId = contact.id
                    }
                    .accessibilityLabel(contact.displayName)
                }
            }
        }
    }

    @ViewBuilder
    private var ringButtons: some View {
        HStack {
            ForEach([1, 2, 3, 4], id: \.self) { ring in
                Button(Self.ringLabels[ring] ?? "") {
                    Task { await viewModel.place(ring: ring) }
                }
                .disabled(viewModel.selectedId == nil)
                .accessibilityLabel("\(Fr.t(.calibrateRingPrefix)) \(ring) — \(Self.ringLabels[ring] ?? "")")
            }
        }
    }

    @ViewBuilder
    private var optionalLayer: some View {
        Button(Fr.t(.calibrateOptionalLayer)) {
            viewModel.optionalOpen.toggle()
        }
        .accessibilityLabel(Fr.t(.calibrateOptionalLayer))

        if viewModel.optionalOpen {
            if viewModel.selected == nil {
                Text(Fr.t(.calibrateOptionalHint))
            } else {
                Text(Fr.t(.calibrateEtatTitle))
                HStack {
                    ForEach(Self.etats, id: \.self) { etat in
                        Button(etat) {
                            Task { await viewModel.setEtat(etat) }
                        }
                        .accessibilityLabel(etat)
                    }
                }
                Text(Fr.t(.calibrateRessentiTitle))
                HStack {
                    ForEach(Self.ressentis, id: \.self) { ressenti in
                        Button(ressenti) {
                            Task { await viewModel.setRessenti(ressenti) }
                        }
                        .accessibilityLabel(ressenti)
                    }
                }
            }
        }
    }
}
