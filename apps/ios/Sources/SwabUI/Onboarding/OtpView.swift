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
                Text(Fr.t(.brandName)).swabType(DesignTokens.Typography.wordmark, relativeTo: .headline)
                Text(Fr.t(.otpMissingPhone))
                Button(Fr.t(.otpBackToPhone), action: onBackToPhone)
                    .accessibilityLabel(Fr.t(.otpBackToPhone))
            }
            .padding()
        } else {
            VStack(alignment: .leading, spacing: 16) {
                Text(Fr.t(.brandName)).swabType(DesignTokens.Typography.wordmark, relativeTo: .headline)
                Text(Fr.t(.otpTitle)).swabType(DesignTokens.Typography.title, relativeTo: .title2)

                #if DEBUG
                // Dev-only convenience: the API only ever returns `devCode`
                // outside `NODE_ENV=production` (`apps/api/src/routes/auth.ts`),
                // but a Release build must never render it regardless — this
                // is a compile-time gate, not a trust-the-server one (G1).
                if let devCode = viewModel.devCode {
                    Text("Code (dev) : \(devCode)")
                }
                #endif

                TextField(Fr.t(.otpPlaceholder), text: $viewModel.code)
                    #if os(iOS)
                        .keyboardType(.numberPad)
                        .textContentType(.oneTimeCode)
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
            // SUG-IOS-010: same silent-error gap as PhoneView.
            .onChange(of: viewModel.showError) { _, isShowing in
                if isShowing {
                    AccessibilityNotification.Announcement(Fr.t(.otpError)).post()
                }
            }
        }
    }
}
