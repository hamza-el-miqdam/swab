package com.swab.android.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

/**
 * Production [HttpTransport] using `java.net.HttpURLConnection` (G4: avoids
 * adding OkHttp for a four-endpoint JSON surface — see
 * apps/android/CHANGELOG.md for the justification).
 */
class HttpUrlConnectionTransport : HttpTransport {
    override suspend fun request(
        method: String,
        url: String,
        headers: Map<String, String>,
        body: String?,
    ): HttpResponse = withContext(Dispatchers.IO) {
        val connection = URL(url).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            headers.forEach { (key, value) -> connection.setRequestProperty(key, value) }
            connection.connectTimeout = 10_000
            connection.readTimeout = 10_000
            if (body != null) {
                connection.doOutput = true
                connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
            HttpResponse(status, text)
        } finally {
            connection.disconnect()
        }
    }
}
