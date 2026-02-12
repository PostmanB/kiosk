package com.kiosk.printbridge

import android.util.Log
import android.webkit.JavascriptInterface
import java.util.concurrent.Executors

class PrinterBridge {
  private val executor = Executors.newSingleThreadExecutor()

  // MAC is more stable than friendly name for Bluetooth receipt printers.
  @Volatile private var printerTarget = "DC:0D:30:F6:BE:CC"

  @JavascriptInterface
  fun printKitchenTicket(payloadJson: String) {
    executor.execute {
      try {
        val data = EscPosFormatter.kitchenTicket(payloadJson)
        BluetoothPrinter.print(printerTarget, data)
      } catch (error: Exception) {
        Log.e("PrinterBridge", "Kitchen print failed", error)
      }
    }
  }

  @JavascriptInterface
  fun printBill(payloadJson: String) {
    executor.execute {
      try {
        val data = EscPosFormatter.bill(payloadJson)
        BluetoothPrinter.print(printerTarget, data)
      } catch (error: Exception) {
        Log.e("PrinterBridge", "Bill print failed", error)
      }
    }
  }

  @JavascriptInterface
  fun getStatus(): String {
    return BluetoothPrinter.getStatusJson()
  }

  @JavascriptInterface
  fun getPairedPrinters(): String {
    return BluetoothPrinter.getPairedPrintersJson()
  }

  @JavascriptInterface
  fun setPrinterTarget(target: String) {
    val cleaned = target.trim()
    if (cleaned.isNotEmpty()) {
      printerTarget = cleaned
      Log.i("PrinterBridge", "Printer target updated to: $cleaned")
    }
  }
}
