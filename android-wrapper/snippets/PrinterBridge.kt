package com.kiosk.printbridge

import android.util.Log
import android.webkit.JavascriptInterface
import java.util.concurrent.Executors

class PrinterBridge {
  private val executor = Executors.newSingleThreadExecutor()

  private val printerMac = "AA:BB:CC:DD:EE:FF"

  @JavascriptInterface
  fun printKitchenTicket(payloadJson: String) {
    executor.execute {
      try {
        val data = EscPosFormatter.kitchenTicket(payloadJson)
        BluetoothPrinter.print(printerMac, data)
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
        BluetoothPrinter.print(printerMac, data)
      } catch (error: Exception) {
        Log.e("PrinterBridge", "Bill print failed", error)
      }
    }
  }

  @JavascriptInterface
  fun getStatus(): String {
    return BluetoothPrinter.getStatusJson()
  }
}
