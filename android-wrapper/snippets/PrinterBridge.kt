package com.kiosk.printbridge

import android.content.Context
import android.util.Log
import android.webkit.JavascriptInterface
import java.util.concurrent.Executors

class PrinterBridge(context: Context) {
  private val appContext = context.applicationContext
  private val executor = Executors.newSingleThreadExecutor()

  private val printerMac = "AA:BB:CC:DD:EE:FF"

  @JavascriptInterface
  fun printKitchenTicket(payloadJson: String) {
    executor.execute {
      try {
        val data = EscPosFormatter.kitchenTicket(payloadJson)
        BluetoothPrinter.print(appContext, printerMac, data)
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
        BluetoothPrinter.print(appContext, printerMac, data)
      } catch (error: Exception) {
        Log.e("PrinterBridge", "Bill print failed", error)
      }
    }
  }
}
