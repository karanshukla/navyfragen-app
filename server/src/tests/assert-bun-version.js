// Guard for the `test:bun` script (#269).
//
// `bun test` accepts unknown flags without complaining, so on a Bun that predates
// --isolate the flag is dropped silently and every test file shares one module
// registry. The suite still mostly runs, which is the dangerous part: cross-file
// module-mock bleed shows up as a handful of unrelated assertion failures rather
// than as "your Bun is too old". Fail up front with the real reason instead.

const MINIMUM = "1.3.14";

if (!Bun.semver.satisfies(Bun.version, `>=${MINIMUM}`)) {
  console.error(
    `Bun ${MINIMUM}+ is required to run the server test suite (found ${Bun.version}).\n` +
      `Older builds ignore \`bun test --isolate\` silently, which lets module mocks ` +
      `leak between test files and produces unrelated failures.`
  );
  process.exit(1);
}
