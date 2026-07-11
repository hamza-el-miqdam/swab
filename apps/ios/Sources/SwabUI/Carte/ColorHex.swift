/// Converts `SwabCore`'s plain hex-string theme/état colors (kept
/// UI-framework-free by design) into SwiftUI `Color`. This is the ONLY
/// place `#RRGGBB` parsing happens for the carte surface.
import SwiftUI

extension Color {
    init(hex: String) {
        var value = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        if value.count == 6 {
            value += "FF"
        }
        var rgba: UInt64 = 0
        Scanner(string: value).scanHexInt64(&rgba)
        let r = Double((rgba & 0xFF00_0000) >> 24) / 255
        let g = Double((rgba & 0x00FF_0000) >> 16) / 255
        let b = Double((rgba & 0x0000_FF00) >> 8) / 255
        let a = Double(rgba & 0x0000_00FF) / 255
        self.init(.sRGB, red: r, green: g, blue: b, opacity: a)
    }
}
