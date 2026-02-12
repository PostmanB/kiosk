package com.kiosk.printbridge

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.os.Build
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.UUID

object BluetoothPrinter {
  private val sppUuid: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
  private const val maxAttempts = 3
  private val backoffMs = longArrayOf(400, 800, 1600)
  private const val idleTimeoutMs = 20000L
  private val macAddressRegex = Regex("^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$")
  private val nonAlnumRegex = Regex("[^A-Za-z0-9]")

  enum class PrinterState {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    RETRYING,
    ERROR,
    IDLE
  }

  @Volatile private var socket: BluetoothSocket? = null
  @Volatile private var state: PrinterState = PrinterState.DISCONNECTED
  @Volatile private var lastError: String? = null
  @Volatile private var lastStateAt: Long = System.currentTimeMillis()
  @Volatile private var lastUsedAt: Long = 0

  private val lock = Any()

  private fun setState(next: PrinterState, error: String? = null) {
    state = next
    if (error != null) {
      lastError = error
    } else if (next == PrinterState.CONNECTED) {
      lastError = null
    }
    lastStateAt = System.currentTimeMillis()
  }

  fun getStatusJson(): String {
    val now = System.currentTimeMillis()
    val connected = socket?.isConnected == true
    val derivedState = if (connected && now - lastUsedAt >= idleTimeoutMs) {
      PrinterState.IDLE
    } else if (!connected && state == PrinterState.CONNECTED) {
      PrinterState.DISCONNECTED
    } else {
      state
    }

    val json = JSONObject()
    json.put("state", derivedState.name.lowercase())
    if (!lastError.isNullOrBlank()) {
      json.put("message", lastError)
    }
    json.put("updatedAt", lastStateAt)
    return json.toString()
  }

  fun getPairedPrintersJson(): String {
    val json = JSONObject()
    val devices = JSONArray()
    try {
      val adapter = BluetoothAdapter.getDefaultAdapter()
      if (adapter == null) {
        json.put("ok", false)
        json.put("error", "Bluetooth not supported on this device.")
        json.put("devices", devices)
        return json.toString()
      }

      for (device in adapter.bondedDevices) {
        val entry = JSONObject()
        entry.put("name", device.name ?: "")
        entry.put("address", device.address)
        devices.put(entry)
      }
      json.put("ok", true)
      json.put("devices", devices)
    } catch (error: Exception) {
      json.put("ok", false)
      json.put("error", error.message ?: "Unable to read paired devices.")
      json.put("devices", devices)
    }
    return json.toString()
  }

  fun print(target: String, data: ByteArray) {
    val connectedSocket = ensureConnected(target)
    try {
      val output = connectedSocket.outputStream
      output.write(data)
      output.flush()
      lastUsedAt = System.currentTimeMillis()
      setState(PrinterState.CONNECTED, null)
    } catch (error: IOException) {
      Log.e("BluetoothPrinter", "Bluetooth print failed", error)
      setState(PrinterState.ERROR, error.message)
      closeSocket()
      throw error
    }
  }

  private fun ensureConnected(target: String): BluetoothSocket {
    val now = System.currentTimeMillis()
    synchronized(lock) {
      val existing = socket
      if (existing != null && existing.isConnected && now - lastUsedAt < idleTimeoutMs) {
        if (state != PrinterState.CONNECTED) {
          setState(PrinterState.CONNECTED, null)
        }
        return existing
      }
      closeSocketLocked()
    }

    var lastException: Exception? = null
    for (attempt in 1..maxAttempts) {
      setState(if (attempt == 1) PrinterState.CONNECTING else PrinterState.RETRYING, lastError)
      try {
        val adapter = BluetoothAdapter.getDefaultAdapter()
          ?: throw IllegalStateException("Bluetooth not supported on this device.")
        if (!adapter.isEnabled) {
          throw IllegalStateException("Bluetooth is disabled.")
        }

        val device = resolveDevice(adapter, target)
        try {
          adapter.cancelDiscovery()
        } catch (error: SecurityException) {
          Log.w(
            "BluetoothPrinter",
            "Skipping cancelDiscovery due to missing BLUETOOTH_SCAN",
            error
          )
        }

        val newSocket = connectWithFallback(device)

        synchronized(lock) {
          socket = newSocket
          lastUsedAt = System.currentTimeMillis()
        }

        setState(PrinterState.CONNECTED, null)
        return newSocket
      } catch (error: Exception) {
        lastException = error
        Log.w("BluetoothPrinter", "Connect attempt $attempt failed", error)
        setState(PrinterState.RETRYING, error.message)
        closeSocket()
        if (attempt < maxAttempts) {
          Thread.sleep(backoffMs[attempt - 1])
        }
      }
    }

    setState(PrinterState.ERROR, lastException?.message)
    throw IOException("Unable to connect to printer.", lastException)
  }

  private fun resolveDevice(adapter: BluetoothAdapter, target: String): BluetoothDevice =
    if (macAddressRegex.matches(target.trim())) {
      adapter.getRemoteDevice(target.trim().uppercase())
    } else {
      val name = target.trim()
      val normalizedName = normalizeName(name)
      val bonded = adapter.bondedDevices.toList()

      bonded.firstOrNull {
        it.name?.equals(name, ignoreCase = true) == true
      } ?: bonded.firstOrNull {
        normalizeName(it.name).equals(normalizedName, ignoreCase = true)
      } ?: bonded.firstOrNull {
        normalizeName(it.name).contains(normalizedName)
      } ?: throw IOException(
        "Paired printer '$name' not found. Paired devices: ${pairedDevicesSummary(bonded)}"
      )
    }

  private fun connectWithFallback(device: BluetoothDevice): BluetoothSocket {
    val strategies = mutableListOf<Pair<String, () -> BluetoothSocket>>()
    strategies += "secure_spp" to { device.createRfcommSocketToServiceRecord(sppUuid) }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.GINGERBREAD_MR1) {
      strategies += "insecure_spp" to { device.createInsecureRfcommSocketToServiceRecord(sppUuid) }
    }
    strategies += "rfcomm_channel_1" to {
      val method = device.javaClass.getMethod("createRfcommSocket", Int::class.javaPrimitiveType)
      method.invoke(device, 1) as BluetoothSocket
    }

    var lastException: Exception? = null
    for ((label, createSocket) in strategies) {
      var candidate: BluetoothSocket? = null
      try {
        candidate = createSocket()
        candidate.connect()
        Log.i("BluetoothPrinter", "Connected using strategy: $label")
        return candidate
      } catch (error: Exception) {
        lastException = error
        try {
          candidate?.close()
        } catch (_: IOException) {
        }
        Log.w("BluetoothPrinter", "Connect strategy failed: $label", error)
      }
    }
    throw IOException("All Bluetooth socket strategies failed.", lastException)
  }

  private fun normalizeName(value: String?): String {
    if (value.isNullOrBlank()) return ""
    return value.trim().replace(nonAlnumRegex, "").lowercase()
  }

  private fun pairedDevicesSummary(devices: List<BluetoothDevice>): String {
    if (devices.isEmpty()) return "none"
    return devices.joinToString("; ") { device ->
      val name = device.name ?: "(unnamed)"
      "$name/${device.address}"
    }
  }

  private fun closeSocket() {
    synchronized(lock) {
      closeSocketLocked()
    }
  }

  private fun closeSocketLocked() {
    try {
      socket?.close()
    } catch (error: IOException) {
      Log.w("BluetoothPrinter", "Socket close failed", error)
    } finally {
      socket = null
    }
  }
}
