package com.kiosk.printbridge

import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.nio.charset.Charset
import java.nio.charset.CharsetEncoder
import kotlin.math.min

object EscPosFormatter {
  private const val lineWidth = 32
  // XP-T58K class printers usually expect legacy ESC/POS code tables, not UTF-8 bytes.
  private val charset: Charset = runCatching { Charset.forName("CP852") }
    .getOrElse { Charset.forName("windows-1250") }
  private val encoder: CharsetEncoder = charset.newEncoder()

  private val init = byteArrayOf(0x1B, 0x40)
  private val alignLeft = byteArrayOf(0x1B, 0x61, 0x00)
  private val alignCenter = byteArrayOf(0x1B, 0x61, 0x01)
  private val boldOn = byteArrayOf(0x1B, 0x45, 0x01)
  private val boldOff = byteArrayOf(0x1B, 0x45, 0x00)
  private val cut = byteArrayOf(0x1D, 0x56, 0x01)
  // ESC t n -> select character table. 18 is commonly CP852 on ESC/POS clones.
  private val codeTableCp852 = byteArrayOf(0x1B, 0x74, 0x12)
  private val lf = byteArrayOf(0x0A)
  private const val billFeedLines = 4
  private const val postCutFeedLines = 3

  fun kitchenTicket(payloadJson: String): ByteArray {
    val root = JSONObject(payloadJson)
    val out = ByteArrayOutputStream()

    out.write(init)
    out.write(codeTableCp852)
    out.write(alignCenter)
    out.write(boldOn)
    writeLine(out, "KITCHEN")
    out.write(boldOff)
    out.write(alignLeft)

    val table = root.optString("table", "Table")
    val createdAt = root.optString("createdAt", "")
    val takeawayNumber = root.optInt("takeawayNumber", 0)
    if (table.isNotBlank()) writeLine(out, table)
    if (takeawayNumber > 0) {
      out.write(boldOn)
      writeLine(out, "TAKEAWAY #${takeawayNumber.toString().padStart(3, '0')}")
      out.write(boldOff)
    }
    if (createdAt.isNotBlank()) writeLine(out, createdAt)
    writeLine(out, "")

    val items = root.optJSONArray("items") ?: JSONArray()
    for (i in 0 until items.length()) {
      val item = items.optJSONObject(i) ?: continue
      val name = item.optString("name", "")
      val qty = item.optInt("quantity", 1)
      if (name.isBlank()) continue

      wrapLines("${qty}x $name").forEach { line -> writeLine(out, line) }
      val modifiers = item.optJSONObject("modifiers")
      if (modifiers != null) {
        val keys = modifiers.keys()
        while (keys.hasNext()) {
          val key = keys.next()
          val values = modifiers.optJSONArray(key)
          val joined = joinArray(values)
          if (joined.isNotBlank()) {
            wrapLines("  $key: $joined").forEach { line -> writeLine(out, line) }
          }
        }
      }
    }

    writeLine(out, "-".repeat(lineWidth))
    out.write(lf)
    out.write(cut)
    return out.toByteArray()
  }

  fun bill(payloadJson: String): ByteArray {
    val root = JSONObject(payloadJson)
    val out = ByteArrayOutputStream()

    out.write(init)
    out.write(codeTableCp852)
    out.write(alignCenter)
    out.write(boldOn)
    writeLine(out, "BILL")
    out.write(boldOff)
    out.write(alignLeft)

    val table = root.optString("table", "Table")
    val openedAt = root.optString("openedAt", "")
    val takeawayNumber = root.optInt("takeawayNumber", 0)
    if (table.isNotBlank()) writeLine(out, table)
    if (takeawayNumber > 0) {
      out.write(boldOn)
      writeLine(out, "TAKEAWAY #${takeawayNumber.toString().padStart(3, '0')}")
      out.write(boldOff)
    }
    if (openedAt.isNotBlank()) writeLine(out, openedAt)
    writeLine(out, "")

    val items = root.optJSONArray("items") ?: JSONArray()
    for (i in 0 until items.length()) {
      val item = items.optJSONObject(i) ?: continue
      val name = item.optString("name", "")
      val qty = item.optInt("quantity", 1)
      val price = item.optDouble("price", Double.NaN)
      if (name.isBlank()) continue

      val line = if (price.isNaN()) {
        "${qty}x $name"
      } else {
        val total = price * qty
        formatLineWithTotal("${qty}x $name", total)
      }
      wrapLines(line).forEach { text -> writeLine(out, text) }

      val modifiers = item.optJSONObject("modifiers")
      if (modifiers != null) {
        val keys = modifiers.keys()
        while (keys.hasNext()) {
          val key = keys.next()
          val values = modifiers.optJSONArray(key)
          val joined = joinArray(values)
          if (joined.isNotBlank()) {
            wrapLines("  $key: $joined").forEach { text -> writeLine(out, text) }
          }
        }
      }
    }

    val total = root.optDouble("total", Double.NaN)
    val currency = root.optString("currency", "")
    if (!total.isNaN()) {
      writeLine(out, "")
      val totalLine = if (currency.isNotBlank()) {
        formatLineWithTotal("Total ($currency)", total)
      } else {
        formatLineWithTotal("Total", total)
      }
      writeLine(out, totalLine)
    }

    feedLines(out, billFeedLines)
    out.write(cut)
    feedLines(out, postCutFeedLines)
    return out.toByteArray()
  }

  private fun writeLine(out: ByteArrayOutputStream, text: String) {
    val safeText = text.map { ch -> if (encoder.canEncode(ch)) ch else '?' }.joinToString("")
    out.write(safeText.toByteArray(charset))
    out.write(lf)
  }

  private fun feedLines(out: ByteArrayOutputStream, count: Int) {
    repeat(maxOf(0, count)) {
      out.write(lf)
    }
  }

  private fun wrapLines(text: String): List<String> {
    if (text.length <= lineWidth) return listOf(text)
    val lines = mutableListOf<String>()
    var start = 0
    while (start < text.length) {
      val end = min(start + lineWidth, text.length)
      lines.add(text.substring(start, end))
      start = end
    }
    return lines
  }

  private fun joinArray(values: JSONArray?): String {
    if (values == null) return ""
    val items = mutableListOf<String>()
    for (i in 0 until values.length()) {
      val value = values.optString(i, "")
      if (value.isNotBlank()) items.add(value)
    }
    return items.joinToString(", ")
  }

  private fun formatLineWithTotal(label: String, total: Double): String {
    val amount = String.format("%.2f", total)
    val space = maxOf(1, lineWidth - label.length - amount.length)
    return label + " ".repeat(space) + amount
  }
}
