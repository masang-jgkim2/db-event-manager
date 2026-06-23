/** 로그인·가입 아이디: 영문·숫자만 (소문자 저장) */
export const REG_USER_ID = /^[a-z0-9]{4,32}$/;

/** 입력 중 허용 문자 (길이 제한 없음) */
export const REG_USER_ID_CHARS = /^[a-zA-Z0-9]*$/;

export const STR_USER_ID_CHARS_MSG = '영문·숫자만 입력할 수 있습니다.';

export const fnToLowerUserId = (strVal: string): string => strVal.toLowerCase();

/** Ant Design Form — 잘못된 문자 입력 시 즉시 에러 */
export const ruleUserIdCharsOnly = {
  validator: (_: unknown, v: unknown) => {
    const s = String(v ?? '');
    if (!s) return Promise.resolve();
    if (!REG_USER_ID_CHARS.test(s)) {
      return Promise.reject(new Error(STR_USER_ID_CHARS_MSG));
    }
    return Promise.resolve();
  },
};
