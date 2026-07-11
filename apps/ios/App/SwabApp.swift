/// Thin composition root for the first Simulator-runnable app shell.
///
/// This is deliberately minimal: it wires the existing `SwabCore`/`SwabUI`
/// types the same way production code eventually will (Keychain-backed
/// `SecureStore`, file-backed `KeyValueStore`, a real `ApiClient` pointed at
/// the local API), and drives the onboarding flow's six steps behind a
/// `NavigationStack`. No new domain logic lives here — see
/// `apps/ios/CHANGELOG.md` for what SwabCore/SwabUI already provide.
import SwabCore
import SwabUI
import Security
import SwiftUI

#if DEBUG
/// Test-only hooks for the `SwabAppUITests` XCUITest target (never compiled
/// into a Release build — see `apps/ios/CHANGELOG.md` for why this lives
/// here rather than in `SwabCore`). Guarded behind launch arguments a real
/// user's Simulator/device process never carries, so this changes nothing
/// about production behavior.
private enum UITestHooks {
    /// Wipes local persisted state (the plain kv file + this app's Keychain
    /// items) so every UI test starts from a genuinely fresh install without
    /// needing an actual `xcrun simctl uninstall` between tests.
    static let resetArgument = "--uitesting-reset"
    /// Seeds a pre-FS-03 vault shape (no `history`/`targetId`/staleness
    /// fields) through the REAL encrypt/decrypt path, so a UI test can
    /// assert the app doesn't crash decoding it on launch — the same
    /// backward-compat contract `VaultContact.init(from:)` promises, but
    /// exercised end-to-end instead of at the unit level.
    static let seedLegacyVaultArgument = "--uitesting-seed-legacy-vault"
    private static let keychainService = "com.swab.app"
    /// Mirrors `VaultKeyStore.storeId` (internal to `SwabCore`) — a stable,
    /// documented cross-platform key name, not a guessed implementation
    /// detail.
    private static let vaultKeyStoreId = "swab.vault.key.v1"

    static func apply(storeURL: URL, secureStore: SecureStore) {
        let args = ProcessInfo.processInfo.arguments
        guard args.contains(resetArgument) else { return }

        try? FileManager.default.removeItem(at: storeURL)
        let keychainQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
        ]
        SecItemDelete(keychainQuery as CFDictionary)

        guard args.contains(seedLegacyVaultArgument) else { return }
        seedLegacyVault(storeURL: storeURL, secureStore: secureStore)
    }

    private static func seedLegacyVault(storeURL: URL, secureStore: SecureStore) {
        do {
            let key = try VaultCrypto.randomKey()
            try secureStore.set(vaultKeyStoreId, value: key.base64EncodedString())
            // Deliberately hand-written JSON in the PRE-FS-03 shape: no
            // `history`/`targetId`/`lastAxisChangeAt`/`stalenessSnoozedUntil`
            // keys at all — exactly what a Wave 1/2 vault looked like on
            // disk before `VaultContact` grew those fields.
            let legacyContactsJSON = """
            {"contacts":[{"id":"legacy-contact-1","displayName":"Contact Historique","phoneHash":null,"ring":1,"roles":[],"etat":"disponible","ressenti":null}]}
            """
            let blob = try VaultCrypto.encrypt(plaintext: legacyContactsJSON, key: key)
            let seeded: [String: String] = [
                "vault.blob.v1": blob,
                "vault.version.v1": "1",
                "onboarding.step.v1": "complete",
            ]
            let data = try JSONEncoder().encode(seeded)
            try data.write(to: storeURL, options: .atomic)
        } catch {
            assertionFailure("UI test legacy vault seed failed: \(error)")
        }
    }
}
#endif

@main
struct SwabApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}

@MainActor
struct RootView: View {
    @State private var step: OnboardingStep = .welcome
    @State private var hasLoadedInitialStep = false
    /// `OnboardingStep` has no dedicated `.otp` case (the persisted step
    /// stays `.phone` until OTP verification succeeds, per ONB-08) — the
    /// phone/otp sub-navigation is purely local UI state.
    @State private var showingOtp = false

    private let secureStore: SecureStore
    private let kv: KeyValueStore
    private let onboarding: OnboardingStateStore
    private let pending = PendingSignup()
    private let session: Session
    private let vaultKeyStore: VaultKeyStore
    private let vault: Vault
    private let apiClient: ApiClient
    private let vaultSync: VaultSync

    init() {
        let secureStore = KeychainSecureStore()
        #if DEBUG
        UITestHooks.apply(storeURL: RootView.storeURL(), secureStore: secureStore)
        #endif
        let kv = FileKeyValueStore(url: RootView.storeURL())
        self.secureStore = secureStore
        self.kv = kv
        self.onboarding = OnboardingStateStore(kv: kv)
        self.session = Session(store: secureStore)
        self.vaultKeyStore = VaultKeyStore(store: secureStore)
        self.vault = Vault(kv: kv, secureStore: secureStore)
        // Local API per docker-compose (`docker compose up`) — not reachable
        // from a bare Simulator boot; the phone/otp screens degrade to their
        // existing `showError` path when it isn't running, which is fine for
        // a first shell run (see CHANGELOG note).
        let transport = URLSessionHTTPTransport()
        let apiClient = ApiClient(
            baseURL: URL(string: "http://127.0.0.1:3001")!,
            transport: transport,
            session: session
        )
        self.apiClient = apiClient
        self.vaultSync = VaultSync(vault: vault, api: apiClient)
    }

    private static func storeURL() -> URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("swab-store.v1.json")
    }

    var body: some View {
        NavigationStack {
            content
        }
        .task {
            guard !hasLoadedInitialStep else { return }
            hasLoadedInitialStep = true
            step = await onboarding.getStep()
        }
    }

    @ViewBuilder
    private var content: some View {
        switch step {
        case .welcome:
            WelcomeView(viewModel: WelcomeViewModel(onboarding: onboarding)) {
                step = .phone
            }
        case .phone:
            if showingOtp {
                OtpView(
                    viewModel: OtpViewModel(
                        apiClient: apiClient,
                        session: session,
                        vaultKeyStore: vaultKeyStore,
                        pending: pending,
                        onboarding: onboarding
                    ),
                    onVerified: {
                        showingOtp = false
                        step = .contacts
                    },
                    onBackToPhone: { showingOtp = false }
                )
            } else {
                PhoneView(viewModel: PhoneViewModel(apiClient: apiClient, pending: pending)) {
                    showingOtp = true
                }
            }
        case .contacts:
            ContactsView(
                viewModel: ContactsViewModel(
                    vault: vault,
                    importer: FakeContactsImporter(granted: false),
                    onboarding: onboarding
                )
            ) {
                step = .calibrate
            }
        case .calibrate:
            CalibrateView(viewModel: CalibrateViewModel(vault: vault, onboarding: onboarding)) {
                step = .done
            }
        case .done:
            DoneView(viewModel: DoneViewModel(onboarding: onboarding, vaultSync: vaultSync)) {
                step = .complete
            }
        case .complete:
            MainTabsView(vault: vault)
        }
    }
}
