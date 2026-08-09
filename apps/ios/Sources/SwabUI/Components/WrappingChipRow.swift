/// Wrapping multi-row chip layout, shared by `FicheView`'s four axes and
/// `CalibrateView`'s état/ressenti rows (SUG-IOS-010, SUG-IOS-015).
///
/// Was `FicheView`'s private `FlowRolesView` (Rôles-only) — generalized and
/// promoted here because a plain `HStack` does not wrap: at accessibility
/// Dynamic Type sizes, four chips like « Très proche » cannot fit one row
/// and SwiftUI compresses/truncates them.
///
/// Deliberately EAGER (`VStack`/`HStack`, chunked into fixed-size rows), NOT
/// `LazyVGrid` — found the hard way (SUG-IOS-010 XCUITest run): a
/// `LazyVGrid` inside a `ScrollView` does not materialize children into the
/// accessibility tree until they scroll near the viewport, so
/// `waitForExistence` on a chip pushed below the fold (routine at
/// accessibility text sizes, where everything above it is taller) fails
/// intermittently — the exact bug this suggestion exists to fix, reproduced
/// by the fix's own first draft. Every vocabulary this renders is fixed and
/// short (≤ 6 items), so eager rendering costs nothing.
///
/// `items` ARE the display strings (not raw model values) — `isSelected`/
/// `onTap` operate on that same string. A caller whose underlying value
/// isn't itself a String (e.g. `FicheView`'s Intimité ring) maps back to
/// its value at the call site.
import SwabCore
import SwiftUI

struct WrappingChipRow: View {
    let items: [String]
    let isSelected: (String) -> Bool
    let onTap: (String) -> Void

    /// Fixed, not measured: two chips comfortably fit any supported width
    /// even at the largest accessibility text sizes, so there is no need
    /// for `GeometryReader`/adaptive measurement (which would also risk
    /// reintroducing a layout pass that delays materialization).
    private static let itemsPerRow = 2

    private var rows: [[String]] {
        stride(from: 0, to: items.count, by: Self.itemsPerRow).map {
            Array(items[$0..<Swift.min($0 + Self.itemsPerRow, items.count)])
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                HStack(spacing: 8) {
                    ForEach(row, id: \.self) { item in
                        chip(item)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func chip(_ item: String) -> some View {
        Button {
            onTap(item)
        } label: {
            Text(item)
                .swabType(DesignTokens.Typography.tag, relativeTo: .subheadline)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(
                    Capsule()
                        .fill(isSelected(item) ? Color(hex: CarteTheme.accent) : Color(hex: CarteTheme.surface))
                )
                .foregroundStyle(isSelected(item) ? Color(hex: CarteTheme.accentInk) : Color(hex: CarteTheme.text))
                .overlay(Capsule().stroke(Color(hex: CarteTheme.line), lineWidth: isSelected(item) ? 0 : 1))
        }
        .accessibilityLabel(item)
        .accessibilityAddTraits(isSelected(item) ? .isSelected : [])
        .minTouchTarget()
    }
}
