package com.kiosk.printbridge

import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.nio.charset.Charset
import java.nio.charset.CharsetEncoder
import kotlin.math.min

object EscPosFormatter {
  private const val normalLineWidth = 32
  private const val doubleLineWidth = 16
  // XP-T58K class printers usually expect legacy ESC/POS code tables, not UTF-8 bytes.
  private val charset: Charset = runCatching { Charset.forName("CP852") }
    .getOrElse { Charset.forName("windows-1250") }
  private val encoder: CharsetEncoder = charset.newEncoder()

  private val init = byteArrayOf(0x1B, 0x40)
  private val alignLeft = byteArrayOf(0x1B, 0x61, 0x00)
  private val alignCenter = byteArrayOf(0x1B, 0x61, 0x01)
  private val boldOn = byteArrayOf(0x1B, 0x45, 0x01)
  private val boldOff = byteArrayOf(0x1B, 0x45, 0x00)
  private val textSizeNormal = byteArrayOf(0x1D, 0x21, 0x00)
  private val textSizeDouble = byteArrayOf(0x1D, 0x21, 0x11)
  private val cut = byteArrayOf(0x1D, 0x56, 0x01)
  // ESC t n -> select character table. 18 is commonly CP852 on ESC/POS clones.
  private val codeTableCp852 = byteArrayOf(0x1B, 0x74, 0x12)
  private val lf = byteArrayOf(0x0A)
  private const val blankBlockWidthBytes = 48
  private const val kitchenBlankBlockHeightDots = 96
  fun kitchenTicket(payloadJson: String): ByteArray {
    val root = JSONObject(payloadJson)
    val out = ByteArrayOutputStream()

    out.write(init)
    out.write(codeTableCp852)
    out.write(textSizeNormal)
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

    writeLine(out, "-".repeat(normalLineWidth))
    out.write(lf)
    appendBlankRasterBlock(out, blankBlockWidthBytes, kitchenBlankBlockHeightDots)
    out.write(cut)
    return out.toByteArray()
  }

  fun bill(payloadJson: String): ByteArray {
    val root = JSONObject(payloadJson)
    val out = ByteArrayOutputStream()

    out.write(init)
    out.write(codeTableCp852)
    out.write(textSizeDouble)
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

      if (price.isNaN()) {
        wrapLines("${qty}x $name", doubleLineWidth).forEach { text -> writeLine(out, text) }
      } else {
        val total = price * qty
        formatLinesWithTotal("${qty}x $name", total, doubleLineWidth)
          .forEach { text -> writeLine(out, text) }
      }

      val modifiers = item.optJSONObject("modifiers")
      if (modifiers != null) {
        val keys = modifiers.keys()
        while (keys.hasNext()) {
          val key = keys.next()
          val values = modifiers.optJSONArray(key)
          val joined = joinArray(values)
          if (joined.isNotBlank()) {
            wrapLines("  $key: $joined", doubleLineWidth).forEach { text -> writeLine(out, text) }
          }
        }
      }
    }

    val total = root.optDouble("total", Double.NaN)
    val currency = root.optString("currency", "")
    if (!total.isNaN()) {
      writeLine(out, "")
      val totalLabel = if (currency.isNotBlank()) {
        "Total ($currency)"
      } else {
        "Total"
      }
      formatLinesWithTotal(totalLabel, total, doubleLineWidth)
        .forEach { text -> writeLine(out, text) }
    }

    out.write(textSizeNormal)
    out.write(cut)
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

  private fun appendBlankRasterBlock(
    out: ByteArrayOutputStream,
    widthBytes: Int,
    heightDots: Int
  ) {
    val safeWidthBytes = widthBytes.coerceIn(1, 65535)
    val safeHeightDots = heightDots.coerceIn(1, 2047)
    out.write(byteArrayOf(
      0x1D,
      0x76,
      0x30,
      0x00,
      (safeWidthBytes and 0xFF).toByte(),
      ((safeWidthBytes shr 8) and 0xFF).toByte(),
      (safeHeightDots and 0xFF).toByte(),
      ((safeHeightDots shr 8) and 0xFF).toByte()
    ))
    out.write(ByteArray(safeWidthBytes * safeHeightDots))
  }

  private fun wrapLines(text: String, lineWidth: Int = normalLineWidth): List<String> {
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

  private fun formatLineWithTotal(label: String, total: Double, lineWidth: Int = normalLineWidth): String {
    val amount = String.format("%.2f", total)
    val space = maxOf(1, lineWidth - label.length - amount.length)
    return label + " ".repeat(space) + amount
  }

  private fun formatLinesWithTotal(label: String, total: Double, lineWidth: Int = normalLineWidth): List<String> {
    val amount = String.format("%.2f", total)
    val amountLineLabelWidth = lineWidth - amount.length - 1
    if (label.length <= amountLineLabelWidth) {
      return listOf(formatLineWithTotal(label, total, lineWidth))
    }

    val wrappedLabelLines = wrapLines(label, lineWidth)
    val lines = mutableListOf<String>()
    if (wrappedLabelLines.size > 1) {
      lines.addAll(wrappedLabelLines.dropLast(1))
    }

    val lastLabelLine = wrappedLabelLines.last()
    if (lastLabelLine.length <= amountLineLabelWidth) {
      lines.add(formatLineWithTotal(lastLabelLine, total, lineWidth))
    } else {
      lines.add(lastLabelLine)
      lines.add(amount.padStart(lineWidth))
    }
    return lines
  }
}
