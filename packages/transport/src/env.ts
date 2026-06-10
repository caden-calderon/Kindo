export const normalizeConfiguredUrl = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  const assignmentIndex = trimmed.indexOf("=");
  if (assignmentIndex !== -1) {
    return trimmed.slice(assignmentIndex + 1).trim();
  }

  return trimmed;
};
