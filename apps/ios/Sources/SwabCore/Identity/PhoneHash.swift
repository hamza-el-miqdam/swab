/// IDT-01 / IDT-06: phone numbers are salted and hashed ON-DEVICE; the raw
/// number never leaves the phone. The salt is a per-deployment namespace
/// shared by all clients (required for contact discovery), not a secret.
import CryptoKit
import Foundation

public enum PhoneHash {
    public static let defaultSalt = "swab-poc-phone-salt-v1"

    /// Best-effort E.164 normalization: keep a leading `+` if present, strip
    /// every other non-ASCII-digit character. Mirrors the RN reference
    /// (`src/lib/phoneHash.ts`) exactly: JS `\D` only ever matches ASCII
    /// non-digits, so we restrict to `"0"..."9"` rather than
    /// `Character.isNumber` (which would also accept Arabic-indic digits and
    /// diverge from the RN/Android normalization).
    public static func normalize(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        let hasPlus = trimmed.hasPrefix("+")
        let digits = trimmed.filter { ("0"..."9").contains($0) }
        return hasPlus ? "+\(digits)" : digits
    }

    /// `sha256("<salt>:<normalized>")`, lowercase hex.
    public static func hash(_ raw: String, salt: String = defaultSalt) -> String {
        let normalized = normalize(raw)
        let input = "\(salt):\(normalized)"
        let digest = SHA256.hash(data: Data(input.utf8))
        return digest.map { byte in String(format: "%02x", byte) }.joined()
    }
}
