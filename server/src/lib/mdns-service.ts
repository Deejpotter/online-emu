/**
 * mDNS Service Advertisement
 *
 * Uses Bonjour/mDNS to advertise the emulator server on the local network.
 * This allows mobile clients to automatically discover the server without
 * needing to manually enter an IP address.
 */

import { Bonjour, Service } from "bonjour-service";
import os from "os";

// Service configuration
const SERVICE_NAME = "OnlineEmu Server";
const SERVICE_TYPE = "onlineemu";
const SERVICE_PROTOCOL = "tcp";

let bonjour: Bonjour | null = null;
let publishedService: Service | null = null;

/**
 * Get the local network IP addresses.
 * Filters out loopback and internal addresses.
 */
export function getLocalIpAddresses(): string[] {
	const interfaces = os.networkInterfaces();
	const addresses: string[] = [];

	for (const name of Object.keys(interfaces)) {
		const networkInterface = interfaces[name];
		if (!networkInterface) continue;

		for (const info of networkInterface) {
			// Skip loopback and internal addresses
			if (info.internal) continue;
			// Only include IPv4 addresses
			if (info.family === "IPv4") {
				addresses.push(info.address);
			}
		}
	}

	return addresses;
}

/**
 * Get the primary local IP address (first non-internal IPv4).
 */
export function getPrimaryLocalIp(): string | null {
	const addresses = getLocalIpAddresses();
	return addresses.length > 0 ? addresses[0] : null;
}

/**
 * Start advertising the emulator server via mDNS.
 *
 * @param port - The port the server is listening on
 * @param hostname - Optional hostname to advertise
 */
export function startMdnsAdvertisement(port: number, hostname?: string): void {
	if (bonjour) {
		console.warn("[mDNS] Already advertising, stopping previous service");
		stopMdnsAdvertisement();
	}

	bonjour = new Bonjour();

	// Get local IP for the TXT record
	const localIp = getPrimaryLocalIp();
	const hostName = hostname || os.hostname();

	// Publish the service
	publishedService = bonjour.publish({
		name: SERVICE_NAME,
		type: SERVICE_TYPE,
		protocol: SERVICE_PROTOCOL,
		port,
		txt: {
			version: "1.0.0",
			ip: localIp || "unknown",
			hostname: hostName,
			systems: "nes,snes,gba,gb,n64,psx",
		},
	});

	publishedService.on("up", () => {
		console.log(`[mDNS] Service advertised: ${SERVICE_NAME}`);
		console.log(`[mDNS] Type: _${SERVICE_TYPE}._${SERVICE_PROTOCOL}.local`);
		console.log(`[mDNS] Port: ${port}`);
		console.log(`[mDNS] Local IP: ${localIp || "unknown"}`);
	});

	publishedService.on("error", (err) => {
		console.error("[mDNS] Service error:", err);
	});
}

/**
 * Stop advertising the emulator server.
 */
export function stopMdnsAdvertisement(): void {
	if (publishedService) {
		// Service.stop() exists but may be typed incorrectly in some versions
		(publishedService as { stop?: () => void }).stop?.();
		publishedService = null;
	}

	if (bonjour) {
		bonjour.destroy();
		bonjour = null;
	}

	console.log("[mDNS] Service advertisement stopped");
}

/**
 * Discover other OnlineEmu servers on the network.
 * Useful for debugging or multi-server setups.
 *
 * @param timeout - How long to search (in ms)
 * @returns Promise resolving to found services
 */
export function discoverServers(timeout: number = 5000): Promise<Service[]> {
	return new Promise((resolve) => {
		const foundServices: Service[] = [];
		const tempBonjour = new Bonjour();

		const browser = tempBonjour.find({
			type: SERVICE_TYPE,
			protocol: SERVICE_PROTOCOL,
		});

		browser.on("up", (service) => {
			foundServices.push(service);
			console.log(
				`[mDNS] Found server: ${service.name} at ${service.host}:${service.port}`
			);
		});

		// Stop searching after timeout
		setTimeout(() => {
			browser.stop();
			tempBonjour.destroy();
			resolve(foundServices);
		}, timeout);
	});
}

/**
 * Get the service type string for clients to search for.
 */
export function getServiceType(): string {
	return `_${SERVICE_TYPE}._${SERVICE_PROTOCOL}`;
}

/**
 * Check if mDNS is currently advertising.
 */
export function isAdvertising(): boolean {
	return publishedService !== null;
}
