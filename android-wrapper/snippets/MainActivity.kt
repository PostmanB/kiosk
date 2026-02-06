package com.kiosk.printbridge

import android.Manifest
import android.annotation.SuppressLint
import android.os.Build
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.core.app.ActivityCompat

class MainActivity : ComponentActivity() {
  private val kioskUrl = "https://your-kiosk-site.example.com"

  @SuppressLint("SetJavaScriptEnabled")
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      ActivityCompat.requestPermissions(
        this,
        arrayOf(
          Manifest.permission.BLUETOOTH_CONNECT,
          Manifest.permission.BLUETOOTH_SCAN
        ),
        1001
      )
    }

    val webView = WebView(this)
    webView.settings.javaScriptEnabled = true
    webView.settings.domStorageEnabled = true
    webView.webViewClient = WebViewClient()
    webView.addJavascriptInterface(PrinterBridge(), "AndroidPrinter")
    webView.loadUrl(kioskUrl)

    setContentView(webView)
  }
}
