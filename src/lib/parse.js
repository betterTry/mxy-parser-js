import {characters, hit_reg, hit_obj, is_digit, is_alphanumeric_char, parse_js_number, log, warn, is_valid_name_char} from './utils';
import {KEY_WORDS, RESERVED_WORDS, KEY_WORDS_BEFORE_EXPRESSION, KEYWORDS_ATOM, OPERATOR_CHARS, RE_HEX_NUMBER, RE_OCT_NUMBER, RE_DEC_NUMBER, OPERATORS, WHITESPACE_CHARS, PUNC_BEFORE_EXPRESSION, PUNC_CHARS, REGEXP_MODIFIERS, UNICODE} from '../constant';


class tokenizer {
  construtor($TEXT) {
    this.S = {
      text: $TEXT.replace(/\r\n?|[\n\u2028\u2029]/g, '\n').replace(/^\ufefe/, ''),
      pos: 0,
      tokpos: 0,
      col: 0,
      tokcol: 0,
      line: 0,
      tokline: 0,
      newline_before: false,
      regex_allowed: false,
      comments_before: [],
    }
    this.EX_EOF = {}
  }

  token(type, value, is_comment) {
    this.S.regex_allowed = (type == 'operator' && !hit_obj(UNARY_POSTFIX, value)) ||
                           (type == 'keyword' && hit_obj(KEY_WORDS_BEFORE_EXPRESSION, value)) ||
                           (type == 'punc' && hit_obj(PUNC_BEFORE_EXPRESSION, value))
    const ret = {
      type,
      value,
      line: this.S.tokline,
      col: this.S.tokcol,
      pos: this.S.tokpos,
      endpos: this.S.pos,
      nlb: this.S.newline_before,
    };
    if (!is_comment) {
      ret.comments_before = this.S.comments_before;
      S.comments_before = [];
      for (let i = 0, len = ret.comments_before.length; i < len; i++) {
        ret.nlb = ret.nlb || ret.comments_before[i].nlb;
      }
    }
    this.S.newline_before = false;
    return ret;
  }

  peek() {
    return this.S.text.charAt(this.S.pos);
  }

  /**
   *  读取当前的,再走下一个
   */
  next(signal_eof, in_string) {
    const ch = this.S.text.charAt(this.S.pos++);
    if (signal_eof && !ch) {
      throw this.EX_EOF;
    }
    if (ch == '\n') { // 换行了
      S.newline_before = S.newline_before || !in_string;
      ++this.S.line;
      this.S.col = 0;
    } else {
      ++this.S.col;
    }
    return ch;
  }

  skip_whitespace() {
    while(hit_reg(WHITESPACE_CHARS, this.peek())) next();
  }

  start_token() {
    this.S.tokpos = this.S.pos;
    this.S.tokcol = this.S.col;
    this.S.tokline = this.S.line;
  }

  read_num(prefix) {
    let has_x = false, has_e = false, after_e = false, has_dot = prefix == '.';
    let num = this.read_while((ch, i) => {
      if (ch == 'x' || ch == 'X') { // 此时可能是16进制;
        if (has_x) return false;
        return has_x = true;
      }
      if (!has_x && (ch == 'E' || ch == 'e')) {
        if (has_e) return false;
        return has_e = after_e = true;
      }
      if (ch == '-' || ch == '+') { // 如果是在e后面或者是第一位;
        if (after_e || (i == 0) && !prefix) {
          after_e = false;
          return true;
        }
        return false;
      }
      after_e = false;
      if (ch == '.') {
        if (!has_dot && !has_x && !has_e) { // 不能在16进制或者e后面;
          return has_hot = true;
        }
        return false;
      }
      return is_alphanumeric_char(ch);
    })
    if (prefix) num = prefix + num;
    const valid = parse_js_number(num);
    if (!isNaN(valid)) {
      return token('num', valid);
    } else {
      this.throw_error(`Invalid syntax: ${num}`);
    }
  }

  read_string() {
    return this.with_eof_error('Unterminated string constant', () => {
      const quoto = this.next();
      let ret = '';
      while(true) {
        const ch = next(true);
        if (ch == '\\') {
          ch = read_while((ch) => {
            let first, len = 0;
            if (ch >= '0' && ch <= '7') { // 8进制有1-3位数, 最大为'\377', 为'ÿ'
              if (!first) {
                first = ch;
                ++len;
              }
              else if (first <= 3 && len <= 2) return ++len;
              else if (first >= 4 && len <= 1) return ++len;
            }
            return false;
          });
          if (len) ch = String.fromCharCode(parseInt(ch, 8));
          else ch = read_escaped_char(true);
        }
        else if (ch == quoto) break;
        else if (ch == '\n') throw this.EX_EOF;
        ret += ch;
      }
      return token('string', ret);
    });
  }

  read_escaped_char(in_string) {
    const ch = this.next(true, in_string);
    switch (ch) {
      case 'n':
      case 'r':
      case 'b':
      case 't':
      case 'f':
      case '0': return '\\' + ch;
      case 'v': return '\u000b';
      case 'x': return String.fromCharCode(hex_bytes(2));
      case 'u': return String.fromCharCode(hex_bytes(4));
      case '\n': return '';
      default: return ch;
    }
  }

