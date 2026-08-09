/// ONB-04/05/06: radial calibration. « moi » at the center; select a person,
/// then tap the ring that fits. Everything written here goes to the VAULT
/// ONLY (ONB-05) — no network import exists in this file, by design.
///
/// Radial placement reuses `SwabCore/Carte/MapGeometry` directly (Wave 2
/// landed; this view used to inline a private subset of the same math —
/// see `apps/ios/CHANGELOG.md` SUG-IOS-015) so calibrate visually
/// prefigures the map exactly, including per-ring placement indexing, not
/// just the same formula.
///
/// Accessibility: list mode offers identical placement capability with
/// screen-reader-friendly rows (spec non-functional requirement).
import SwabCore
import SwiftUI

public struct CalibrateView: View {
    @State private var viewModel: CalibrateViewModel
    private let onContinue: () -> Void

    public init(viewModel: CalibrateViewModel, onContinue: @escaping () -> Void) {
        _viewModel = State(initialValue: viewModel)
        self.onContinue = onContinue
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(Fr.t(.brandName)).swabType(DesignTokens.Typography.wordmark, relativeTo: .headline)
            Text(Fr.t(.calibrateTitle)).swabType(DesignTokens.Typography.title, relativeTo: .title2)
            Text(Fr.t(.calibrateHint)).swabType(DesignTokens.Typography.subtitle, relativeTo: .footnote)

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
                    Text(contact.ring.flatMap { CarteLabels.ringLabel[$0] } ?? "—")
                }
            }
            .accessibilityLabel(
                contact.ring.flatMap { ring in "\(contact.displayName) — \(CarteLabels.ringLabel[ring] ?? "")" }
                    ?? contact.displayName
            )
        }
    }

    /// Placement uses `MapGeometry.perRingIndexes` — a PER-RING index, same
    /// as `RadialMapView.placedNodes` — not the contact's position in
    /// `viewModel.contacts`, so a contact lands at the same angle here as
    /// it will on the map (ONB-04 fidelity; see SUG-IOS-015).
    private var placedForRadial: [(contact: VaultContact, ringIndex: Int)] {
        let indexes = MapGeometry.perRingIndexes(viewModel.contacts.map(\.ring))
        return zip(viewModel.contacts, indexes).compactMap { contact, index in
            contact.ring != nil ? (contact, index) : nil
        }
    }

    /// Chip CENTER for a given (ring, per-ring index) — `MapGeometry.positionOn`
    /// returns the chip's top-left origin, so add back the half-footprint
    /// offsets it already subtracted (same as `RadialMapView.ContactNodeView.center`).
    private static func chipCenter(ring: Int, index: Int) -> CGPoint {
        let chip = MapGeometry.positionOn(ring: ring, index: index)
        return CGPoint(x: chip.left + MapGeometry.nodeHalfWidth, y: chip.top + MapGeometry.nodeHalfHeight)
    }

    @ViewBuilder
    private var radialBody: some View {
        if !viewModel.contacts.isEmpty {
            ZStack {
                ForEach(MapGeometry.rings, id: \.self) { ring in
                    let r = CGFloat(MapGeometry.ringRadius(ring))
                    Circle()
                        .stroke(.secondary, lineWidth: 1)
                        .frame(width: r * 2, height: r * 2)
                }
                Text(Fr.t(.calibrateMe))
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(.tint))

                ForEach(placedForRadial, id: \.contact.id) { entry in
                    let point = Self.chipCenter(ring: entry.contact.ring!, index: entry.ringIndex)
                    Button(entry.contact.displayName) {
                        viewModel.selectedId = entry.contact.id
                    }
                    .accessibilityLabel("\(entry.contact.displayName) — \(CarteLabels.ringLabel[entry.contact.ring!] ?? "")")
                    .position(point)
                }
            }
            .frame(width: CGFloat(MapGeometry.mapSize), height: CGFloat(MapGeometry.mapSize))
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
            ForEach(MapGeometry.rings, id: \.self) { ring in
                Button(CarteLabels.ringLabel[ring] ?? "") {
                    Task { await viewModel.place(ring: ring) }
                }
                .disabled(viewModel.selectedId == nil)
                .accessibilityLabel("\(Fr.t(.calibrateRingPrefix)) \(ring) — \(CarteLabels.ringLabel[ring] ?? "")")
                .minTouchTarget()
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
                    ForEach(FicheVocabulary.etats, id: \.self) { etat in
                        Button(etat) {
                            Task { await viewModel.setEtat(etat) }
                        }
                        .accessibilityLabel(etat)
                    }
                }
                Text(Fr.t(.calibrateRessentiTitle))
                HStack {
                    ForEach(FicheVocabulary.ressentis, id: \.self) { ressenti in
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
