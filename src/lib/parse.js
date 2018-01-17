import {characters, hit_reg, hit_obj, is_digit, is_alphanumeric_char, parse_js_number} from './utils';
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
    const ret = {
      type,
      value,
      line: this.S.tokline,
      col: this.S.tokcol,
      pos: this.S.tokpos,
      endpos: this.S.pos,
      nlb: this.S.newline_before,
    };
    return ret;
  }

  peek() {
    return this.S.text.charAt(this.S.pos);
  }

  next(signal_eof, in_string) {
    const ch = this.S.text.charAt(this.S.pos++);
    if (signal_eof && !ch) {
      throw this.EX_EOF;
    }
    if (ch == '\n') { // 换行了
      S.newline_before = S.newline_before || !in_string;
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
    
  }

  read_while(pred) {
    let ch = this.peek(), i = 0, ret = '';
    while(ch && pred(ch, i++)) {
      ret += this.next();
      ch = this.peek();
    }
    return ret;
  }


  next_token() {
    skip_whitespace();
    start_token();
    const ch = this.peek();
    if (!ch) return token('eof');
    if (is_digit(ch)) return read_num();
    if (ch == '"' || ch == "'") return read_string();
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
