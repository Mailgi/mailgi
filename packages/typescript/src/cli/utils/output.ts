export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function fail(msg: string): never {
  console.error(`error: ${msg}`);
  // eslint-disable-next-line n/no-process-exit
  process.exit(1) as never;
  throw new Error('unreachable'); // satisfy TypeScript never
}

export function ok(msg: string): void {
  console.log(msg);
}
