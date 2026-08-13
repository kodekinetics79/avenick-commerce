/**
 * Direct browser PUTs remain disabled until the storage layer can enforce both
 * an object-size ceiling and verified media type. Authentication alone is not
 * an upload security boundary.
 */
export function browserDirectUploadsEnabled(): false {
  return false;
}
