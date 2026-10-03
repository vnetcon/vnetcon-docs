#!/usr/bin/env node
try {
  const { main } = await import('../multiproject-mcp/src/cli.mjs');
  await main(process.argv.slice(2));
} catch (error) {
  if (error?.code === 'ERR_MODULE_NOT_FOUND') {
    process.stderr.write('multiproject-mcp-riippuvuudet puuttuvat. Aja repositoryn juuressa:\n');
    process.stderr.write('  npm install --prefix multiproject-mcp\n');
    process.exit(1);
  }
  throw error;
}
