/** Sync flag only — keep this free of the Nodemailer package so config load stays cycle-free. */
export const emailVerificationEnabled =
  process.env.NODE_ENV !== 'test' && process.env.EMAIL_VERIFICATION !== 'false'
