/// VLT-01 crypto interop contract tests. Every vector in
/// `Fixtures/vault-test-vectors.json` (copied verbatim from
/// `docs/migration/vault-test-vectors.json`, generated from the RN
/// reference implementation) MUST be reproduced exactly — this is the
/// "verification gate for knowledge transfer complete" per
/// `docs/migration/rn-native-handoff.md` §7.
import Foundation
import XCTest

@testable import SwabCore

private struct AesVector: Decodable {
    let name: String
    let keyBase64: String
    let ivBase64: String
    let plaintextUtf8: String
    let blobBase64: String
}

private struct PhoneHashVector: Decodable {
    let input: String
    let normalized: String
    let salt: String
    let sha256Hex: String
}

private struct VectorFile: Decodable {
    let aes256gcm: [AesVector]
    let phoneHash: [PhoneHashVector]
}

final class VaultCryptoTests: XCTestCase {
    private func loadVectors() throws -> VectorFile {
        let url = Bundle.module.url(forResource: "vault-test-vectors", withExtension: "json")
        let data = try Data(contentsOf: XCTUnwrap(url))
        return try JSONDecoder().decode(VectorFile.self, from: data)
    }

    /// VLT-01: decrypting each vector's blob with the vector's key yields
    /// the vector's plaintext exactly.
    func test_VLT01_decryptsEveryVectorToItsExactPlaintext() throws {
        let vectors = try loadVectors()
        for vector in vectors.aes256gcm {
            let key = try XCTUnwrap(Data(base64Encoded: vector.keyBase64), "\(vector.name): bad key fixture")
            let plaintext = try VaultCrypto.decrypt(blobBase64: vector.blobBase64, key: key)
            XCTAssertEqual(plaintext, vector.plaintextUtf8, "vector: \(vector.name)")
        }
    }

    /// VLT-01: encrypting the vector's plaintext with the vector's key AND
    /// IV reproduces the vector's blob byte-for-byte (test-only IV
    /// injection — production always uses a fresh random IV).
    func test_VLT01_encryptWithFixedIVReproducesVectorBlobExactly() throws {
        let vectors = try loadVectors()
        for vector in vectors.aes256gcm {
            let key = try XCTUnwrap(Data(base64Encoded: vector.keyBase64), "\(vector.name): bad key fixture")
            let iv = try XCTUnwrap(Data(base64Encoded: vector.ivBase64), "\(vector.name): bad iv fixture")
            let blob = try VaultCrypto.encrypt(plaintext: vector.plaintextUtf8, key: key, fixedIV: iv)
            XCTAssertEqual(blob, vector.blobBase64, "vector: \(vector.name)")
        }
    }

    func test_VLT01_roundTripsWithFreshRandomIV() throws {
        let key = try VaultCrypto.randomKey()
        let plaintext = #"{"contacts":[{"id":"x","displayName":"Test","roles":[]}]}"#
        let blob = try VaultCrypto.encrypt(plaintext: plaintext, key: key)
        let decrypted = try VaultCrypto.decrypt(blobBase64: blob, key: key)
        XCTAssertEqual(decrypted, plaintext)
    }

    /// Two encryptions of the same plaintext must not produce the same
    /// ciphertext — proves the production path is not accidentally reusing
    /// the test-only fixed-IV seam.
    func test_VLT01_freshEncryptionsUseDistinctIVs() throws {
        let key = try VaultCrypto.randomKey()
        let plaintext = #"{"contacts":[]}"#
        let blobA = try VaultCrypto.encrypt(plaintext: plaintext, key: key)
        let blobB = try VaultCrypto.encrypt(plaintext: plaintext, key: key)
        XCTAssertNotEqual(blobA, blobB)
    }

    func test_VLT01_decryptRejectsWrongKey() throws {
        let vectors = try loadVectors()
        let vector = try XCTUnwrap(vectors.aes256gcm.first)
        let wrongKey = try VaultCrypto.randomKey()
        XCTAssertThrowsError(try VaultCrypto.decrypt(blobBase64: vector.blobBase64, key: wrongKey))
    }

    func test_VLT01_decryptRejectsTamperedCiphertext() throws {
        let vectors = try loadVectors()
        let vector = try XCTUnwrap(vectors.aes256gcm.first)
        let key = try XCTUnwrap(Data(base64Encoded: vector.keyBase64))
        var payload = try XCTUnwrap(Data(base64Encoded: vector.blobBase64))
        payload[payload.count - 1] ^= 0xFF
        XCTAssertThrowsError(try VaultCrypto.decrypt(blobBase64: payload.base64EncodedString(), key: key))
    }

    func test_VLT01_rejectsNonThirtyTwoByteKeys() {
        XCTAssertThrowsError(try VaultCrypto.encrypt(plaintext: "x", key: Data(repeating: 0, count: 16))) { error in
            XCTAssertEqual(error as? VaultCryptoError, .invalidKeyLength)
        }
    }

    /// IDT-01/IDT-06: phone-hash vectors reproduced exactly with the default salt.
    func test_IDT06_phoneHashVectorsMatchExactly() throws {
        let vectors = try loadVectors()
        for vector in vectors.phoneHash {
            XCTAssertEqual(PhoneHash.normalize(vector.input), vector.normalized, "input: \(vector.input)")
            XCTAssertEqual(vector.salt, PhoneHash.defaultSalt, "vector assumes the default salt")
            XCTAssertEqual(
                PhoneHash.hash(vector.input, salt: vector.salt),
                vector.sha256Hex,
                "input: \(vector.input)"
            )
        }
    }
}
