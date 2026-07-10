package com.swab.android.network

/**
 * Minimal HTTP seam so [ApiClient] is JVM-testable without a real socket.
 * Production implementation (`HttpUrlConnectionTransport`) uses
 * `java.net.HttpURLConnection` — no OkHttp dependency needed for four JSON
 * endpoints (G4: avoids an extra dependency for a small surface).
 */
interface HttpTransport {
    /** Performs a JSON POST/GET; returns (status, bodyText). Body may be null for GET. */
    suspend fun request(
        method: String,
        url: String,
        headers: Map<String, String>,
        body: String?,
    ): HttpResponse
}

data class HttpResponse(val status: Int, val body: String)
