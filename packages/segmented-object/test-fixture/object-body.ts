export function makeObjectBody(size = 1024 * 1024): Buffer {
  const objectBody = Buffer.alloc(1024 * 1024);
  for (let i = 0; i < objectBody.length; ++i) {
    objectBody[i] = Math.random() * 0x100;
  }
  return objectBody;
}

