package com.swab.android.onboarding

import android.content.ContentResolver
import android.net.Uri
import android.provider.ContactsContract

/**
 * ONB-03 — Android-only glue: reads a display name + first phone number off
 * a device-contact-picker content URI (`ActivityResultContracts.PickContact`
 * grants read access to that one row via the returned URI, which is why
 * `READ_CONTACTS` is only requested before launching the picker, not held
 * ambiently). No hashing happens here (IDT-01 stays in
 * [com.swab.android.onboarding.ContactsViewModel.addFromDevice]) — the raw
 * number exists only transiently in this function's return value and the
 * caller's handler, never in a StateFlow, log, or the vault.
 *
 * Not JVM-testable (needs a real ContentResolver/ContactsContract) — the
 * hashing it feeds is what [com.swab.android.onboarding.ContactsViewModelTest]
 * covers; this glue is exercised manually (ONB-03 device import is
 * `manual` in docs/qa/e2e-coverage.json — the system picker can't be driven
 * headlessly by Compose tests).
 */
object DeviceContactReader {
    fun read(resolver: ContentResolver, uri: Uri): Pair<String, String?> {
        var displayName = ""
        var contactId: String? = null

        resolver.query(
            uri,
            arrayOf(ContactsContract.Contacts._ID, ContactsContract.Contacts.DISPLAY_NAME),
            null,
            null,
            null,
        )?.use { cursor ->
            if (cursor.moveToFirst()) {
                val idIdx = cursor.getColumnIndex(ContactsContract.Contacts._ID)
                val nameIdx = cursor.getColumnIndex(ContactsContract.Contacts.DISPLAY_NAME)
                if (idIdx >= 0) contactId = cursor.getString(idIdx)
                if (nameIdx >= 0) displayName = cursor.getString(nameIdx) ?: ""
            }
        }

        var rawPhone: String? = null
        contactId?.let { id ->
            resolver.query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                arrayOf(ContactsContract.CommonDataKinds.Phone.NUMBER),
                "${ContactsContract.CommonDataKinds.Phone.CONTACT_ID} = ?",
                arrayOf(id),
                null,
            )?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val numIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)
                    if (numIdx >= 0) rawPhone = cursor.getString(numIdx)
                }
            }
        }

        return displayName to rawPhone
    }
}
