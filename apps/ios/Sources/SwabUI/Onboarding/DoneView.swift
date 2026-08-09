/// ONB-07: completion. The promise, restated at the exact moment it became
/// true. Vault sync is attempted best-effort — offline completion is a
/// first-class path (FS-01 acceptance 1); sync retries later (VLT-04).
import SwabCore
import SwiftUI

public struct DoneView: View {
    @State private var viewModel: DoneViewModel
    private let onFinished: () -> Void

    public init(viewModel: DoneViewModel, onFinished: @escaping () -> Void) {
        _viewModel = State(initialValue: viewModel)
        self.onFinished = onFinished
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(Fr.t(.brandName)).swabType(DesignTokens.Typography.wordmark, relativeTo: .headline)
            Spacer()
            // DesignTokens.Typography.doneTitle is the SSOT's "success title" role, named for exactly this screen.
            Text(Fr.t(.doneTitle)).swabType(DesignTokens.Typography.doneTitle, relativeTo: .title2)
            Text(Fr.t(.doneSubtitle))
            Text(Fr.t(.donePromise))
            Spacer()
            Button(Fr.t(.doneCta)) {
                Task {
                    await viewModel.finish()
                    onFinished()
                }
            }
            .accessibilityLabel(Fr.t(.doneCta))
        }
        .padding()
    }
}
