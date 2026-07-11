package com.swab.android.identity

import java.security.MessageDigest

/**
 * IDT-01 / IDT-06: phone numbers are salted and hashed ON-DEVICE; the raw
 * number never leaves the phone. Port of apps/mobile/src/lib/phoneHash.ts.
 * The salt is a per-deployment namespace shared by all clients (required for
 * contact discovery), not a secret.
 */
object PhoneHash {
    const val DEFAULT_SALT: String = "swab-poc-phone-salt-v1"

    /** Best-effort E.164 normalization: keep a leading +, strip everything else. */
    fun normalizePhone(raw: String): String {
        val trimmed = raw.trim()
        val hasPlus = trimmed.startsWith("+")
        val digits = trimmed.filter { it.isDigit() }
        return if (hasPlus) "+$digits" else digits
    }

    fun hashPhoneNumber(raw: String, salt: String = DEFAULT_SALT): String {
        val normalized = normalizePhone(raw)
        val input = "$salt:$normalized".toByteArray(Charsets.UTF_8)
        val digest = MessageDigest.getInstance("SHA-256").digest(input)
        return digest.joinToString(separator = "") { byte -> "%02x".format(byte) }
    }
}
