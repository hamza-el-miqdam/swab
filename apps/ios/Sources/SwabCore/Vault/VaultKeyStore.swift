/// ONB-02: called right after OTP verification, before any classification
/// input is possible. Key never leaves the device (recovery phrase backup is
/// FS-07 OQ-IDT-2, out of onboarding scope). Store id keeps the
/// `swab.vault.key.v1` versioned-name convention shared with the RN
/// reference (`expo-secure-store`) and the Android target (Keystore).
import Foundation

public struct VaultKeyStore: Sendable {
    static let storeId = "swab.vault.key.v1"

    private let store: SecureStore

    public init(store: SecureStore) {
        self.store = store
    }

    public func getOrCreateKey() throws -> Data {
        if let existingB64 = try store.get(Self.storeId),
            let existing = Data(base64Encoded: existingB64)
        {
            return existing
        }
        let key = try VaultCrypto.randomKey()
        try store.set(Self.storeId, value: key.base64EncodedString())
        return key
    }
}
