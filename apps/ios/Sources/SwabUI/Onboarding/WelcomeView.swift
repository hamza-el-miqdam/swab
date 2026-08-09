/// ONB-01: brand, tagline, privacy promise, single CTA. Layout uses
/// leading/trailing alignment only (never left/right) — French is primary,
/// Arabic/RTL (صواب) is on the roadmap.
import SwabCore
import SwiftUI

public struct WelcomeView: View {
    @State private var viewModel: WelcomeViewModel
    private let onStarted: () -> Void

    public init(viewModel: WelcomeViewModel, onStarted: @escaping () -> Void) {
        _viewModel = State(initialValue: viewModel)
        self.onStarted = onStarted
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(Fr.t(.brandName))
                .swabType(DesignTokens.Typography.wordmark, relativeTo: .headline)
            Spacer()
            Text(Fr.t(.welcomeTagline))
                .swabType(DesignTokens.Typography.title, relativeTo: .title2)
            Text(Fr.t(.welcomePromise))
                .swabType(DesignTokens.Typography.base, relativeTo: .body)
            Spacer()
            Button(Fr.t(.welcomeCta)) {
                Task {
                    await viewModel.start()
                    onStarted()
                }
            }
            .accessibilityLabel(Fr.t(.welcomeCta))
        }
        .padding()
    }
}
