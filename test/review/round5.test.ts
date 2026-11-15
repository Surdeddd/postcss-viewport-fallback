import { describe, it, expect } from 'vitest';
import { run } from '../helpers/run';

describe('media queries that count as one and the same', () => {
  it('keeps custom media names that differ only in case apart', async () => {
    const input = `@media (--A),(--a),(min-width:1000dvh){a{color:red}}`;
    expect(await run(input, { preserve: false })).toBe(
      `@media (--A),(--a),(min-width:1000vh){a{color:red}}`
    );
    expect(
      await run(`@media (--A) and (width:1vh),(--a) and (width:1dvh){a{color:red}}`)
    ).toBe(
      `@media (--A) and (width:1vh),(--a) and (width:1vh),(--a) and (width:1dvh){a{color:red}}`
    );
  });

  it('still treats everything else without regard to case', async () => {
    const input = `@media (MIN-HEIGHT: 50VH), (min-height: 50dvh){a{color:red}}`;
    expect(await run(input)).toBe(input);
  });
});
