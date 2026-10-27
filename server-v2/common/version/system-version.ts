let systemDataVersion = Date.now();

export function getSystemDataVersion() {
  return systemDataVersion;
}

export function bumpSystemDataVersion() {
  systemDataVersion = Date.now();
  return systemDataVersion;
}
