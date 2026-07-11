/// MAP-04 — the peek sheet: tap a contact, read Intimité / État / Rôles at
/// a glance. Native `.sheet` presentation (SwiftUI's own slide-up, no
/// custom gesture code needed here — that budget went to `RadialMapView`).
///
/// « Ouvrir la fiche » is the FS-03 seam: was rendered visibly DISABLED
/// until FS-03; now wired to `onOpenFiche`, which `CarteView` uses to
/// close this sheet and push the real fiche screen.
import SwabCore
import SwiftUI

private let unset = "—" // quiet dash, not copy: an axis simply not filled in yet

struct PeekSheetView: View {
    let contact: VaultContact
    let onOpenFiche: (VaultContact) -> Void

    var body: some View {
        let palette = EtatColors.color(for: contact.etat)

        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Circle()
                    .fill(Color(hex: palette.background))
                    .overlay(Circle().stroke(Color(hex: CarteTheme.line), lineWidth: 0.5))
                    .frame(width: 10, height: 10)
                Text(contact.displayName)
                    .font(.title3.weight(.medium))
                    .foregroundStyle(Color(hex: CarteTheme.text))
            }

            row(label: Fr.t(.carteSheetIntimite), value: contact.ring.flatMap { CarteLabels.ringLabel[$0] } ?? unset)
            row(label: Fr.t(.carteSheetEtat), value: contact.etat ?? unset)
            row(
                label: Fr.t(.carteSheetRoles),
                value: contact.roles.isEmpty ? unset : contact.roles.joined(separator: " · ")
            )

            Button {
                onOpenFiche(contact)
            } label: {
                Text(Fr.t(.carteOpenFiche))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.bordered)
            .accessibilityLabel(Fr.t(.carteOpenFiche))

            Spacer(minLength: 0)
        }
        .padding()
        .presentationDetents([.medium, .large])
    }

    @ViewBuilder
    private func row(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .foregroundStyle(Color(hex: CarteTheme.textDim))
                .font(.subheadline)
            Spacer()
            Text(value)
                .foregroundStyle(Color(hex: CarteTheme.text))
                .font(.subheadline)
        }
    }
}
