function normalizeClientKeyPart(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function buildLmsAllocationSyncKey(client: string) {
  const keyPart = normalizeClientKeyPart(client)
  return keyPart ? `client:${keyPart}` : null
}
