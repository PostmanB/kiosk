package com.kiosk.printbridge

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothSocket
import android.util.Log
import org.json.JSONObject
import java.io.IOException
import java.util.UUID

object BluetoothPrinter {
  private val sppUuid: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
  private const val maxAttempts = 3
  private val backoffMs = longArrayOf(400, 800, 1600)
  private const val idleTimeoutMs = 20000L

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

  fun print(macAddress: String, data: ByteArray) {
    val connectedSocket = ensureConnected(macAddress)
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

  private fun ensureConnected(macAddress: String): BluetoothSocket {
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

        val device = adapter.getRemoteDevice(macAddress)
        adapter.cancelDiscovery()

        val newSocket = device.createRfcommSocketToServiceRecord(sppUuid)
        newSocket.connect()

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
