export async function sha256(input: Uint8Array): Promise<Uint8Array> {
  const digest = await self.crypto.subtle.digest("SHA-256", input);
  return new Uint8Array(digest);
}
