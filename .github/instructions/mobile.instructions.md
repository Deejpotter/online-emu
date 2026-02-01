---
applyTo: "mobile/**/*.ts,mobile/**/*.tsx"
---

# Mobile Development Instructions (Expo)

## Framework: Expo SDK 52+

We use Expo for simplified setup, OTA updates, and easier builds. The app is a "thin client"
that displays video from the server and sends controller inputs - all heavy processing happens on the PC.

## Project Setup

```bash
npx create-expo-app mobile --template expo-template-blank-typescript
cd mobile
npx expo install expo-router react-native-gesture-handler react-native-reanimated
```

## Component Patterns

```tsx
// Functional components with TypeScript interfaces
interface VirtualButtonProps {
	button: string;
	onPress: () => void;
	onRelease: () => void;
}

export function VirtualButton({
	button,
	onPress,
	onRelease,
}: VirtualButtonProps) {
	return (
		<Pressable onPressIn={onPress} onPressOut={onRelease} style={styles.button}>
			<Text>{button}</Text>
		</Pressable>
	);
}
```

## Gesture Handling

- Use `react-native-gesture-handler` for all touch inputs
- Wrap app root in `<GestureHandlerRootView style={{ flex: 1 }}>`
- Use `Gesture.Pan()` for D-pad and analog stick detection
- Use `Gesture.Tap()` with `onBegin`/`onEnd` for button press states

```tsx
import { Gesture, GestureDetector } from "react-native-gesture-handler";

const panGesture = Gesture.Pan()
	.onUpdate((event) => {
		// Calculate direction from event.translationX/Y
	})
	.onEnd(() => {
		// Reset to neutral
	});
```

## WebRTC Video Display

For receiving the game video stream from the server:

```tsx
import { RTCView } from "react-native-webrtc";

// Display the remote video stream full-screen
<RTCView
	streamURL={remoteStream?.toURL()}
	style={{ flex: 1 }}
	objectFit="contain"
/>;
```

## Socket.IO Client

```typescript
import { io, Socket } from "socket.io-client";

const socket = io(`http://${serverIP}:3000`);

// Send controller input
socket.emit("input", {
	button: "a",
	pressed: true,
	timestamp: Date.now(),
});
```

## Server Discovery (mDNS)

```typescript
import Zeroconf from "react-native-zeroconf";

const zeroconf = new Zeroconf();
zeroconf.scan("onlineemu", "tcp", "local.");

zeroconf.on("resolved", (service) => {
	console.log("Found server:", service.host, service.port);
});
```

## Screen Orientation

Lock to landscape for gameplay:

```typescript
import * as ScreenOrientation from "expo-screen-orientation";

// Lock to landscape when entering game screen
await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
```

## Haptic Feedback

```typescript
import * as Haptics from "expo-haptics";

// Light feedback on button press
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
```

## File Structure

```
mobile/
├── app/                    # Expo Router screens
│   ├── _layout.tsx        # Root layout with providers
│   ├── index.tsx          # Home/server discovery
│   ├── games.tsx          # Game selection
│   └── play.tsx           # Gameplay screen
├── src/
│   ├── components/
│   │   ├── VirtualController.tsx
│   │   ├── DPad.tsx
│   │   ├── ActionButtons.tsx
│   │   └── AnalogStick.tsx
│   ├── services/
│   │   ├── socket.ts      # Socket.IO client
│   │   └── webrtc.ts      # WebRTC client
│   └── hooks/
│       ├── useServerDiscovery.ts
│       └── useController.ts
└── app.json
```

### Socket.IO Client

```typescript
import { io } from "socket.io-client";
const socket = io(`http://${serverIp}:3000`);
```
