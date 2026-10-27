export function findActiveNavigationPath(
  paths: readonly string[],
  pathname: string,
): string | undefined {
  return paths
    .filter((path) => pathname === path || pathname.startsWith(`${path}/`))
    .sort((left, right) => right.length - left.length)[0];
}
