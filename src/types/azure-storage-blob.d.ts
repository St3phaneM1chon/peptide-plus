declare module '@azure/storage-blob' {
  export class BlobServiceClient {
    static fromConnectionString(connectionString: string): BlobServiceClient;
    getContainerClient(containerName: string): ContainerClient;
  }
  export class ContainerClient {
    getBlockBlobClient(blobName: string): BlockBlobClient;
    exists(): Promise<boolean>;
    create(): Promise<void>;
    listBlobsFlat(options?: Record<string, unknown>): AsyncIterableIterator<{ name: string; properties: Record<string, unknown> }>;
  }
  export class BlockBlobClient {
    uploadData(data: Buffer, options?: Record<string, unknown>): Promise<void>;
    upload(body: ReadableStream | Buffer | string, contentLength: number, options?: Record<string, unknown>): Promise<void>;
    deleteIfExists(): Promise<void>;
    url: string;
  }
  export interface BlobUploadCommonResponse {
    requestId?: string;
  }
}
