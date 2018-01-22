import {hit_obj, is_digit, is_alphanumeric_char, parse_js_number, warn, is_identifier_char, is_identifier_start} from '../utils';
import {KEY_WORDS, PUNC_CHARS, KEY_WORDS_BEFORE_EXPRESSION, KEYWORDS_ATOM, OPERATOR_CHARS, OPERATORS, UNARY_POSTFIX, WHITESPACE_CHARS, PUNC_BEFORE_EXPRESSION} from '../constant';


class tokenizer {
  constructor($TEXT) {
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
    };
    this.EX_EOF = {};
  }

  get go() {
    return this.next_token();
  }

  token(type, value, is_comment) {
    this.S.regex_allowed = (type == 'operator' && !hit_obj(UNARY_POSTFIX, value)) ||
                           (type == 'keyword' && hit_obj(KEY_WORDS_BEFORE_EXPRESSION, value)) ||
                           (type == 'punc' && hit_obj(PUNC_BEFORE_EXPRESSION, value));
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
      this.S.comments_before = [];
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
      this.S.newline_before = this.S.newline_before || !in_string;
      ++this.S.line;
      this.S.col = 0;
    } else {
      ++this.S.col;
    }
    return ch;
  }

  skip_whitespace() {
    while(hit_obj(WHITESPACE_CHARS, this.peek())) this.next();
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
          return has_dot = true;
        }
        return false;
      }
      return is_alphanumeric_char(ch);
    });
    if (prefix) num = prefix + num;
    const valid = parse_js_number(num);
    if (!isNaN(valid)) {
      return this.token('num', valid);
    } else {
      this.throw_error(`Invalidthis.Syntax: ${num}`);
    }
  }

  read_string() {
    return this.with_eof_error('Unterminatedthis.String constant', () => {
      const quoto = this.next();
      let ret = '';
      for (;;) {
        let ch = this.next(true);
        if (ch == '\\') {
          let len = 0;
          ch = this.read_while((ch) => {
            let first;
            if (ch >= '0' && ch <= '7') { // 8进制有1-3位数, 最大为'\377', 为'ÿ'
              if (!first) {
                first = ch;
                ++len;
              } else if (first <= 3 && len <= 2) return ++len;
              else if (first >= 4 && len <= 1) return ++len;
            }
            return false;
          });
          if (len) ch = this.String.fromCharCode(parseInt(ch, 8));
          else ch = this.read_escaped_char(true);
        } else if (ch == quoto) break;
        else if (ch == '\n') throw this.EX_EOF;
        ret += ch;
      }
      return this.token('string', ret);
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
      case 'x': return this.String.fromCharCode(this.hex_bytes(2));
      case 'u': return this.String.fromCharCode(this.hex_bytes(4));
      case '\n': return '';
      default: return ch;
    }
  }

  hex_bytes(n) {
    let num;
    for (; n > 0; --n) {
      const digit = parseInt(this.next(true), 16);
      if (isNaN(digit)) this.throw_error('Invalid hex-character pattern inthis.String');
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
    this.next();
    const pos = this.find('\n');
    let ret;
    if (pos == -1) {
      ret = this.S.text.substr(this.S.pos);
      this.S.pos = this.S.text.length;
    } else {
      ret = this.S.text.substring(this.S.pos, pos);
      this.S.pos += pos;
    }
    return this.token('comment1', ret, true);

  }

  read_multiline_comment() {
    this.next();
    return this.with_eof_error('Unterminated multiline comment', () => {
      const pos = this.find('*/', true);
      const text = this.S.text.substring(this.S.pos, pos);
      this.S.pos = pos + 2;
      this.S.line += text.split('\n').length - 1;
      this.S.newline_before = this.S.newline_before || text.indexof('\n') >= 0;
      if (/^@cc_on/i.test(text)) { // ie条件注释
        warn('WARNING: at line ' + this.S.line);
        warn('Found "conditional comment": ' + text);
        warn('When discard all comments, your code might no longer work properly in Internet Explorer.');
      }
      return this.token('comment2', text, true);
    });
  }

  read_regexp() {
    this.next();
    let ch, ret = '';
    return this.with_eof_error('Unterminated regular expression', () => {
      while((ch = this.next(true))) {
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
      const mods = this.read_name();
      return this.token('regexp', [ret, mods]);
    });
  }

  read_name() {
    let backslash = false, escaped = false, name = '', ch, hex;
    while((ch = this.peek()) !== 'null') {
      if (!backslash) {
        if (ch == '\\') {
          backslash = escaped = true;
          this.next();
        } else if (is_identifier_char(ch)) {
          name += ch;
          this.next();
        } else {
          break;
        }
      } else {
        if (ch !== 'u') this.throw_error('Expecting UnicodeEscapeSequence -- uXXXX');
        ch = this.read_escaped_char(); // 拿到了unicode值;
        if (!is_identifier_char(ch)) this.throw_error(`Unicode char: ${ch.charCodeAt(0)} is not valid in indentifier`);
        name += ch;
        backslash = false;
      }
    }
    if (hit_obj(KEY_WORDS, name) && escaped) { // 重新拼成unicode的
      hex = name.charCodeAt(0).toString(16).toUpperCase();
      name = '\\u' + '0000'.substr(hex.length) + hex + name.slice(1);
    }
    return name;
  }

  read_operator() {
    let ch, ret = this.next();
    while ((ch = this.next()) && hit_obj(OPERATORS, ret + ch)) {
      ret += ch;
    }
    return this.token('operator', ret);
  }

  read_word() {
    const word = this.read_name();
    return !hit_obj(KEY_WORDS, word)
      ? this.token('name', word)
      : hit_obj(OPERATORS, word)
        ? this.token('operator', word)
        : hit_obj(KEYWORDS_ATOM, word)
          ? this.token('atom', word)
          : this.token('keyword', word);
  }

  find(target, must) {
    const pos = this.S.text.indexof(target, this.S.pos);
    if (must && pos == -1) throw this.EX_EOF;
    return pos;
  }

  with_eof_error(message, pred) {
    let ret = '';
    try {
      ret = pred();
    } catch(err) {
      if (err == this.EX_EOF) {
        this.throw_error(message);
      } else {
        throw err;
      }
    }
    return ret;
  }

  handle_dot() {
    this.next();
    return is_digit(this.peek()) ? this.read_num('.') : this.token('punc', '.');
  }

  handle_slash() {
    this.next();
    const ch = this.peek();
    const regex_allowed = this.S.regex_allowed;
    if (ch == '*') {
      this.S.comments_before.push(this.read_multiline_comment());
      this.S.regex_allowed = regex_allowed;
      return this.next_token();
    } else if (ch == '/'){
      this.S.comments_before = this.read_line_comment();
      this.S.regex_allowed = regex_allowed;
      return this.next_token();
    }
    return this.S.regex_allowed ? this.read_regexp() : this.read_operator();
  }

  next_token() {
    this.skip_whitespace();
    this.start_token();
    const ch = this.peek();
    if (!ch) return this.token('eof');
    if (is_digit(ch)) return this.read_num();
    if (ch == '"' || ch == "'") return this.read_string();
    if (hit_obj(PUNC_CHARS, ch)) return this.token('punc', this.next());
    if (ch == '.') return this.handle_dot();
    if (ch == '/') return this.handle_slash();
    if (hit_obj(OPERATOR_CHARS, ch)) return this.read_operator();
    if (ch == '\\' || is_identifier_start()) return this.read_word();
    this.throw_error(`Unexpected character "${ch}"`);
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


export default tokenizer;
