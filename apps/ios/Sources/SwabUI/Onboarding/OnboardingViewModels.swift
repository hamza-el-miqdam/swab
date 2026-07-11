/// MVVM view models for the onboarding flow (welcome → phone → otp →
/// contacts → calibrate → done). Views are dumb; all domain logic lives here
/// and in SwabCore — nothing UI-specific leaks into SwabCore.
import Observation
import SwabCore

@MainActor
@Observable
public final class WelcomeViewModel {
    private let onboarding: OnboardingStateStore

    public init(onboarding: OnboardingStateStore) {
        self.onboarding = onboarding
    }

    /// ONB-01: no account creation before this screen is acknowledged — the
    /// CTA is the only action, and it only advances local step state.
    public func start() async {
        await onboarding.setStep(.phone)
    }
}

@MainActor
@Observable
public final class PhoneViewModel {
    public var rawPhone = ""
    public private(set) var isBusy = false
    public private(set) var showError = false
    public private(set) var didRequestCode = false

    private let apiClient: ApiClient
    private let pending: PendingSignup

    public init(apiClient: ApiClient, pending: PendingSignup) {
        self.apiClient = apiClient
        self.pending = pending
    }

    public var canSubmit: Bool {
        !isBusy && rawPhone.trimmingCharacters(in: .whitespaces).count >= 6
    }

    /// The raw number is hashed on-device (IDT-01) — only the hash ever
    /// reaches `pending` or the network.
    public func requestCode() async {
        isBusy = true
        showError = false
        defer { isBusy = false }
        do {
            let phoneHash = PhoneHash.hash(rawPhone)
            let response = try await apiClient.requestOtp(phoneHash: phoneHash)
            pending.setPendingPhoneHash(phoneHash)
            pending.setDevCode(response.devCode)
            didRequestCode = true
        } catch {
            showError = true
        }
    }
}

@MainActor
@Observable
public final class OtpViewModel {
    public var code = ""
    public var displayName = ""
    public private(set) var needsName = false
    public private(set) var isBusy = false
    public private(set) var showError = false
    public private(set) var didVerify = false

    public let phoneHash: String?
    public let devCode: String?

    private let apiClient: ApiClient
    private let session: Session
    private let vaultKeyStore: VaultKeyStore
    private let pending: PendingSignup
    private let onboarding: OnboardingStateStore

    public init(
        apiClient: ApiClient,
        session: Session,
        vaultKeyStore: VaultKeyStore,
        pending: PendingSignup,
        onboarding: OnboardingStateStore
    ) {
        self.apiClient = apiClient
        self.session = session
        self.vaultKeyStore = vaultKeyStore
        self.pending = pending
        self.onboarding = onboarding
        self.phoneHash = pending.pendingPhoneHash
        self.devCode = pending.devCode
    }

    public var canVerify: Bool {
        !isBusy && code.count == 6
            && (!needsName || !displayName.trimmingCharacters(in: .whitespaces).isEmpty)
    }

    /// A 422 means new user without `displayName` — the code is not
    /// consumed server-side, so we reveal the name field and retry with the
    /// same code (mirrors `apps/mobile/app/onboarding/otp.tsx`).
    public func verify() async {
        guard let phoneHash else { return }
        isBusy = true
        showError = false
        defer { isBusy = false }
        do {
            let response = try await apiClient.verifyOtp(
                phoneHash: phoneHash,
                code: code,
                displayName: needsName ? displayName : nil
            )
            try session.saveTokens(SessionTokens(accessToken: response.accessToken, refreshToken: response.refreshToken))
            // ONB-02: vault key exists before any classification input is possible.
            _ = try vaultKeyStore.getOrCreateKey()
            pending.clear()
            await onboarding.setStep(.contacts)
            didVerify = true
        } catch ApiError.http(let status) where status == 422 {
            needsName = true
        } catch {
            showError = true
        }
    }
}

@MainActor
@Observable
public final class ContactsViewModel {
    public var manualName = ""
    public private(set) var addedNames: [String] = []
    public private(set) var importable: [DeviceContact] = []
    public private(set) var accessDenied = false

    private let vault: Vault
    private let importer: ContactsImporting
    private let onboarding: OnboardingStateStore

    public init(vault: Vault, importer: ContactsImporting, onboarding: OnboardingStateStore) {
        self.vault = vault
        self.importer = importer
        self.onboarding = onboarding
    }

    public func refresh() async {
        let contacts = (try? await vault.getContacts()) ?? []
        addedNames = contacts.map(\.displayName)
    }

    /// ONB-03: OS-level denial degrades gracefully — the manual path below
    /// stays fully capable regardless.
    public func importContacts() async {
        let granted = await importer.requestAccess()
        guard granted else {
            accessDenied = true
            return
        }
        importable = await importer.fetchContacts()
    }

    public func pick(_ contact: DeviceContact) async {
        let phoneHash = contact.phone.map { PhoneHash.hash($0) }
        _ = try? await vault.addContact(displayName: contact.name, phoneHash: phoneHash)
        await refresh()
    }

    public func addManual() async {
        let name = manualName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        _ = try? await vault.addContact(displayName: name)
        manualName = ""
        await refresh()
    }

    /// « Passer » (skip) is identical to continuing with zero contacts —
    /// no penalty, no nag (ONB-03).
    public func advance() async {
        await onboarding.setStep(.calibrate)
    }
}

@MainActor
@Observable
public final class CalibrateViewModel {
    public private(set) var contacts: [VaultContact] = []
    public var selectedId: String?
    public var listMode = false
    /// ONB-06: collapsed by default, never blocking completion.
    public var optionalOpen = false

    private let vault: Vault
    private let onboarding: OnboardingStateStore

    public init(vault: Vault, onboarding: OnboardingStateStore) {
        self.vault = vault
        self.onboarding = onboarding
    }

    public var selected: VaultContact? {
        contacts.first { $0.id == selectedId }
    }

    public var unplaced: [VaultContact] {
        contacts.filter { $0.ring == nil }
    }

    public func refresh() async {
        contacts = (try? await vault.getContacts()) ?? []
    }

    /// ONB-05: written to the vault only — no network call exists in this
    /// view model, by design.
    public func place(ring: Int) async {
        guard let selectedId else { return }
        try? await vault.setRing(id: selectedId, ring: ring)
        await refresh()
    }

    public func setEtat(_ etat: String?) async {
        guard let selectedId else { return }
        try? await vault.setEtat(id: selectedId, etat: etat)
        await refresh()
    }

    public func setRessenti(_ ressenti: String?) async {
        guard let selectedId else { return }
        try? await vault.setRessenti(id: selectedId, ressenti: ressenti)
        await refresh()
    }

    public func advance() async {
        await onboarding.setStep(.done)
    }
}

@MainActor
@Observable
public final class DoneViewModel {
    private let onboarding: OnboardingStateStore
    private let vaultSync: VaultSync

    public init(onboarding: OnboardingStateStore, vaultSync: VaultSync) {
        self.onboarding = onboarding
        self.vaultSync = vaultSync
    }

    /// Vault sync is attempted best-effort — offline completion is a
    /// first-class path (FS-01 acceptance 1); sync retries later (VLT-04).
    public func finish() async {
        try? await vaultSync.sync()
        await onboarding.setStep(.complete)
    }
}
