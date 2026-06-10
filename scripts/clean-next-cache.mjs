import { rmSync } from "node:fs";

try {
  rmSync(".next", { recursive: true, force: true });
  console.log("Removed .next cache.");
} catch (error) {
  console.error("Failed to remove .next cache.");
  console.error(error);
  process.exit(1);
}
