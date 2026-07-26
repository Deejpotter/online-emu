/**
 * Shared Cloudflare R2 client helpers.
 */

import {
	S3Client,
	GetObjectCommand,
	PutObjectCommand,
	DeleteObjectCommand,
	HeadObjectCommand,
} from "@aws-sdk/client-s3";

export function getR2Client(): S3Client | null {
	const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
	if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) return null;
	return new S3Client({
		region: "auto",
		endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId: R2_ACCESS_KEY_ID,
			secretAccessKey: R2_SECRET_ACCESS_KEY,
		},
	});
}

export function getR2Bucket(): string {
	return process.env.R2_BUCKET_NAME || "deejpotter";
}

export async function streamToBuffer(body: {
	transformToWebStream(): ReadableStream<Uint8Array>;
}): Promise<Buffer> {
	const chunks: Uint8Array[] = [];
	const reader = body.transformToWebStream().getReader();
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
	}
	const buf = Buffer.alloc(chunks.reduce((a, c) => a + c.length, 0));
	let off = 0;
	for (const c of chunks) {
		buf.set(c, off);
		off += c.length;
	}
	return buf;
}

export async function fetchR2Object(key: string): Promise<Buffer | null> {
	const client = getR2Client();
	if (!client) return null;

	try {
		const res = await client.send(
			new GetObjectCommand({ Bucket: getR2Bucket(), Key: key })
		);
		if (!res.Body) return null;
		return streamToBuffer(res.Body as { transformToWebStream(): ReadableStream<Uint8Array> });
	} catch (err: unknown) {
		const name = err instanceof Error ? err.name : "";
		const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata
			?.httpStatusCode;
		if (name === "NoSuchKey" || name === "NotFound" || status === 404) return null;
		throw err;
	}
}

export async function putR2Object(
	key: string,
	body: Buffer,
	contentType = "application/octet-stream"
): Promise<void> {
	const client = getR2Client();
	if (!client) throw new Error("R2 client not configured");

	await client.send(
		new PutObjectCommand({
			Bucket: getR2Bucket(),
			Key: key,
			Body: body,
			ContentType: contentType,
		})
	);
}

export async function deleteR2Object(key: string): Promise<boolean> {
	const client = getR2Client();
	if (!client) throw new Error("R2 client not configured");

	try {
		await client.send(
			new DeleteObjectCommand({ Bucket: getR2Bucket(), Key: key })
		);
		return true;
	} catch (err: unknown) {
		const name = err instanceof Error ? err.name : "";
		const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata
			?.httpStatusCode;
		if (name === "NoSuchKey" || name === "NotFound" || status === 404) return false;
		throw err;
	}
}

export async function headR2Object(key: string): Promise<boolean> {
	const client = getR2Client();
	if (!client) return false;

	try {
		await client.send(
			new HeadObjectCommand({ Bucket: getR2Bucket(), Key: key })
		);
		return true;
	} catch (err: unknown) {
		const name = err instanceof Error ? err.name : "";
		const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata
			?.httpStatusCode;
		if (name === "NotFound" || status === 404) return false;
		throw err;
	}
}
