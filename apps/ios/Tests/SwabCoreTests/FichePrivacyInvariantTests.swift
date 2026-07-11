/// FS-03 acceptance criterion: "Given any axis edit, when inspecting
/// network traffic, then only POST /vault (opaque blob) occurs — no
/// field-level classification data in any payload." This drives a REAL
/// `ApiClient.pushVault` call (through `VaultSync.sync()`, exactly the path
/// production code takes) against a fake `HTTPTransport` that captures the
/// literal `URLRequest.httpBody` bytes — i.e. this inspects the actual
/// serialized wire payload, not just the `Encodable` type's field list.
import Foundation
import XCTest

@testable import SwabCore

private actor CapturingHTTPTransport: HTTPTransport {
    private(set) var requests: [URLRequest] = []

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        requests.append(request)
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: 200,
            httpVersion: nil,
            headerFields: nil
        )!
        return (Data(#"{"version":1}"#.utf8), response)
    }
}

final class FichePrivacyInvariantTests: XCTestCase {
    /// Every distinct plaintext string a fiche axis edit could produce —
    /// ring label, état, ressenti, and every placeholder role — none of
    /// these literal strings may ever appear in what goes over the wire.
    private static let classificationStrings: [String] =
        [1, 2, 3, 4].compactMap { CarteLabels.ringLabel[$0] }
            + FicheVocabulary.etats
            + FicheVocabulary.ressentis
            + FicheVocabulary.roles
            + ["SecretDisplayName"]

    func test_FCH01_axisEditsOverNetwork_onlyOpaqueBlobAndVersionEverSent() async throws {
        let kv = InMemoryKeyValueStore()
        let secureStore = InMemorySecureStore()
        let vault = Vault(kv: kv, secureStore: secureStore)

        let contact = try await vault.addContact(displayName: "SecretDisplayName")
        try await vault.setFicheRing(id: contact.id, ring: 3)
        try await vault.setFicheEtat(id: contact.id, etat: FicheVocabulary.etats[0])
        try await vault.setFicheRessenti(id: contact.id, ressenti: FicheVocabulary.ressentis[2]) // "en pause"
        try await vault.setFicheRoles(id: contact.id, roles: FicheVocabulary.roles)
        try await vault.reconfirmFicheStaleness(id: contact.id)

        let transport = CapturingHTTPTransport()
        let apiClient = ApiClient(
            baseURL: URL(string: "https://example.invalid")!,
            transport: transport,
            session: Session(store: InMemorySecureStore())
        )
        try await VaultSync(vault: vault, api: apiClient).sync()

        let requests = await transport.requests
        XCTAssertEqual(requests.count, 1, "exactly one network call for one sync — POST /vault")
        let request = requests[0]
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.url?.path, "/vault")

        guard let bodyData = request.httpBody, let bodyString = String(data: bodyData, encoding: .utf8) else {
            return XCTFail("expected a JSON request body")
        }

        // The wire body must be exactly {blob, version} — nothing else.
        let json = try JSONSerialization.jsonObject(with: bodyData) as? [String: Any]
        XCTAssertEqual(Set(json?.keys.map { $0 } ?? []), ["blob", "version"])

        for plaintext in Self.classificationStrings {
            XCTAssertFalse(
                bodyString.contains(plaintext),
                "classification string '\(plaintext)' leaked into the network payload"
            )
        }
    }

    /// Same invariant, restated at the ciphertext-at-rest boundary: the
    /// encrypted blob handed to `VaultSync`/`ApiClient` never contains any
    /// classification plaintext as a substring either.
    func test_FCH01_encryptedVaultBlob_neverContainsClassificationPlaintext() async throws {
        let vault = Vault(kv: InMemoryKeyValueStore(), secureStore: InMemorySecureStore())
        let contact = try await vault.addContact(displayName: "SecretDisplayName")
        try await vault.setFicheRing(id: contact.id, ring: 1)
        try await vault.setFicheEtat(id: contact.id, etat: FicheVocabulary.etats[1])
        try await vault.setFicheRessenti(id: contact.id, ressenti: FicheVocabulary.ressentis[2])
        try await vault.setFicheRoles(id: contact.id, roles: [FicheVocabulary.roles[0]])

        let (blob, _) = try await vault.getEncryptedVault()

        for plaintext in Self.classificationStrings {
            XCTAssertFalse(blob.contains(plaintext), "'\(plaintext)' leaked into the encrypted-at-rest blob")
        }
    }
}
