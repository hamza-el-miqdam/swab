# SUG-AND-016 — release R8/ProGuard rules.
#
# The only reflective/generated-code surface in this app is
# kotlinx-serialization's `@Serializable` classes (VaultContact,
# VaultHistoryEvent, VaultData in vault/Vault.kt; the OtpRequestBody/
# OtpRequestResponse/OtpVerifyBody/OtpVerifyResponse/EncryptedVaultBlobDto
# DTOs in network/ApiClient.kt). No reflection anywhere else — manual DI
# (AppContainer.kt), no Hilt/Dagger, no Gson/Moshi. These are the official
# kotlinx.serialization consumer rules (see its README), not hand-rolled.

# Keep `Companion` object fields for serializable classes.
-if @kotlinx.serialization.Serializable class **
-keepclassmembers class <1> {
    static <1>$Companion Companion;
}

# Keep `serializer()` on companion objects of serializable classes.
-if @kotlinx.serialization.Serializable class ** {
    static **$Companion Companion;
}
-keepclassmembers class <1>$Companion {
    kotlinx.serialization.KSerializer serializer(...);
}

# Keep generated `$serializer` nested classes and their fields/methods.
-keepclassmembers @kotlinx.serialization.Serializable class ** {
    *** Companion;
}
-keepclasseswithmembers class **$$serializer {
    *** INSTANCE;
    *** serialize(...);
    *** deserialize(...);
}

# kotlinx.serialization.internal.* accessors used by the generated code.
-keepclassmembers class kotlinx.serialization.internal.** {
    <fields>;
}
-dontwarn kotlinx.serialization.**
