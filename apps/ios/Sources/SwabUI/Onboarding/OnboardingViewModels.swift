/// MVVM view models for the onboarding flow (welcome → phone → otp →
/// contacts → calibrate → done). Views are dumb; all domain logic lives here
/// and in SwabCore — nothing UI-specific leaks into SwabCore.
import Observation
import SwabCore
import os

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
    /// Deployment-scoped (SUG-IOS-008) — defaults to `PhoneHash.defaultSalt`
    /// so existing call sites/tests don't churn; the composition root passes
    /// `AppConfig.phoneHashSalt` in a real run.
    private let salt: String

    public init(apiClient: ApiClient, pending: PendingSignup, salt: String = PhoneHash.defaultSalt) {
        self.apiClient = apiClient
        self.pending = pending
        self.salt = salt
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
            let phoneHash = PhoneHash.hash(rawPhone, salt: salt)
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
    /// Deployment-scoped (SUG-IOS-008), same default/override contract as
    /// `PhoneViewModel.salt`.
    private let salt: String
    private let reporter: ErrorReporter
    /// Device-import bookkeeping only (SUG-IOS-013), not a product rule:
    /// guards against re-picking the same `DeviceContact` (e.g. a rapid
    /// double-tap before `importable` re-renders without it). Two
    /// *different* device contacts sharing a display name stay independently
    /// pickable — `addManual` never consults this set.
    private var pickedIds: Set<String> = []

    public init(
        vault: Vault,
        importer: ContactsImporting,
        onboarding: OnboardingStateStore,
        salt: String = PhoneHash.defaultSalt,
        reporter: ErrorReporter = NoopErrorReporter()
    ) {
        self.vault = vault
        self.importer = importer
        self.onboarding = onboarding
        self.salt = salt
        self.reporter = reporter
    }

    private func report(_ operation: String, _ error: Error) {
        reporter.report(ReportedError(domain: "onboarding.vault", operation: operation, errorDescription: VaultError.reportCode(for: error)))
    }

    public func refresh() async {
        do {
            addedNames = try await vault.getContacts().map(\.displayName)
        } catch {
            report("refresh", error)
            addedNames = []
        }
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
        guard !pickedIds.contains(contact.id) else { return }
        pickedIds.insert(contact.id)
        let phoneHash = contact.phone.map { PhoneHash.hash($0, salt: salt) }
        do {
            _ = try await vault.addContact(displayName: contact.name, phoneHash: phoneHash)
        } catch {
            report("pick", error)
        }
        importable.removeAll { $0.id == contact.id }
        await refresh()
    }

    public func addManual() async {
        let name = manualName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        do {
            _ = try await vault.addContact(displayName: name)
        } catch {
            report("addManual", error)
        }
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
    private let reporter: ErrorReporter

    public init(vault: Vault, onboarding: OnboardingStateStore, reporter: ErrorReporter = NoopErrorReporter()) {
        self.vault = vault
        self.onboarding = onboarding
        self.reporter = reporter
    }

    private func report(_ operation: String, _ error: Error) {
        reporter.report(ReportedError(domain: "calibrate.vault", operation: operation, errorDescription: VaultError.reportCode(for: error)))
    }

    public var selected: VaultContact? {
        contacts.first { $0.id == selectedId }
    }

    public var unplaced: [VaultContact] {
        contacts.filter { $0.ring == nil }
    }

    public func refresh() async {
        do {
            contacts = try await vault.getContacts()
        } catch {
            report("refresh", error)
            contacts = []
        }
    }

    /// ONB-05: written to the vault only — no network call exists in this
    /// view model, by design.
    public func place(ring: Int) async {
        guard let selectedId else { return }
        do {
            try await vault.setRing(id: selectedId, ring: ring)
        } catch {
            report("place", error)
        }
        await refresh()
    }

    public func setEtat(_ etat: Etat?) async {
        guard let selectedId else { return }
        do {
            try await vault.setEtat(id: selectedId, etat: etat)
        } catch {
            report("setEtat", error)
        }
        await refresh()
    }

    public func setRessenti(_ ressenti: Ressenti?) async {
        guard let selectedId else { return }
        do {
            try await vault.setRessenti(id: selectedId, ressenti: ressenti)
        } catch {
            report("setRessenti", error)
        }
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
    private let syncScheduler: SyncScheduler
    private static let signposter = OSSignposter(subsystem: "com.swab.ios", category: "vault.sync")

    public init(onboarding: OnboardingStateStore, syncScheduler: SyncScheduler) {
        self.onboarding = onboarding
        self.syncScheduler = syncScheduler
    }

    /// Completes onboarding, then fires the first push.
    ///
    /// **`.complete` is persisted BEFORE the push (ONB-08), never after.**
    /// The push can block for up to `URLSession.shared`'s 60 s request
    /// timeout, and a force-quit inside that window must not drop the user
    /// back onto the completion screen they already passed. Nothing writes
    /// to the vault between the two statements, so ONB-05 is unaffected —
    /// the scheduler is still armed only as onboarding closes. Android does
    /// the same in `OnboardingViewModel.complete()` (SUG-AND-001).
    ///
    /// Best-effort: offline completion is a first-class path (FS-01
    /// acceptance 1). On failure the scheduler keeps `needsSync` set and a
    /// later trigger retries under backoff — the point of routing through it
    /// rather than calling `VaultSync` directly. G3: still wrapped in a
    /// signpost interval (duration only, no payload); failure reporting
    /// lives in the scheduler, where every trigger's failures converge.
    public func finish() async {
        await onboarding.setStep(.complete)
        let state = Self.signposter.beginInterval("sync")
        await syncScheduler.onboardingDidComplete()
        Self.signposter.endInterval("sync", state)
    }
}
