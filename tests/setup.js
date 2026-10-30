import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";

// Allow debounced searches and lazy chart imports to settle on busy CI workers.
configure({ asyncUtilTimeout: 3000 });
