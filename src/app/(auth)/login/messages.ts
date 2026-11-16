export const LOGIN_FALLBACK_ERROR =
  "Đăng nhập không thành công. Vui lòng thử lại.";

// Keyed by the `error` query parameter set by the Auth.js sign-in callback.
export const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  locked: "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.",
  email_unverified: "Email Google chưa được xác minh nên không thể đăng nhập.",
  not_registered:
    "Tài khoản chưa được cấp quyền. Vui lòng liên hệ quản trị viên.",
  session_expired: "Phiên đăng nhập không còn hiệu lực. Vui lòng đăng nhập lại.",
  AccessDenied: "Bạn không có quyền đăng nhập bằng tài khoản này.",
};

export const INVALID_CREDENTIALS_MESSAGE =
  "Tên đăng nhập/email hoặc mật khẩu không đúng.";
export const INVALID_INPUT_MESSAGE =
  "Vui lòng nhập tên đăng nhập (hoặc email) và mật khẩu.";

export function tooManyAttemptsMessage(minutes: number): string {
  return `Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau ${minutes} phút.`;
}
export const ACCOUNT_LOCKED_MESSAGE =
  "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.";
