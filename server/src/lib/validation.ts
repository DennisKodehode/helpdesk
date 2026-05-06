export function firstIssue(error: { issues: { message: string }[] }) {
  return error.issues[0].message;
}
