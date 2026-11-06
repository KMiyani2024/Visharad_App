import { BlobServiceClient, RestError } from '@azure/storage-blob';

// Server-only. Backs both the feedback store and the analytics event log with
// append blobs: writers just append a JSON line, no read-modify-write race.
const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER || 'app-data';

function getContainerClient() {
    if (!CONNECTION_STRING) {
        throw new Error('Missing AZURE_STORAGE_CONNECTION_STRING environment variable');
    }
    const serviceClient = BlobServiceClient.fromConnectionString(CONNECTION_STRING);
    return serviceClient.getContainerClient(CONTAINER_NAME);
}

export async function appendRecord(blobName: string, record: object): Promise<void> {
    const containerClient = getContainerClient();
    await containerClient.createIfNotExists();
    const appendBlobClient = containerClient.getAppendBlobClient(blobName);

    try {
        await appendBlobClient.createIfNotExists();
    } catch (error) {
        // Ignore "already exists" races from concurrent requests; anything else rethrows.
        if (!(error instanceof RestError) || error.statusCode !== 409) throw error;
    }

    const line = `${JSON.stringify(record)}\n`;
    await appendBlobClient.appendBlock(line, Buffer.byteLength(line));
}

export async function readRecords<T = any>(blobName: string): Promise<T[]> {
    const containerClient = getContainerClient();
    const blobClient = containerClient.getBlobClient(blobName);

    if (!(await blobClient.exists())) return [];

    const downloadResponse = await blobClient.download();
    const text = await streamToString(downloadResponse.readableStreamBody);

    return text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line) as T);
}

async function streamToString(readable: NodeJS.ReadableStream | undefined): Promise<string> {
    if (!readable) return '';
    const chunks: Buffer[] = [];
    for await (const chunk of readable) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf-8');
}
