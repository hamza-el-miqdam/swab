/// MAP-08 — the accessibility fallback: a `List` grouped by ring,
/// feature-equivalent to the radial view (same label vocabulary via
/// `CarteLabels.contactLabel`, same tap action). Unplaced contacts get
/// their own trailing section so nothing is hidden from screen-reader
/// users either.
import SwabCore
import SwiftUI

struct RingListView: View {
    let contacts: [VaultContact]
    let onTapContact: (VaultContact) -> Void

    private var sections: [(title: String?, contacts: [VaultContact])] {
        var result: [(String?, [VaultContact])] = MapGeometry.rings.map { ring in
            (CarteLabels.ringLabel[ring], contacts.filter { $0.ring == ring })
        }
        let unplaced = contacts.filter { $0.ring == nil }
        if !unplaced.isEmpty {
            result.append((nil, unplaced))
        }
        return result.filter { !$0.1.isEmpty }
    }

    var body: some View {
        List {
            ForEach(Array(sections.enumerated()), id: \.offset) { _, section in
                Section {
                    ForEach(section.contacts, id: \.id) { contact in
                        Button {
                            onTapContact(contact)
                        } label: {
                            HStack(spacing: 8) {
                                Circle()
                                    .fill(Color(hex: EtatColors.color(for: contact.etat).background))
                                    .frame(width: 10, height: 10)
                                Text(contact.displayName)
                                Spacer()
                            }
                        }
                        .accessibilityLabel(CarteLabels.contactLabel(contact))
                    }
                } header: {
                    if let title = section.title {
                        Text(title)
                    }
                }
            }
        }
        .listStyle(.plain)
    }
}
