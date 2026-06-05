import path from "path";

export const STORAGE_ROOT = path.join(process.cwd(), "storage");

export function courseDir(courseId: string): string {
  return path.join(STORAGE_ROOT, "courses", courseId);
}