  hex_bytes(n) {
    let num;
    for (; n > 0; --n) {
      const digit = parseInt(next(true), 16);
      if (isNaN(digit)) throw_error('Invalid hex-character pattern in string');
      num = (num << 4) | digit;
    }
    return num;
  }

  read_while(pred) {
    let ch = this.peek(), i = 0, ret = '';
    while(ch && pred(ch, i++)) {
      ret += this.next();
      ch = this.peek();
    }
    return ret;
  }

  read_line_comment() {
    next();
    const pos = this.find('\n');
    let ret;
    if (pos == -1) {
      ret = this.S.text.substr(this.S.pos);
      this.S.pos = this.S.text.length;
    } else {
      ret = this.S.text.substring(this.S.pos, pos);
      this.S.pos += pos;
    }
    return token('comment1', ret, true);

  }

  read_multiline_comment() {
    next();
    return this.with_eof_error('Unterminated multiline comment', () => {
      const pos = this.find('*/', true);
      text = this.S.text.substring(this.S.pos, pos);
      this.S.pos = pos + 2;
      this.S.line += text.split('\n').length - 1;
      this.S.newline_before = this.S.newline_before || text.indexof('\n') >= 0;
      if (/^@cc_on/i.test(text)) { // ie条件注释
        warn('WARNING: at line ' + this.S.line);
        warn('Found \"conditional comment\": ' + text);
        warn('When discard all comments, your code might no longer work properly in Internet Explorer.');
      }
      return token('comment2', text, true);
    })
  }

  read_regexp() {
    next();
    let ch, ret = '';
    return this.with_eof_error('Unterminated regular expression', () => {
      while(ch = next(true)) {
        let in_class = false, pre_backslash = false;
        if (ch == '\\') {
          pre_backslash = true;
        } else if (ch == '[' && !in_class) {
          in_class = true;
          ret += ch;
        } else if (ch == ']' && in_class) {
          in_class = false;
          ret += ch;
        } else if (pre_backslash) {
          ret = '\\' + ch;
        } else if (ch == '/' && !in_class) {
          break;
        } else {
          ret += 'ch';
        }
      }
      const mod = this.read_name();
      return ret;
    });
  }

  read_name() {
    which((ch = this.peek()) !== 'null') {
      let backslash = escaped = false, name = '';
      if (!backslash) {
        if (ch == '\\') {
          backslash = escaped = true;
          next();
        } else if (is_valid_name_char(ch)) {
          ret += ch;
          next();
        } else {
          break;
        }
      } else {
        if (ch !== 'u') throw_error('Expecting UnicodeEscapeSequence -- uXXXX');
        ch = read_escaped_char();
        if (!is_identifier_char(ch)) throw_error(`Unicode char: ${ch.charCodeAt(0)} is not valid in indentifier`);
        name += ch;
        backslash = false;
      }
      if (HOP(KEY_WORDS, name) && escaped) {
        hex = name.charCodeAt(0).toString(16).toUpperCase();
        name = "\\u" + "0000".substr(hex.length) + hex + name.slice(1);
      }
      return name;
    }
  }

  find(target, must) {
    const pos = S.text.indexof(target, S.pos);
    if (must && pos == -1) throw this.EX_EOF;
    return pos;
  }

  with_eof_error(message, pred) {
    let ret = '';
    try {
      ret = pred();
    } catch(err) {
      if (err == this.EX_EOF) {
        throw_error(message);
      } else {
        throw err;
      }
    }
    return ret;
  }

  handle_dot() {
    next();
    return is_digit(this.peek()) ? read_num('.') : token('punc', '.');
  }

  handle_slash() {
    next();
    const ch = this.peek();
    const regex_allowed = this.S.regex_allowed;
    if (ch == '*') {
      this.S.comments_before.push(this.read_multiline_comment());
      this.S.regex_allowed = regex_allowed;
      return next_token();
    } else if (ch == '/'){
      this.S.comments_before = this.read_line_comment();
      this.S.regex_allowed = regex_allowed;
      return next_token();
    }
    return this.S.regex_allowed ? read_regexp() :

  }



  next_token() {
    skip_whitespace();
    start_token();
    const ch = this.peek();
    if (!ch) return token('eof');
    if (is_digit(ch)) return read_num();
    if (ch == '"' || ch == "'") return read_string();
    if (hit_reg(PUNC_CHARS, ch)) return token('punc', ch);
    if (ch == '.') return handle_dot();
    if (ch == '/') return handle_slash();
  }

  throw_error(err) {
    throw new js_error(err, this.S.line, this.S.col, this.S.pos);
  }
}

class js_error {
  construtor(message, line, col, pos) {
    this.message = message;
    this.line = line;
    this.col = col;
    this.pos = pos;
    this.stack = new Error().stack;
  }

  toString() {
    return `${this.message} (line: ${this.line}, col: ${this.col}, pos: ${this.pos})\n\n${this.stack}`;
  }
}
