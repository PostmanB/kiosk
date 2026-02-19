package com.kiosk.printbridge

import android.content.Context
import android.util.Log
import android.webkit.JavascriptInterface
import org.json.JSONObject
import java.util.concurrent.Executors

class PrinterBridge(private val appContext: Context) {
  private val executor = Executors.newSingleThreadExecutor()

  // MAC is more stable than friendly name for Bluetooth receipt printers.
  @Volatile private var printerTarget = "DC:0D:30:F6:BE:CC"
  private val prefs by lazy {
    appContext.getSharedPreferences("kiosk_printer", Context.MODE_PRIVATE)
  }

  @Synchronized
  private fun nextTakeawayNumber(): Int {
    val today = java.time.LocalDate.now().toString()
    val storedDay = prefs.getString("takeaway_day", null)
    val current = if (storedDay == today) prefs.getInt("takeaway_counter", 0) else 0
    val next = current + 1
    prefs.edit()
      .putString("takeaway_day", today)
      .putInt("takeaway_counter", next)
      .apply()
    return next
  }

  private fun isTakeaway(table: String): Boolean {
    val normalized = table.trim().lowercase()
    return normalized == "takeaway" || normalized == "elvitel"
  }

  @JavascriptInterface
  fun printKitchenTicket(payloadJson: String) {
    executor.execute {
      try {
        val payload = JSONObject(payloadJson)
        val table = payload.optString("table", "")
        if (isTakeaway(table) && payload.optInt("takeawayNumber", 0) <= 0) {
          payload.put("takeawayNumber", nextTakeawayNumber())
        }
        val data = EscPosFormatter.kitchenTicket(payload.toString())
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
        val payload = JSONObject(payloadJson)
        val table = payload.optString("table", "")
        if (isTakeaway(table) && payload.optInt("takeawayNumber", 0) <= 0) {
          payload.put("takeawayNumber", nextTakeawayNumber())
        }
        val data = EscPosFormatter.bill(payload.toString())
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
