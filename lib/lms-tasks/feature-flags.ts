export function isLmsMobileOptimizedEnabled() {
  return process.env.NEXT_PUBLIC_LMS_ANALYSIS_MOBILE !== "false"
}
