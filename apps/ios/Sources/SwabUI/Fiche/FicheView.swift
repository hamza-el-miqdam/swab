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
            // No SSOT token covers this size (largeTitle ≈34pt sits above the
            // wordmark's 26pt ceiling — same flagged gap as CarteView's page
            // title, docs/design-system.md §2) — left on the native style.
            Text(viewModel.contact.displayName)
                .font(.largeTitle.weight(.semibold))
                .foregroundStyle(Color(hex: CarteTheme.text))
            Text(Fr.t(.ficheSubtitle))
                .swabType(DesignTokens.Typography.subtitle, relativeTo: .subheadline)
                .foregroundStyle(Color(hex: CarteTheme.textDim))
            // FCH-02: asymmetric/private — explicit, not implied.
            Text(Fr.t(.ficheAsymmetryHint))
                .swabType(DesignTokens.Typography.subtitle, relativeTo: .footnote)
                .foregroundStyle(Color(hex: CarteTheme.textDim))
        }
    }

    // MARK: - FCH-05 staleness nudge (discreet, never a modal)

    @ViewBuilder
    private var stalenessNudge: some View {
        if viewModel.shouldShowStalenessNudge {
            VStack(alignment: .leading, spacing: 8) {
                Text(Fr.t(.ficheStaleTitle))
                    .swabType(DesignTokens.Typography.subtitle, relativeTo: .subheadline)
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
                RoundedRectangle(cornerRadius: CGFloat(DesignTokens.Radius.input))
                    .fill(Color(hex: CarteTheme.surface))
                    .overlay(RoundedRectangle(cornerRadius: CGFloat(DesignTokens.Radius.input)).stroke(Color(hex: CarteTheme.line), lineWidth: 1))
            )
            .accessibilityElement(children: .contain)
        }
    }

    // MARK: - FCH-01 four tap-editable axes

    /// Ring number ↔ display label, in ring order — `WrappingChipRow`
    /// operates on the label strings (its items ARE the display text, same
    /// contract as the other three axes), so Intimité needs this pairing to
    /// map a tapped label back to the `Int` `Vault.setRing` needs.
    private var ringItems: [(ring: Int, label: String)] {
        VaultRing.range.compactMap { ring in
            CarteLabels.ringLabel[ring].map { (ring, $0) }
        }
    }

    @ViewBuilder
    private var axes: some View {
        VStack(alignment: .leading, spacing: 16) {
            axisSection(title: Fr.t(.ficheAxisIntimite)) {
                let items = ringItems
                WrappingChipRow(
                    items: items.map(\.label),
                    isSelected: { label in
                        guard let ring = viewModel.contact.ring else { return false }
                        return CarteLabels.ringLabel[ring] == label
                    },
                    onTap: { label in
                        guard let match = items.first(where: { $0.label == label }) else { return }
                        Task { await viewModel.setRing(match.ring) }
                    }
                )
            }

            // FCH-09: chips are labels (WrappingChipRow's documented
            // contract), resolved back to the stored value here — the same
            // map-back the Intimité ring above already does.
            axisSection(title: Fr.t(.ficheAxisRoles)) {
                WrappingChipRow(
                    items: FicheVocabulary.roleLabels,
                    isSelected: { label in
                        RoleContexte.fromLabel(label).map(viewModel.contact.roleValues.contains) ?? false
                    },
                    onTap: { label in
                        guard let role = RoleContexte.fromLabel(label) else { return }
                        Task { await viewModel.toggleRole(role) }
                    }
                )
            }

            axisSection(title: Fr.t(.ficheAxisEtat)) {
                WrappingChipRow(
                    items: FicheVocabulary.etatLabels,
                    isSelected: { viewModel.contact.etatValue?.label == $0 },
                    onTap: { label in
                        guard let etat = Etat.fromLabel(label) else { return }
                        Task { await viewModel.setEtat(etat) }
                    }
                )
            }

            axisSection(title: Fr.t(.ficheAxisRessenti)) {
                WrappingChipRow(
                    items: FicheVocabulary.ressentiLabels,
                    isSelected: { viewModel.contact.ressentiValue?.label == $0 },
                    onTap: { label in
                        guard let ressenti = Ressenti.fromLabel(label) else { return }
                        Task { await viewModel.setRessenti(ressenti) }
                    }
                )
            }
        }
    }

    @ViewBuilder
    private func axisSection(title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .swabType(DesignTokens.Typography.title, relativeTo: .headline)
                .foregroundStyle(Color(hex: CarteTheme.text))
            content()
        }
    }

    // MARK: - FCH-06 filter consequence (informational only)

    @ViewBuilder
    private var filterConsequence: some View {
        if let text = viewModel.filterConsequenceText {
            Text(text)
                .swabType(DesignTokens.Typography.subtitle, relativeTo: .footnote)
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
            .swabType(DesignTokens.Typography.subtitle, relativeTo: .footnote)
            .foregroundStyle(Color(hex: CarteTheme.textDim))
        }
    }

    // MARK: - FCH-03 reciprocity signal — qualitative only, never numeric

    @ViewBuilder
    private var reciprocityFooter: some View {
        Text(Fr.t(.ficheNoMetrics))
            .swabType(DesignTokens.Typography.caption, relativeTo: .caption)
            .foregroundStyle(Color(hex: CarteTheme.textDim))
    }

    // MARK: - FCH-04 history feed

    @ViewBuilder
    private var historyFeed: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(Fr.t(.ficheHistoryTitle))
                .swabType(DesignTokens.Typography.title, relativeTo: .headline)
                .foregroundStyle(Color(hex: CarteTheme.text))

            if viewModel.recentHistory.isEmpty {
                Text(Fr.t(.ficheHistoryEmpty))
                    .swabType(DesignTokens.Typography.subtitle, relativeTo: .footnote)
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
                .swabType(DesignTokens.Typography.subtitle, relativeTo: .footnote)
                .foregroundStyle(Color(hex: CarteTheme.text))
            Spacer()
            Text(event.date, style: .date)
                .swabType(DesignTokens.Typography.caption, relativeTo: .caption2)
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
