/** ponytail: minimal Buffer so postgres bytes.js doesn't crash if it leaks into the browser bundle */
if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = {
    allocUnsafe(size: number) {
      return new Uint8Array(size);
    },
    from(data: string | ArrayLike<number>, _encoding?: string) {
      if (typeof data === "string") return new TextEncoder().encode(data);
      return new Uint8Array(data);
    },
    byteLength(str: string) {
      return new TextEncoder().encode(str).length;
    },
    isBuffer() {
      return false;
    },
  } as typeof Buffer;
}
