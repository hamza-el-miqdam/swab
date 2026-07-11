/// Vault encryption — DECISION RECORD (VLT-01, ONB-02).
///
/// Primitive: AES-256-GCM via CryptoKit, 32-byte key, 12-byte IV, 16-byte tag,
/// no AAD. Wire format: `base64( IV(12) ‖ AUTH_TAG(16) ‖ CIPHERTEXT )`.
///
/// GOTCHA: CryptoKit's `AES.GCM.SealedBox.combined` is `IV ‖ CIPHERTEXT ‖ TAG`
/// — this does NOT match the wire format inherited from the RN reference
/// (`react-native-quick-crypto`, whose `getAuthTag()` is appended after the
/// ciphertext bytes it already emitted). We build/parse the wire format by
/// hand from `iv`, `tag`, and `ciphertext` rather than using `.combined`.
import CryptoKit
import Foundation

public enum VaultCryptoError: Error, Equatable, Sendable {
    case invalidKeyLength
    case invalidPayload
    case randomGenerationFailed
}

public enum VaultCrypto {
    public static let keyLength = 32
    public static let ivLength = 12
    public static let tagLength = 16

    /// Encrypts `plaintext` under `key`, returning
    /// `base64(IV ‖ TAG ‖ CIPHERTEXT)`.
    ///
    /// `fixedIV` is a test-only seam to reproduce `vault-test-vectors.json`
    /// byte-for-byte; production callers must never pass it (fresh random IV
    /// every call).
    public static func encrypt(plaintext: String, key: Data, fixedIV: Data? = nil) throws -> String {
        guard key.count == keyLength else { throw VaultCryptoError.invalidKeyLength }
        let symmetricKey = SymmetricKey(data: key)
        let nonce: AES.GCM.Nonce
        if let fixedIV {
            guard fixedIV.count == ivLength else { throw VaultCryptoError.invalidPayload }
            nonce = try AES.GCM.Nonce(data: fixedIV)
        } else {
            nonce = AES.GCM.Nonce()
        }
        let plaintextData = Data(plaintext.utf8)
        let sealed = try AES.GCM.seal(plaintextData, using: symmetricKey, nonce: nonce)

        var wire = Data(capacity: ivLength + tagLength + sealed.ciphertext.count)
        wire.append(Data(nonce))
        wire.append(sealed.tag)
        wire.append(sealed.ciphertext)
        return wire.base64EncodedString()
    }

    /// Decrypts `base64(IV ‖ TAG ‖ CIPHERTEXT)` under `key`, returning the
    /// UTF-8 plaintext.
    public static func decrypt(blobBase64: String, key: Data) throws -> String {
        guard key.count == keyLength else { throw VaultCryptoError.invalidKeyLength }
        guard let payload = Data(base64Encoded: blobBase64) else {
            throw VaultCryptoError.invalidPayload
        }
        guard payload.count >= ivLength + tagLength else {
            throw VaultCryptoError.invalidPayload
        }
        let iv = payload.subdata(in: 0..<ivLength)
        let tag = payload.subdata(in: ivLength..<(ivLength + tagLength))
        let ciphertext = payload.subdata(in: (ivLength + tagLength)..<payload.count)

        let sealedBox = try AES.GCM.SealedBox(
            nonce: try AES.GCM.Nonce(data: iv),
            ciphertext: ciphertext,
            tag: tag
        )
        let symmetricKey = SymmetricKey(data: key)
        let decrypted = try AES.GCM.open(sealedBox, using: symmetricKey)
        guard let string = String(data: decrypted, encoding: .utf8) else {
            throw VaultCryptoError.invalidPayload
        }
        return string
    }

    /// 32 cryptographically random bytes for a fresh vault key (ONB-02: right
    /// after OTP verification, before any classification input is possible).
    public static func randomKey() throws -> Data {
        var bytes = Data(count: keyLength)
        let status = bytes.withUnsafeMutableBytes { ptr -> OSStatus in
            SecRandomCopyBytes(kSecRandomDefault, keyLength, ptr.baseAddress!)
        }
        guard status == errSecSuccess else { throw VaultCryptoError.randomGenerationFailed }
        return bytes
    }
}
