import '@gershy/clearing';
import Logger from '@gershy/logger';
import codecParse, { type Codec } from '@gershy/util-codec-parse';

const { isCls, getClsName, inCls, skip } = cl;
const at:      typeof cl.at      = cl.at;
const count:   typeof cl.count   = cl.count;
const map:     typeof cl.map     = cl.map;
const has:     typeof cl.has     = cl.has;
const indent:  typeof cl.indent  = cl.indent;
const limn:    typeof cl.limn    = cl.limn;
const empty:   typeof cl.empty   = cl.empty;
const toArr:   typeof cl.toArr   = cl.toArr;
const mapk:    typeof cl.mapk    = cl.mapk;
const padTail: typeof cl.padTail = cl.padTail;

const modMapping = {
  
  // https://stackoverflow.com/a/41407246/830905
  
  red:       '\u001b[31m',
  green:     '\u001b[32m',
  yellow:    '\u001b[33m',
  blue:      '\u001b[34m',
  
  subtle:    '\u001b[2m',
  
  bold:      '\u001b[1m',
  italic:    '\u001b[3;22m',
  underline: '\u001b[4;22m',
  
  // Note this one is mostly for reference if we want to support lower-level ansi controls later
  rgbRed:    '\u001b[38;2;255;0;0m', // Must be "[38,2,R;G;Bm]" where R, G, B are 0-255 colour values
  
  reset:     '\u001b[0m'
  
};
const ansi = {
  set: (str: string, modName: keyof typeof modMapping) => {
    return str.split('\n')[map](ln => `${modMapping[modName]}${ln}${modMapping.reset}`).join('\n')
  },
  rem: (str: string) => str.replace(/\u{1b}\[[^a-zA-Z]+[a-zA-Z]/ug, '')
};

type FormatInp = {
  inBandFormatter?: typeof ansi, // In-band (embedded string) formatter
  indentSize?: number,
  stringFormat?: 'inline' | 'multiline',
  objDepth?: number,  // How many levels to recurse into objects
  maxLineLen?: number  // How wide a line can be
};
const format = (val, opts: FormatInp = {}, d = 0, pfx = '', seen = new Map()): string => {
  
  // Converts any value to a human-readable string
  
  const { inBandFormatter: bFmt = ansi, indentSize=2, stringFormat='multiline', objDepth = 7, maxLineLen = 100 } = opts;
  const bFmtSet = bFmt.set;
  const bFmtRem = bFmt.rem;
  const bold = (str: string) => bFmtSet(str, 'bold');
  
  if (val === undefined) return bFmtSet('undefined', 'green');
  if (val === null) return bFmtSet('null', 'green');
  if (val !== val) return bFmtSet('nan', 'green');
  
  if (isCls(val, Number))  return bFmtSet(val.toString(10), 'green');
  if (isCls(val, Boolean)) return bFmtSet(val ? 'T' : 'F', 'green');
  if (isCls(val, Buffer))  return bFmtSet(`Buffer { length: ${val.length} }`, 'green');
  if (isCls(val, Date))    return bFmtSet(`Date { utcMs: ${+val} }`, 'green');
  
  if (isCls(val, String)) {
    
    const maxW = Math.max(8, maxLineLen - pfx.length - d * indentSize - 1); // Subtract 1 for the trailing ","
    
    if (stringFormat === 'inline' || !val[has]('\n')) {
      
      // The ascii range 0x0007 - 0x000f are nasty control characters which don't appear in most
      // terminals as exactly 1 inline character
      let inline = val.replaceAll('\n', '\\n').replaceAll(/[\u0007-\u000f]/g, '');
      if (inline.length > maxW) inline = inline.slice(0, maxW - 1) + '\u2026';
      return bFmtSet(`'${inline}'`, 'green');
      
    } else if (stringFormat === 'multiline') {
      
      const mw = maxW - indentSize; // Subtract an indent, as we indent the multi-line string
      
      // Remove all nasty control chars, except "\n" (whose hex value, '\u000a', is the only
      // value permitted by the break in the range in the following regex)
      const lines = val.replaceAll(/[\u0007-\u0009\u000b-\u000f]/g, '')
        .split('\n')
        [map](ln => bFmtSet(ln.length <= mw ? ln : (ln.slice(0, mw - 1) + '\u2026'), 'green'));
      
      const indentStr = bFmtSet('\u00a6', 'subtle') + ' '.repeat(indentSize - 1);
      return `"""\n${lines.join('\n')[indent](indentStr + '| ')}\n"""`;
      
    }
    
  }
  
  if (d > objDepth) return bFmtSet('<limit>', 'red');
  
  if (seen.has(val)) return seen.get(val);
  
  if (Object.getPrototypeOf(val) === null) {
    
    seen.set(val, '<cyc> PlainObject(...)');
    const str = `PlainObject ${format({ ...val }, opts, d, 'PlainObject ', seen)}`;
    seen.set(val, str);
    return str;
    
  }
  
  if (isCls(val[limn], Function)) {
    
    const f = format(val[limn](), opts, d + 1, '', seen);
    seen.set(val, f);
    return f;
    
    // const str = ansiFn(v, 'blue');
    // seen.set(val, str);
    // return str;
    
  }
  
  if (inCls(val, Function)) {
    
    let str = 'Fn: ' + val.toString().split('\n')[map](ln => ln.trim() ?? skip).join(' ').replace(/[ ]+/g, ' ');
    
    const maxW = Math.max(8, maxLineLen - pfx.length - d * indentSize - 1); // Subtract 1 for a possible trailing ","
    if (str.length > maxW) str = str.slice(0, maxW - 1) + '\u2026';
    
    str = bFmtSet(str, 'blue');
    
    seen.set(val, str);
    return str;
    
  }
  
  if (isCls(val, Set)) {
    
    seen.set(val, '<cyc> Set(...)');
    const str = `Set ${format([ ...val ], opts, d, 'Set ', seen)}`;
    seen.set(val, str);
    return str;
    
  }
  
  if (isCls(val, Map)) {
    
    seen.set(val, '<cyc> Map(...)');
    const str = `Map ${format(Object.fromEntries(val), opts, d, 'Map ', seen)}`;
    seen.set(val, str);
    return str;
    
  }
  
  if (isCls(val, Object)) {
    
    if (val[empty]()) return bold('{}');
    
    seen.set(val, '<cyc> { ... }');
    const pureKeyReg = /^[a-zA-Z$_][a-zA-Z0-9$_]*/;
    const slottableKey = (k: string) => {
      if (pureKeyReg.test(k)) return k;
      else if (!k[has](`'`))  return `'${k}'`;
      else if (!k[has]('"'))  return `"${k}"`;
      else                    return `'${k.replaceAll(`'`, `\\'`)}'`;
    };
    const keyLen = Math.max(...val[toArr]((v, k) => slottableKey(k).length));
    const maxOneLineValueLen = maxLineLen - (d * indentSize) - (keyLen + ': '.length); // Remove space from indentation and key
    
    const str = (() => {
      
      const formatted = val[mapk]((v, k) => {
        
        if (!isCls(k, String)) return skip;
        
        return [
          slottableKey(k),
          format(v, opts, d + 1, `${k[padTail](keyLen, ' ')}: `, seen)
        ];
        
      });
      
      const oneLine = `${bold('{')} ${formatted[toArr]((v, k) => `${k}${bold(':')} ${v}`).join(bold(',') + ' ')} ${bold('}')}`;
      
      const canOneLine = true
        && !oneLine[has]('\n')
        && bFmtRem(oneLine).length < maxOneLineValueLen;
      if (canOneLine) return oneLine;
      
      const multiLineItems = formatted[toArr]((v, k) => {
        
        const paddingAmt = keyLen - k.length;
        let padding = '';
        if (paddingAmt) padding += ' ';
        padding += '-'.repeat(Math.max(paddingAmt - 1, 0));
        const paddedKey = k + bFmtSet(padding, 'subtle');
        return `${paddedKey}${bold(':')} ${v}`;
        
      });
      
      // Using `Math.max` means there's no sorting preference for items less than 10 chars long;
      // trying to balance:
      // 1. Not unnecessarily disrupting object key order
      // 2. Nonetheless, showing cognitively simple items earlier
      const indentStr = bFmtSet('\u00a6', 'subtle') + ' '.repeat(indentSize - 1);
      const sortScore = v => {
        
        const noAnsi = bFmtRem(v);
        const numLines = (noAnsi.match(/\n/g) ?? []).length + 1;
        
        // The first line of `noAnsi` embeds `keyLen` chars and ": "
        let numChars = noAnsi.length - (keyLen + ': '.length);
        if (numLines === 1 && numChars < 50) numChars = 50; // Avoid reordering short single-lines values
        
        return numChars * 1 + numLines * 7;
        
      };
      const multiLine = multiLineItems.sort((a, b) => sortScore(a) - sortScore(b))
        [map](v => v[indent](indentStr))
        .join(bold(',') + '\n')
      
      return `${bold('{')}\n${multiLine}\n${bold('}')}`;
      
    })();
    
    seen.set(val, str);
    return str;
    
  }
  
  if (isCls(val, Array)) {
    
    if (val[empty]()) return bold('[]');
    
    seen.set(val, '<cyc> [ ... ]');
    
    const str = (() => {
      
      const formatted = val[map](v => format(v, opts, d + 1, '', seen));
      
      const oneLine = `${bold('[')} ${formatted.join(bold(',') + ' ')} ${bold(']')}`;
      const canOneLine = true
        && !oneLine[has]('\n')
        && bFmtRem(oneLine).length < (maxLineLen - d * indentSize);
      if (canOneLine) return oneLine;
      
      const indentStr = bFmtSet('\u00a6', 'subtle') + ' '.repeat(indentSize - 1);
      const multiLine = formatted[map](v => v[indent](indentStr)).join(bold(',') + '\n');
      return `${bold('[')}\n${multiLine}\n${bold(']')}`;
      
    })();
    
    seen.set(val, str);
    return str;
    
  }
  
  const formName = getClsName(val);
  seen.set(val, `<cyc> ${formName}(...)`);
  const str = `${bFmtSet(formName, 'blue')} ${format({ ...val }, opts, d, `${formName} `, seen)}`;
  seen.set(val, str);
  return str;
  
};

export type EntryInp<Cdc extends Codec.Reg> = {
  name: string,
  codec?: Cdc,
  inp?: Obj<any>,
  topLevelHandling?: boolean, // Handle top-level warnings and errors; call `process.exit` when `fn` resolves
  log?: {
    write?: (str: string) => void,
    format?: FormatInp & { ansi?: boolean, maxStrLen?: number },
    filter?: (ctx: { $: string } & Obj<any>) => boolean
  },
  fn: (logger: Logger, inp: Codec.Out<Cdc>) => Promise<any>
};
export const entry = <Cdc extends Codec.Reg>(inp: EntryInp<Cdc>) => {
  
  const { topLevelHandling = true, log: logInp = {}, name = '', codec = null, inp: codecInput = {}, fn } = inp;
  
  // Handle top-level errors and warnings
  if (topLevelHandling) (() => {
    
    if (process[Symbol.for('@gershy/entry/dedup')]) throw Error('entry conflict')[cl.mod]({ note: 'The @gershy/entry `entry` function should only be called once with { topLevelHandling: true } per process' });
    process[Symbol.for('@gershy/entry/dedup')] = true;
    
    // Handle top-level errors
    const topLevelHandler = err => {
      const sym = Symbol.for('@gershy/clearing/err/suppressed');
      if (err[sym]) return;
      throw err;
    };
    process.on('uncaughtException', topLevelHandler);
    process.on('unhandledRejection', topLevelHandler);
    
    const ignoredWarningCodes = new Set<string>([
      'undici-ws'[cl.upper](), // Experimental websocket
      'dep0190'[cl.upper]()    // Child process arguments with shell option
    ]);
    const origEmitWarning: any = process.emitWarning;
    (process as any).emitWarning = (...inp: any[]) => {
      
      const code = inp[1]?.code ?? inp[2] ?? inp[1] ?? null;
      
      if (ignoredWarningCodes.has(code)) return;
      origEmitWarning.call(process, ...inp);
      
    };
    
  })();
  
  const logger = (() => {
    
    const {
      write = globalThis['cons' + 'ole'].log,
      filter = () => true,
      format: formatInpRaw = {}
    } = logInp;
    
    const {
      stringFormat = 'multiline',
      objDepth = 7,
      maxLineLen = 150,
      maxStrLen = 750,
      indentSize = 2,
      ansi: useAnsi = true
    } = formatInpRaw;
    
    const formatInp: Required<FormatInp> = {
      stringFormat,
      objDepth,
      maxLineLen,
      indentSize,
      inBandFormatter: useAnsi ? ansi : { set: (str: string) => str, rem: (str: string) => str }
    };
    
    return new Logger('', {}, { maxStrLen }, ctx => {
      
      if (!filter(ctx as any)) return;
      
      const { $: domain, ...inp } = ctx;
      
      const { msg, body } = (() => {
        
        // We detect a "message" if the "msg" key is a String, or "msg" is the only property
        if (inp[at]('msg') && (isCls(inp.msg, String) || inp[count]() === 1)) {
          const { msg, ...body } = inp;
          return { msg, body } as { msg: Json, body: Obj };
        }
        
        return { msg: null, body: inp };
        
      })();
  
      const formattedBody = format(body, formatInp);
      const formattedMsg =  (() => {
        // The message is formatted slightly differently - if it's a string, it's used raw
        if (!msg) return null;
        if (isCls(msg, String)) return msg;
        return format(msg, formatInp);
      })();
      
      const content = [ formattedMsg, formattedBody ][map](v => v ?? skip).join('\n');
      if (!content.trim()) return;
      
      write(content[indent](`[${(domain as any).$}] `) + '\n');
      
    });
    
  })();
  return logger.scope(name, {}, async logger => {
    
    const argv = process.argv.filter(v => v[0] === '{');
    const parsedInp = codec && logger.scope('inp', {}, logger => {
      
      try {
        const rawInp = argv
          .map(v => eval(`(${v})`))
          .reduce((m, v) => m[cl.merge](v), {});
        
        const codecInp = {}
          [cl.merge](codecInput)
          [cl.merge](rawInp);
        return codecParse(codec!, codecInp);
      } catch (err: any) {
        throw err[cl.mod]({ syntaxError: argv })
      }
      
    });
    
    return fn(logger, parsedInp as any);
    
  }).finally(() => topLevelHandling && process.exit(0)); // TODO: detect and report open async processes??
  
};
