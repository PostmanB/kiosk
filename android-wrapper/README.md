# Android WebView Print Bridge (XP-T58K, 58mm)

This folder holds the minimal native wrapper needed for silent Bluetooth printing from the kiosk website on Android.

## What This Does
- Loads the hosted kiosk website in an Android `WebView`.
- Exposes a JavaScript bridge at `window.AndroidPrinter`.
- Sends ESC/POS bytes to the XP-T58K over Bluetooth SPP for silent printing.

## How To Use
1. Create a new Android Studio project (Empty Activity).
2. Set the package name to `com.kiosk.printbridge` (or update the package names in the snippets).
3. Copy the Kotlin files from `android-wrapper/snippets/` into:
   `app/src/main/java/com/kiosk/printbridge/`
4. Update these values:
   - `kioskUrl` in `MainActivity.kt`
   - `printerMac` in `PrinterBridge.kt`
5. Pair the printer in Android Bluetooth settings.
6. Build and install the app on the tablet.

## Permissions (Android 12+)
Add these permissions to `AndroidManifest.xml`:
- `android.permission.BLUETOOTH`
- `android.permission.BLUETOOTH_ADMIN`
- `android.permission.BLUETOOTH_CONNECT`
- `android.permission.BLUETOOTH_SCAN`

At runtime, the app requests `BLUETOOTH_CONNECT` and `BLUETOOTH_SCAN` on Android 12+.

## Bridge Methods
The website calls these methods:
- `window.AndroidPrinter.printKitchenTicket(payloadJson)`
- `window.AndroidPrinter.printBill(payloadJson)`

## Payload Shapes
Kitchen ticket:
```json
{
  "type": "kitchen",
  "table": "Table 4",
  "createdAt": "2026-02-06T12:34:56.789Z",
  "items": [
    { "name": "Burger", "quantity": 2, "modifiers": { "Extras": ["No onion"] } }
  ],
  "paperWidthMm": 58
}
```

Bill:
```json
{
  "type": "bill",
  "table": "Table 4",
  "openedAt": "2026-02-06T11:05:00.000Z",
  "items": [
    { "name": "Burger", "quantity": 2, "price": 8.5, "modifiers": {}, "registerCode": "B12" }
  ],
  "total": 17.0,
  "currency": "EUR",
  "paperWidthMm": 58
}
```
