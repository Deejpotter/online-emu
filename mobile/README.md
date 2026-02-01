# OnlineEmu Mobile App

> ⚠️ **DEPRECATED**: This Expo mobile app is deprecated. Use the PWA (Progressive Web App) instead.
>
> **Why?** The mobile app was redundant—it just opened a WebView to the server anyway. The PWA provides the same experience with:
>
> - Single codebase (no separate mobile app to maintain)
> - Native gamepad support via Browser Gamepad API
> - Works on iOS, Android, and desktop
> - Offline support via service worker
>
> **To use the PWA:**
>
> 1. Open the server URL in Chrome/Safari on your mobile device
> 2. Tap "Add to Home Screen" in the browser menu
> 3. The app installs and runs in standalone mode

---

Mobile client for the OnlineEmu game streaming system. Connects to a PC running the server and displays games with on-screen controller overlay.

## Architecture

This app is a **thin client**:

- Video comes from the server via WebRTC
- Controller inputs are sent back via Socket.IO
- All emulation happens on the PC, not the phone

## Setup

```bash
npm install
npx expo start
```

Then scan the QR code with Expo Go on your phone.

## Screens

- **Home** (`/`) - Server discovery and connection
- **Games** (`/games`) - Browse and select games from the server
- **Play** (`/play`) - Full-screen gameplay with virtual controller

## Components

### Virtual Controller

Located in `src/components/`:

- **VirtualController** - Main container, adapts to different systems
- **DPad** - 8-way directional pad with gesture detection
- **ActionButtons** - A, B, X, Y face buttons
- **ShoulderButtons** - L, R (and L2, R2 for some systems)
- **MenuButtons** - Start and Select

### System Support

The controller adapts based on the system being emulated:

| System | Face Buttons | Shoulders | Analog |
|--------|--------------|-----------|--------|
| NES/GB | A, B | No | No |
| SNES/GBA | A, B, X, Y | L, R | No |
| N64 | A, B | L, R, Z | Yes |
| PS1 | A, B, X, Y | L1, R1, L2, R2 | Yes |

## Dependencies

- **expo-router** - File-based navigation
- **react-native-gesture-handler** - Touch input handling
- **react-native-reanimated** - Smooth animations
- **expo-haptics** - Vibration feedback
- **socket.io-client** - Server communication

## Development

### Testing Controller

You can test the controller locally by checking the console logs for button events.

### Building for Device

```bash
# Development build (recommended for full features)
npx expo run:android
npx expo run:ios

# Or use Expo Go for quick testing
npx expo start
```

## Future Improvements

- [ ] WebRTC video integration (react-native-webrtc)
- [ ] Bluetooth controller support
- [ ] Controller customization (size, position, opacity)
- [ ] mDNS auto-discovery
- [ ] Save state management
