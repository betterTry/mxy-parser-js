import {RE_HEX_NUMBER, RE_OCT_NUMBER, RE_DEC_NUMBER, UNICODE} from '../constant';


export function characters(string) {
  return string.split('');
}

export function hit_reg(reg, target) {
  return reg.test(target);
}

export function hit_obj(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

export function is_digit(ch) {
  ch = ch.charCodeAt(0);
  return ch >= 48 && ch <= 57;
}

export function is_letter(ch) {
  return hit_reg(UNICODE.letter, ch);
}

export function is_alphanumeric_char(ch) {
  return is_digit(ch) || is_letter(ch);
}

export function is_identifier_start(ch) {
  return ch == '_' || ch == '$' || is_letter(ch);
}

export function is_identifier_char(ch) {
  return is_identifier_start(ch)
      || hit_reg(UNICODE.combining_mark, ch)
      || hit_reg(UNICODE.digit)
      || hit_reg(UNICODE.connector_punctuation, ch)
      || ch == '\u200c' // zero-width non-joiner <ZWNJ>
      || ch == '\u200d'; // zero-width joiner <ZWJ> (in my ECMA-262 PDF, this is also 200c)
}

export function parse_js_number(num) {
  if (hit_reg(RE_HEX_NUMBER, num)) { // 16进制;
    return parseInt(num.substr(2), 16);
  } else if (hit_reg(RE_OCT_NUMBER, num)) { // 8进制;
    return parseInt(num.substr(1), 16);
  } else if (hit_reg(RE_DEC_NUMBER, num)) {
    return parseFloat(num);
  }
}

export function array_to_hash(arr) {
  const ret = {}, len = arr.length;
  for(let i = 0; i < len; i++) {
    ret[arr[i]] = true;
  }
  return ret;
}

export function warn(val) {
  console.warn(val);
}

export function log() {
  console.log.apply(null, arguments);
}
