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

/**
 * Prints the API's low-balance / debt notice to stderr, so it shows next to
 * normal output without breaking anything that parses stdout.
 */
export function billingWarning(billing?: { message: string }): void {
  if (billing) console.error(`\n! ${billing.message}`);
}
