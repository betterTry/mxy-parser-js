import {KEY_WORDS, RESERVED_WORDS, KEY_WORDS_BEFORE_EXPRESSION, KEYWORDS_ATOM, OPERATOR_CHARS, RE_HEX_NUMBER, RE_OCT_NUMBER, RE_DEC_NUMBER, OPERATORS, WHITESPACE_CHARS, PUNC_BEFORE_EXPRESSION, PUNC_CHARS, REGEXP_MODIFIERS, UNICODE} from '../constant';


exports function characters(string) {
  return string.split('');
}

exports function hit_reg(reg, target) {
  return reg.test(target);
}

exports function hit_obj(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

exports function is_digit(ch) {
  ch = ch.charCodeAt(0)
  return ch >= 48 && ch <= 57;
}

exports function is_letter(ch) {
  return hit_reg(UNICODE.letter, ch);
}

exports function is_alphanumeric_char(ch) {
  return is_digit(ch) || is_letter(ch);
}

exports function parse_js_number(num) {
  if (hit_reg(RE_HEX_NUMBER, num)) { // 16进制;
    return parseInt(num.substr(2), 16);
  } else if (hit_reg(RE_OCT_NUMBER, num)) { // 8进制;
    return parseInt(num.substr(1), 16);
  } else if (hit_reg(RE_DEC_NUMBER, num)) {
    return parseFloat(num);
  }
}
