/// ONB-02 (second half): OTP verification. On success the session is stored
/// and the vault key is created BEFORE any classification input is possible
/// (`OtpViewModel.verify`).
import SwabCore
import SwiftUI

public struct OtpView: View {
    @State private var viewModel: OtpViewModel
    private let onVerified: () -> Void
    private let onBackToPhone: () -> Void

    public init(viewModel: OtpViewModel, onVerified: @escaping () -> Void, onBackToPhone: @escaping () -> Void) {
        _viewModel = State(initialValue: viewModel)
        self.onVerified = onVerified
        self.onBackToPhone = onBackToPhone
    }

    public var body: some View {
        // Process death between phone and OTP: pending hash is memory-only,
        // restart resumes at the phone step (OnboardingStateStore) — offer
        // the way back explicitly.
        if viewModel.phoneHash == nil {
            VStack(alignment: .leading, spacing: 16) {
                Text(Fr.t(.brandName)).font(.headline)
                Text(Fr.t(.otpMissingPhone))
                Button(Fr.t(.otpBackToPhone), action: onBackToPhone)
                    .accessibilityLabel(Fr.t(.otpBackToPhone))
            }
            .padding()
        } else {
            VStack(alignment: .leading, spacing: 16) {
                Text(Fr.t(.brandName)).font(.headline)
                Text(Fr.t(.otpTitle)).font(.title2)

                if let devCode = viewModel.devCode {
                    Text("Code (dev) : \(devCode)")
                }

                TextField(Fr.t(.otpPlaceholder), text: $viewModel.code)
                    #if os(iOS)
                        .keyboardType(.numberPad)
                    #endif
                    .accessibilityLabel(Fr.t(.otpTitle))

                if viewModel.needsName {
                    TextField(Fr.t(.otpNamePrompt), text: $viewModel.displayName)
                        .accessibilityLabel(Fr.t(.otpNamePrompt))
                }

                if viewModel.showError {
                    Text(Fr.t(.otpError))
                }

                Spacer()

                Button(Fr.t(.otpCta)) {
                    Task {
                        await viewModel.verify()
                        if viewModel.didVerify {
                            onVerified()
                        }
                    }
                }
                .disabled(!viewModel.canVerify)
                .accessibilityLabel(Fr.t(.otpCta))
            }
            .padding()
        }
    }
}
