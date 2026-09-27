import type Logger from '@gershy/logger';
import { assertEqual, cmpReg, testRunner } from '../build/utils.test.ts';
import './main.ts';
import { entry, type EntryInp } from './main.ts';

// Type testing
(async () => {
  
  type Enforce<Provided, Expected extends Provided> = { provided: Provided, expected: Expected };
  
  type Tests = {
    1: Enforce<{ x: 'y' }, { x: 'y' }>,
  };
  if (0) ((v?: Tests) => void 0)();
  
})();

const logTest = async (opts: Omit<EntryInp<any>, 'name' | 'codec' | 'fn'>, fn: (logger: Logger) => any): Promise<string[]> => {
  
  const logs: string[] = [];
  const debugArgs = {
    topLevelHandling: false,
    log: {
      write: str => logs.push(str),
      format: {
        ansi: false
      }
    }
  }[cl.merge](opts);
  await entry({ name: 'test', ...debugArgs, fn: async logger => fn(logger) });
  
  return logs;
  
};

testRunner([
  
  { name: 'basic', fn: async () => {
    
    const logs = await logTest({}, async logger => {
      
      logger.log({
        $$: 'haha',
        this: {
          is: {
            my: {
              crazyCoolData: Buffer.alloc(20)
            }
          }
        }
      });
      
    });
    
    assertEqual(logs, [
      `[test.launch] {}\n`,
      `[test.haha] { this: { is: { my: { crazyCoolData: 'Buffer(...)' } } } }\n`,
      [ cmpReg, /\[test.accept\] \{ ms: [0-9]+ \}\n/ ]
    ]);
    
  }},
  { name: 'mutliline', fn: async () => {
    
    const logs = await logTest({}, async logger => {
      logger.log({ $$: 'haha', x: BigInt('1'.repeat(100)) })
    });
    
    assertEqual(logs, [
      `[test.launch] {}\n`,
      `[test.haha] { x: 'BigInt(...)' }\n`,
      [ cmpReg, /\[test.accept\] \{ ms: [0-9]+ \}\n/ ]
    ]);
    
  }},
  { name: 'mutliline2', fn: async () => {
    
    const logs = await logTest({ log: { format: { maxStrLen: 25 } } }, logger => logger.log({
      $$: 'haha',
      x: { y: 'x'.repeat(100) },
      xx: 'x'.repeat(100),
      xxx: BigInt('1'.repeat(100)),
      xxxxx: { y: 'x'.repeat(100) },
      a: { b: { c: 'x'.repeat(100) } },
      h: { i: { j: [ 'x'.repeat(100) ] } },
      lines: 'xxx\nxxx\nxxx'
    }));
    
    assertEqual(logs, [
      `[test.launch] {}\n`,
      String[cl.baseline](`
        | [test.haha] {
        | [test.haha] ¦ x ---: { y: 'xxxxxxxxxxxx…xxxxxxxxxxxx' },
        | [test.haha] ¦ xx --: 'xxxxxxxxxxxx…xxxxxxxxxxxx',
        | [test.haha] ¦ xxx -: 'BigInt(...)',
        | [test.haha] ¦ xxxxx: { y: 'xxxxxxxxxxxx…xxxxxxxxxxxx' },
        | [test.haha] ¦ a ---: { b: { c: 'xxxxxxxxxxxx…xxxxxxxxxxxx' } },
        | [test.haha] ¦ h ---: { i: { j: [ 'xxxxxxxxxxxx…xxxxxxxxxxxx' ] } },
        | [test.haha] ¦ lines: """
        | [test.haha] ¦ ¦ | xxx
        | [test.haha] ¦ ¦ | xxx
        | [test.haha] ¦ ¦ | xxx
        | [test.haha] ¦ """
        | [test.haha] }
        | 
      `),
      [ cmpReg, /\[test.accept\] \{ ms: [0-9]+ \}\n/ ]
    ]);
    
  }}
  
]);