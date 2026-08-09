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
            Text(Fr.t(.brandName)).swabType(DesignTokens.Typography.wordmark, relativeTo: .headline)
            Text(Fr.t(.phoneTitle)).swabType(DesignTokens.Typography.title, relativeTo: .title2)
            Text(Fr.t(.phoneHint)).swabType(DesignTokens.Typography.subtitle, relativeTo: .footnote)

            TextField(Fr.t(.phonePlaceholder), text: $viewModel.rawPhone)
                #if os(iOS)
                    .keyboardType(.phonePad)
                    .textContentType(.telephoneNumber)
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
        // SUG-IOS-010: the error Text renders silently otherwise — VoiceOver
        // users get no notification a request failed.
        .onChange(of: viewModel.showError) { _, isShowing in
            if isShowing {
                AccessibilityNotification.Announcement(Fr.t(.phoneError)).post()
            }
        }
    }
}
