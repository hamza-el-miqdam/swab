/// SUG-DES-011 — the charter's Tag/chip, segmented-cell, and Switch controls
/// are drawn smaller than Apple's 44×44 pt minimum touch target (tag ≈34px,
/// segmented cell ≈40px, switch 21px — `docs/design-system.md` §3 "Minimum
/// touch target"). This modifier extends the *tappable* region to the
/// charter minimum without growing the *drawn* control: apply it to the
/// outermost `Button`/interactive wrapper, after any visual
/// padding/background, so the invisible frame grows around the unchanged
/// visual and `.contentShape(Rectangle())` makes the whole frame hittable
/// (not just the visually-filled capsule/cell).
import SwabCore
import SwiftUI

public struct MinTouchTarget: ViewModifier {
    public func body(content: Content) -> some View {
        content
            .frame(
                minWidth: DesignTokens.Component.Touch.minTarget,
                minHeight: DesignTokens.Component.Touch.minTarget
            )
            .contentShape(Rectangle())
    }
}

extension View {
    /// Ensures this view's tappable region is at least
    /// `DesignTokens.Component.Touch.minTarget` (44 pt) in each dimension,
    /// independent of its visual size. See `MinTouchTarget`.
    public func minTouchTarget() -> some View {
        modifier(MinTouchTarget())
    }
}
