/// ONB-03: « Qui compte pour toi ? » — import (permission-gated, hashed
/// on-device) or manual add; « Passer » skips with no penalty and no nag.
import SwabCore
import SwiftUI

public struct ContactsView: View {
    @State private var viewModel: ContactsViewModel
    private let onContinue: () -> Void

    public init(viewModel: ContactsViewModel, onContinue: @escaping () -> Void) {
        _viewModel = State(initialValue: viewModel)
        self.onContinue = onContinue
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(Fr.t(.brandName)).font(.headline)
            Text(Fr.t(.contactsTitle)).font(.title2)
            Text(Fr.t(.contactsHint)).font(.footnote)

            Button(Fr.t(.contactsImport)) {
                Task { await viewModel.importContacts() }
            }
            .accessibilityLabel(Fr.t(.contactsImport))

            if viewModel.accessDenied {
                Text(Fr.t(.contactsDenied))
            }

            HStack {
                TextField(Fr.t(.contactsManualPlaceholder), text: $viewModel.manualName)
                    .accessibilityLabel(Fr.t(.contactsManualPlaceholder))
                Button(Fr.t(.contactsAdd)) {
                    Task { await viewModel.addManual() }
                }
                .accessibilityLabel(Fr.t(.contactsAdd))
            }

            List(viewModel.importable, id: \.name) { contact in
                Button(contact.name) {
                    Task { await viewModel.pick(contact) }
                }
                .accessibilityLabel(contact.name)
            }
            #if os(iOS)
                .listStyle(.plain)
            #endif

            if !viewModel.addedNames.isEmpty {
                Text(viewModel.addedNames.joined(separator: " · "))
            }

            Spacer()

            if viewModel.addedNames.isEmpty {
                Button(Fr.t(.contactsSkip)) {
                    Task {
                        await viewModel.advance()
                        onContinue()
                    }
                }
                .accessibilityLabel(Fr.t(.contactsSkip))
            } else {
                Button(Fr.t(.contactsContinue)) {
                    Task {
                        await viewModel.advance()
                        onContinue()
                    }
                }
                .accessibilityLabel(Fr.t(.contactsContinue))
            }
        }
        .padding()
        .task { await viewModel.refresh() }
    }
}
