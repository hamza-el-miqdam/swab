/// ONB-03 contact import seam. `SystemContactsImporter` (a real
/// `CNContactStore`-backed implementation) is DEFERRED — see
/// apps/ios/CHANGELOG.md. Building and testing it needs an app-bundle
/// entitlement (`NSContactsUsageDescription`) that doesn't exist without a
/// full .xcodeproj target, which is out of scope for this PR. The manual-add
/// path (ContactsViewModel.addManual) is fully capable on its own — ONB-03's
/// acceptance criterion ("denied → manual entry, identical capabilities")
/// holds regardless of which importer is wired in.
import SwabCore

public struct DeviceContact: Equatable, Sendable {
    public let name: String
    public let phone: String?

    public init(name: String, phone: String? = nil) {
        self.name = name
        self.phone = phone
    }
}

public protocol ContactsImporting: Sendable {
    /// Returns whether access was granted (OS-level permission gate).
    func requestAccess() async -> Bool
    func fetchContacts() async -> [DeviceContact]
}

/// Test/dev double — also usable as a real fallback until
/// `SystemContactsImporter` lands, since it never claims access it can't
/// deliver (`requestAccess` returning `false` degrades gracefully to manual
/// entry, per ONB-03 acceptance criterion 2).
public struct FakeContactsImporter: ContactsImporting {
    private let granted: Bool
    private let contacts: [DeviceContact]

    public init(granted: Bool, contacts: [DeviceContact] = []) {
        self.granted = granted
        self.contacts = contacts
    }

    public func requestAccess() async -> Bool { granted }

    public func fetchContacts() async -> [DeviceContact] {
        granted ? contacts : []
    }
}
