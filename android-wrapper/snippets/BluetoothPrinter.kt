package com.kiosk.printbridge

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.util.Log
import java.io.IOException
import java.util.UUID

object BluetoothPrinter {
  private val sppUuid: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

  fun print(context: Context, macAddress: String, data: ByteArray) {
    val adapter = BluetoothAdapter.getDefaultAdapter()
      ?: throw IllegalStateException("Bluetooth not supported on this device.")

    val device = adapter.getRemoteDevice(macAddress)
    adapter.cancelDiscovery()

    var socket: BluetoothSocket? = null
    try {
      socket = device.createRfcommSocketToServiceRecord(sppUuid)
      socket.connect()

      val output = socket.outputStream
      output.write(data)
      output.flush()
    } catch (error: IOException) {
      Log.e("BluetoothPrinter", "Bluetooth print failed", error)
      throw error
    } finally {
      try {
        socket?.close()
      } catch (error: IOException) {
        Log.w("BluetoothPrinter", "Socket close failed", error)
      }
    }
  }
}
