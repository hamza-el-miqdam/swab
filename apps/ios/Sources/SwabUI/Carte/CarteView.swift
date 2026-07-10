/// FS-02 — « Ma carte »: the app's home. Renders entirely from the
/// on-device vault (MAP-01/05); reloads on appear and on return to
/// foreground, so an FS-03 re-tag animates the node to its new ring on
/// return. List mode (MAP-08) is feature-equivalent; unplaced contacts stay
/// visible in a tray — nothing hidden silently (MAP-06/09).
import SwabCore
import SwiftUI

public struct CarteView: View {
    @State private var viewModel: CarteViewModel
    @Environment(\.scenePhase) private var scenePhase

    public init(viewModel: CarteViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(Fr.t(.brandName))
                    .font(.headline)
                Text(Fr.t(.carteTitle))
                    .font(.largeTitle.weight(.semibold))
                Text(Fr.t(.carteSubtitle))
                    .font(.body)
                    .foregroundStyle(Color(hex: CarteTheme.textDim))

                Toggle(isOn: $viewModel.listMode) {
                    Text(Fr.t(.carteListMode))
                        .foregroundStyle(Color(hex: CarteTheme.textDim))
                }
                .accessibilityLabel(Fr.t(.carteListMode))

                if viewModel.listMode {
                    RingListView(contacts: viewModel.contacts, onTapContact: viewModel.select)
                        .frame(minHeight: 320)
                } else {
                    mapArea
                }

                legendToggle
                if viewModel.legendOpen {
                    legend
                }
            }
            .padding()
        }
        .background(Color(hex: CarteTheme.bg))
        .task {
            await viewModel.refresh()
        }
        .onChange(of: scenePhase) { _, newPhase in
            guard newPhase == .active else { return }
            Task { await viewModel.refresh() }
        }
        .sheet(isPresented: Binding(
            get: { viewModel.selected != nil },
            set: { isPresented in
                if !isPresented { viewModel.closeSheet() }
            }
        )) {
            if let selected = viewModel.selected {
                PeekSheetView(contact: selected)
            }
        }
    }

    @ViewBuilder
    private var mapArea: some View {
        RadialMapView(contacts: viewModel.contacts, onTapContact: viewModel.select)
            .frame(maxWidth: .infinity)

        // MAP-06: a calm, non-alarming empty state — no progress framing.
        if viewModel.contacts.isEmpty {
            Text(Fr.t(.carteEmpty))
                .font(.body)
                .foregroundStyle(Color(hex: CarteTheme.textDim))
        }

        // Unplaced contacts stay visible — nothing hidden silently (MAP-09).
        if !viewModel.unplaced.isEmpty {
            unplacedTray
        }
    }

    @ViewBuilder
    private var unplacedTray: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 90))], spacing: 8) {
            ForEach(viewModel.unplaced, id: \.id) { contact in
                Button {
                    viewModel.select(contact)
                } label: {
                    Text(contact.displayName)
                        .font(.footnote)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(
                            Capsule()
                                .fill(Color(hex: CarteTheme.surface))
                                .overlay(Capsule().stroke(Color(hex: CarteTheme.line), lineWidth: 1))
                        )
                }
                .accessibilityLabel(contact.displayName)
            }
        }
    }

    @ViewBuilder
    private var legendToggle: some View {
        Button {
            viewModel.toggleLegend()
        } label: {
            Text(Fr.t(.carteLegend))
                .foregroundStyle(Color(hex: CarteTheme.textDim))
        }
        .accessibilityLabel(Fr.t(.carteLegend))
    }

    @ViewBuilder
    private var legend: some View {
        HStack(spacing: 16) {
            legendEntry(label: Fr.t(.etatAvailable), hex: EtatColors.available)
            legendEntry(label: Fr.t(.etatBusy), hex: EtatColors.busy)
            legendEntry(label: Fr.t(.etatAway), hex: EtatColors.away)
        }
    }

    @ViewBuilder
    private func legendEntry(label: String, hex: String) -> some View {
        HStack(spacing: 8) {
            Circle().fill(Color(hex: hex)).frame(width: 10, height: 10)
            Text(label)
                .font(.footnote)
                .foregroundStyle(Color(hex: CarteTheme.textDim))
        }
    }
}
