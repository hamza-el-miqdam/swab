/// FS-03 — « Fiche contact »: per-relation detail + editing. Reached from
/// `PeekSheetView`'s « Ouvrir la fiche » (MAP-04 seam), pushed onto the
/// same `NavigationStack` the carte lives in so the system back button
/// returns to the map with its prior pan/zoom intact (FCH-07).
import SwabCore
import SwiftUI

public struct FicheView: View {
    @State private var viewModel: FicheViewModel

    public init(viewModel: FicheViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header
                stalenessNudge
                axes
                filterConsequence
                pendingNotice
                reciprocityFooter
                historyFeed
            }
            .padding()
        }
        .background(Color(hex: CarteTheme.bg))
        .navigationTitle(viewModel.contact.displayName)
        .task { await viewModel.refresh() }
    }

    // MARK: - Header

    @ViewBuilder
    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(viewModel.contact.displayName)
                .font(.largeTitle.weight(.semibold))
                .foregroundStyle(Color(hex: CarteTheme.text))
            Text(Fr.t(.ficheSubtitle))
                .font(.subheadline)
                .foregroundStyle(Color(hex: CarteTheme.textDim))
            // FCH-02: asymmetric/private — explicit, not implied.
            Text(Fr.t(.ficheAsymmetryHint))
                .font(.footnote)
                .foregroundStyle(Color(hex: CarteTheme.textDim))
        }
    }

    // MARK: - FCH-05 staleness nudge (discreet, never a modal)

    @ViewBuilder
    private var stalenessNudge: some View {
        if viewModel.shouldShowStalenessNudge {
            VStack(alignment: .leading, spacing: 8) {
                Text(Fr.t(.ficheStaleTitle))
                    .font(.subheadline)
                    .foregroundStyle(Color(hex: CarteTheme.text))
                HStack(spacing: 12) {
                    Button(Fr.t(.ficheStaleConfirm)) {
                        Task { await viewModel.reconfirmStillAccurate() }
                    }
                    .accessibilityLabel(Fr.t(.ficheStaleConfirm))

                    Button(Fr.t(.ficheStaleLater)) {
                        Task { await viewModel.snoozeStaleness() }
                    }
                    .accessibilityLabel(Fr.t(.ficheStaleLater))
                }
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color(hex: CarteTheme.surface))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color(hex: CarteTheme.line), lineWidth: 1))
            )
            .accessibilityElement(children: .contain)
        }
    }

    // MARK: - FCH-01 four tap-editable axes

    @ViewBuilder
    private var axes: some View {
        VStack(alignment: .leading, spacing: 16) {
            axisSection(title: Fr.t(.ficheAxisIntimite)) {
                HStack {
                    ForEach(VaultRing.range, id: \.self) { ring in
                        axisChip(
                            label: CarteLabels.ringLabel[ring] ?? "",
                            selected: viewModel.contact.ring == ring
                        ) {
                            Task { await viewModel.setRing(ring) }
                        }
                    }
                }
            }

            axisSection(title: Fr.t(.ficheAxisRoles)) {
                FlowRolesView(
                    roles: FicheVocabulary.roles,
                    selected: Set(viewModel.contact.roles)
                ) { role in
                    Task { await viewModel.toggleRole(role) }
                }
            }

            axisSection(title: Fr.t(.ficheAxisEtat)) {
                HStack {
                    ForEach(FicheVocabulary.etats, id: \.self) { etat in
                        axisChip(label: etat, selected: viewModel.contact.etat == etat) {
                            Task { await viewModel.setEtat(etat) }
                        }
                    }
                }
            }

            axisSection(title: Fr.t(.ficheAxisRessenti)) {
                HStack {
                    ForEach(FicheVocabulary.ressentis, id: \.self) { ressenti in
                        axisChip(label: ressenti, selected: viewModel.contact.ressenti == ressenti) {
                            Task { await viewModel.setRessenti(ressenti) }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func axisSection(title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
                .foregroundStyle(Color(hex: CarteTheme.text))
            content()
        }
    }

    @ViewBuilder
    private func axisChip(label: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.subheadline)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(
                    Capsule()
                        .fill(selected ? Color(hex: CarteTheme.accent) : Color(hex: CarteTheme.surface))
                )
                .foregroundStyle(selected ? Color(hex: CarteTheme.accentInk) : Color(hex: CarteTheme.text))
                .overlay(Capsule().stroke(Color(hex: CarteTheme.line), lineWidth: selected ? 0 : 1))
        }
        .accessibilityLabel(label)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    // MARK: - FCH-06 filter consequence (informational only)

    @ViewBuilder
    private var filterConsequence: some View {
        if let text = viewModel.filterConsequenceText {
            Text(text)
                .font(.footnote)
                .foregroundStyle(Color(hex: CarteTheme.textDim))
        }
    }

    // MARK: - FCH-08 pending (not-yet-joined) notice

    @ViewBuilder
    private var pendingNotice: some View {
        if !viewModel.isEnvieActive {
            VStack(alignment: .leading, spacing: 4) {
                Text(Fr.t(.fichePendingHint))
                Text(Fr.t(.ficheEnvieInactive))
            }
            .font(.footnote)
            .foregroundStyle(Color(hex: CarteTheme.textDim))
        }
    }

    // MARK: - FCH-03 reciprocity signal — qualitative only, never numeric

    @ViewBuilder
    private var reciprocityFooter: some View {
        Text(Fr.t(.ficheNoMetrics))
            .font(.caption)
            .foregroundStyle(Color(hex: CarteTheme.textDim))
    }

    // MARK: - FCH-04 history feed

    @ViewBuilder
    private var historyFeed: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(Fr.t(.ficheHistoryTitle))
                .font(.headline)
                .foregroundStyle(Color(hex: CarteTheme.text))

            if viewModel.recentHistory.isEmpty {
                Text(Fr.t(.ficheHistoryEmpty))
                    .font(.footnote)
                    .foregroundStyle(Color(hex: CarteTheme.textDim))
            } else {
                ForEach(viewModel.recentHistory) { event in
                    historyRow(event)
                }
            }
        }
    }

    @ViewBuilder
    private func historyRow(_ event: FicheHistoryEvent) -> some View {
        HStack {
            Text(historyLabel(event))
                .font(.footnote)
                .foregroundStyle(Color(hex: CarteTheme.text))
            Spacer()
            Text(event.date, style: .date)
                .font(.caption2)
                .foregroundStyle(Color(hex: CarteTheme.textDim))
        }
    }

    private func historyLabel(_ event: FicheHistoryEvent) -> String {
        switch event.kind {
        case .axisChanged(let axis, let value):
            let axisLabel = axisDisplayName(axis)
            return value.map { "\(axisLabel) → \($0)" } ?? axisLabel
        case .reconfirmed:
            return Fr.t(.ficheHistoryReconfirmed)
        case .relationshipEvent(let text):
            return text
        }
    }

    private func axisDisplayName(_ rawAxis: String) -> String {
        switch FicheAxis(rawValue: rawAxis) {
        case .intimite: return Fr.t(.ficheAxisIntimite)
        case .roles: return Fr.t(.ficheAxisRoles)
        case .etat: return Fr.t(.ficheAxisEtat)
        case .ressenti: return Fr.t(.ficheAxisRessenti)
        case nil: return rawAxis
        }
    }
}

/// Simple wrapping multi-select for Rôles·contexte — a fixed, short list
/// (`FicheVocabulary.roles`), so a plain `HStack`/wrap via `LazyVGrid` is
/// enough; no need for a custom flow-layout algorithm.
private struct FlowRolesView: View {
    let roles: [String]
    let selected: Set<String>
    let onToggle: (String) -> Void

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 90))], alignment: .leading, spacing: 8) {
            ForEach(roles, id: \.self) { role in
                Button {
                    onToggle(role)
                } label: {
                    Text(role)
                        .font(.subheadline)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(
                            Capsule()
                                .fill(selected.contains(role) ? Color(hex: CarteTheme.accent) : Color(hex: CarteTheme.surface))
                        )
                        .foregroundStyle(selected.contains(role) ? Color(hex: CarteTheme.accentInk) : Color(hex: CarteTheme.text))
                        .overlay(Capsule().stroke(Color(hex: CarteTheme.line), lineWidth: selected.contains(role) ? 0 : 1))
                }
                .accessibilityLabel(role)
                .accessibilityAddTraits(selected.contains(role) ? .isSelected : [])
            }
        }
    }
}
