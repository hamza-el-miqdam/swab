/// ONB-02 (first half): phone entry. The raw number is hashed on-device in
/// `PhoneViewModel.requestCode` (IDT-01) — only the hash reaches signup
/// state and the API.
import SwabCore
import SwiftUI

public struct PhoneView: View {
    @State private var viewModel: PhoneViewModel
    private let onCodeRequested: () -> Void

    public init(viewModel: PhoneViewModel, onCodeRequested: @escaping () -> Void) {
        _viewModel = State(initialValue: viewModel)
        self.onCodeRequested = onCodeRequested
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(Fr.t(.brandName)).font(.headline)
            Text(Fr.t(.phoneTitle)).font(.title2)
            Text(Fr.t(.phoneHint)).font(.footnote)

            TextField(Fr.t(.phonePlaceholder), text: $viewModel.rawPhone)
                #if os(iOS)
                    .keyboardType(.phonePad)
                #endif
                .accessibilityLabel(Fr.t(.phoneTitle))

            if viewModel.showError {
                Text(Fr.t(.phoneError))
            }

            Spacer()

            Button(Fr.t(.phoneCta)) {
                Task {
                    await viewModel.requestCode()
                    if viewModel.didRequestCode {
                        onCodeRequested()
                    }
                }
            }
            .disabled(!viewModel.canSubmit)
            .accessibilityLabel(Fr.t(.phoneCta))
        }
        .padding()
    }
}
