export function getErrorMessage(error, fallback = "Something went wrong.") {
  return error?.message || fallback;
}
